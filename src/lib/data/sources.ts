import "server-only";
import { seal } from "@/lib/crypto";
import { kebab, randomId } from "@/lib/ids";
import { getStore } from "@/lib/store";
import type { Source, SourceConfig } from "@/lib/types";
import { fetchRows, parseSheetUrl } from "./fetch";

/** Fetches without saving, for the dialog's "Test connection". */
export async function previewSource(workspaceId: string, config: SourceConfig) {
  const rows = await fetchRows(config, workspaceId);
  return { columns: Object.keys(rows[0] ?? {}), sample: rows.slice(0, 5), rowCount: rows.length };
}

/** Secrets in a source config are encrypted before they're stored. */
function sealConfig(config: SourceConfig): SourceConfig {
  return config.kind === "json" && config.headerValue ? { ...config, headerValue: seal(config.headerValue) } : config;
}

/** Test-fetches the config, then stores the source with its columns and a few sample rows. */
export async function createSource(input: {
  workspaceId: string;
  name: string;
  config: SourceConfig;
  createdBy: string;
}): Promise<Source> {
  const rows = await fetchRows(input.config, input.workspaceId);
  const store = await getStore();
  const taken = new Set((await store.listSources(input.workspaceId)).map((s) => s.key));
  let key = kebab(input.name, 24).replace(/-/g, "_");
  for (let i = 2; taken.has(key); i++) key = `${kebab(input.name, 20).replace(/-/g, "_")}_${i}`;

  const source: Source = {
    id: randomId(),
    workspaceId: input.workspaceId,
    key,
    name: input.name.trim().slice(0, 80),
    kind: input.config.kind,
    config: sealConfig(input.config),
    columns: Object.keys(rows[0] ?? {}),
    sample: rows.slice(0, 3),
    rowCount: rows.length,
    updatedAt: Date.now(),
    createdBy: input.createdBy,
  };
  await store.upsertSource(source);
  return source;
}

/** Strips secrets before a source leaves the server. */
export function redact(source: Source): Source {
  const config: SourceConfig =
    source.config.kind === "json"
      ? { ...source.config, headerValue: source.config.headerValue ? "••••••" : undefined }
      : source.config.kind === "csv"
        ? { kind: "csv", text: "" }
        : source.config;
  return { ...source, config };
}

const SHEET_URL_RE = /https:\/\/docs\.google\.com\/spreadsheets\/d\/[^\s>)]+/g;

/**
 * Turns Google Sheets links pasted in a message into data sources, so
 * "@tembak build a dashboard from <sheet link>" just works.
 */
export async function sourcesFromMessage(
  workspaceId: string,
  text: string,
  createdBy: string,
): Promise<{ created: Source[]; failed: string[] }> {
  const urls = [...new Set(text.match(SHEET_URL_RE) ?? [])];
  if (!urls.length) return { created: [], failed: [] };
  const store = await getStore();
  const existing = await store.listSources(workspaceId);
  const created: Source[] = [];
  const failed: string[] = [];
  for (const url of urls) {
    const id = parseSheetUrl(url)?.id;
    if (!id) continue;
    if (existing.some((s) => s.config.kind === "sheet" && parseSheetUrl(s.config.url)?.id === id)) continue;
    try {
      created.push(
        await createSource({ workspaceId, name: `Sheet ${id.slice(0, 6)}`, config: { kind: "sheet", url }, createdBy }),
      );
    } catch {
      failed.push(url);
    }
  }
  return { created, failed };
}
