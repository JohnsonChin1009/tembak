import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { GoogleAuth } from "google-auth-library";
import { SAMPLE_DATASETS } from "@/lib/data/samples";
import type { Row, Source, SourceConfig } from "@/lib/types";
import { linearRows } from "@/lib/connectors/linear";
import { notionRows } from "@/lib/connectors/notion";
import { unseal } from "@/lib/crypto";
import { SourceFetchError } from "./errors";
import { rowsFromCsv, rowsFromJson, rowsFromTable } from "./normalize";

const CACHE_MS = 60_000;
const TIMEOUT_MS = 15_000;
const cache = new Map<string, { rows: Row[]; until: number }>();

export { SourceFetchError };

export function parseSheetUrl(url: string): { id: string; gid?: string } | null {
  const m = /docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/.exec(url);
  if (!m) return null;
  const gid = /[#&?]gid=(\d+)/.exec(url)?.[1];
  return { id: m[1], gid };
}

let auth: GoogleAuth | undefined;
async function googleToken(): Promise<string | null> {
  try {
    auth ??= new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
    return (await auth.getAccessToken()) ?? null;
  } catch {
    return null; // no ADC locally
  }
}

async function get(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS) });
  return res;
}

async function fetchSheet(cfg: Extract<SourceConfig, { kind: "sheet" }>): Promise<Row[]> {
  const sheet = parseSheetUrl(cfg.url);
  if (!sheet) throw new SourceFetchError("That doesn't look like a Google Sheets link.");

  // 1) Sheets API as the service account (sheet shared with it).
  const token = await googleToken();
  if (token) {
    const auth = { authorization: `Bearer ${token}` };
    let range = cfg.range;
    if (!range) {
      const meta = await get(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheet.id}?fields=sheets.properties(sheetId,title)`,
        auth,
      );
      if (meta.ok) {
        const body = (await meta.json()) as { sheets: { properties: { sheetId: number; title: string } }[] };
        const tab = body.sheets.find((s) => String(s.properties.sheetId) === sheet.gid) ?? body.sheets[0];
        range = tab ? `'${tab.properties.title.replace(/'/g, "''")}'` : undefined;
      }
    }
    if (range) {
      const res = await get(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheet.id}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`,
        auth,
      );
      if (res.ok) {
        const body = (await res.json()) as { values?: unknown[][] };
        return rowsFromTable(body.values ?? []);
      }
    }
  }

  // 2) Public "anyone with the link" sheets via CSV export.
  const res = await get(
    `https://docs.google.com/spreadsheets/d/${sheet.id}/export?format=csv${sheet.gid ? `&gid=${sheet.gid}` : ""}`,
  );
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || type.includes("text/html")) {
    throw new SourceFetchError(
      "Couldn't read that sheet. Share it with the Tembak service account (Viewer), or set it to \"Anyone with the link\".",
    );
  }
  return rowsFromCsv(await res.text());
}

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

/** Blocks requests to internal hosts (metadata server, VPC, loopback). */
async function assertPublicUrl(url: URL) {
  if (url.protocol !== "https:") throw new SourceFetchError("Use an https:// URL.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (/(^|\.)(internal|local|localhost)$/i.test(host)) throw new SourceFetchError("That host isn't reachable.");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new SourceFetchError("Couldn't resolve that host.");
  if (addrs.some((a) => isPrivateAddress(a.address))) throw new SourceFetchError("That host isn't reachable.");
}

async function fetchJson(cfg: Extract<SourceConfig, { kind: "json" }>): Promise<Row[]> {
  let url: URL;
  try {
    url = new URL(cfg.url);
  } catch {
    throw new SourceFetchError("Invalid URL.");
  }
  await assertPublicUrl(url);
  const headers: Record<string, string> = { accept: "application/json" };
  if (cfg.headerName && cfg.headerValue) {
    if (/metadata|^host$/i.test(cfg.headerName)) throw new SourceFetchError("That header isn't allowed.");
    headers[cfg.headerName] = unseal(cfg.headerValue);
  }
  // No redirects: a public URL could otherwise bounce to an internal one.
  const res = await fetch(url, { headers, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (res.status >= 300 && res.status < 400) throw new SourceFetchError("The API redirected; use the final URL.");
  if (!res.ok) throw new SourceFetchError(`The API responded with ${res.status}.`);
  try {
    return rowsFromJson(await res.json());
  } catch {
    throw new SourceFetchError("The API didn't return JSON.");
  }
}

/** `workspaceId` is needed for Notion and Linear, which read through the workspace's connection. */
export async function fetchRows(config: SourceConfig, workspaceId?: string): Promise<Row[]> {
  switch (config.kind) {
    case "sample": {
      const ds = SAMPLE_DATASETS[config.dataset];
      if (!ds) throw new SourceFetchError("Unknown sample dataset.");
      return ds.rows();
    }
    case "csv":
      return rowsFromCsv(config.text);
    case "sheet":
      return fetchSheet(config);
    case "json":
      return fetchJson(config);
    case "notion":
    case "linear": {
      if (!workspaceId) throw new SourceFetchError("Missing workspace for this connector.");
      return config.kind === "notion" ? notionRows(workspaceId, config) : linearRows(workspaceId, config);
    }
  }
}

/** Drops cached rows for a source, e.g. after an app wrote to it with tembak.action. */
export function invalidateSourceRows(sourceId: string) {
  for (const key of cache.keys()) if (key.startsWith(`${sourceId}:`)) cache.delete(key);
}

/** Rows for a stored source, cached briefly so dashboards don't hammer upstream APIs. */
export async function sourceRows(source: Source): Promise<Row[]> {
  const key = `${source.id}:${source.updatedAt}`;
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.rows;
  const rows = await fetchRows(source.config, source.workspaceId);
  cache.set(key, { rows, until: Date.now() + CACHE_MS });
  return rows;
}
