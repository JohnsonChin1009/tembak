import "server-only";
import { config } from "@/lib/config";
import { SourceFetchError } from "@/lib/data/errors";
import { columnKey } from "@/lib/data/normalize";
import type { Row, SourceConfig } from "@/lib/types";
import { ConnectorAuthError, errorMessage, withAccessToken, type Tokens } from "./connections";

// Notion API. 2025-09-03 introduced "data sources": a database holds one or more
// data sources, and rows are queried per data source.
const API = "https://api.notion.com/v1";
const VERSION = "2025-09-03";
const TIMEOUT_MS = 15_000;
const MAX_ROWS = 1000;
const MAX_PAGES = MAX_ROWS / 100;

type NotionConfig = Extract<SourceConfig, { kind: "notion" }>;

export async function request(token: string, path: string, body?: unknown, method?: "PATCH"): Promise<unknown> {
  const res = await fetch(`${API}${path}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: {
      authorization: `Bearer ${token}`,
      "notion-version": VERSION,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "error",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.ok) return res.json();
  if (res.status === 401) throw new ConnectorAuthError("Notion rejected the token");
  if (res.status === 404) {
    throw new SourceFetchError(
      "Notion couldn't find that database. In Notion, open it, then ••• → Connections → add the Tembak integration.",
    );
  }
  if (res.status === 429) throw new SourceFetchError("Notion is rate limiting requests. Try again in a minute.");
  throw new SourceFetchError(`Notion: ${await errorMessage(res)}`);
}

// --- OAuth -------------------------------------------------------------------

export function notionAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const q = new URLSearchParams({ client_id: clientId, response_type: "code", owner: "user", redirect_uri: redirectUri, state });
  return `${API}/oauth/authorize?${q}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  bot_id?: string;
  workspace_id?: string;
  workspace_name?: string | null;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const app = config().oauth.notion;
  if (!app) throw new Error("Notion OAuth isn't configured");
  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${app.clientId}:${app.clientSecret}`).toString("base64")}`,
      "content-type": "application/json",
      accept: "application/json",
      "notion-version": VERSION,
    },
    body: JSON.stringify(body),
    redirect: "error",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Notion token exchange failed: ${await errorMessage(res)}`);
  return (await res.json()) as TokenResponse;
}

function tokens(t: TokenResponse): Tokens {
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: t.expires_in ? Date.now() + t.expires_in * 1000 : undefined,
  };
}

export async function notionExchangeCode(code: string, redirectUri: string) {
  const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
  return { ...tokens(t), accountName: t.workspace_name ?? "Notion", accountId: t.workspace_id ?? t.bot_id };
}

export async function notionRefresh(refreshToken: string): Promise<Tokens | null> {
  if (!config().oauth.notion) return null;
  return tokens(await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken }));
}

/** For the API-key fallback: checks an internal integration secret and names its workspace. */
export async function notionVerifyKey(token: string): Promise<{ accountName: string; accountId?: string }> {
  try {
    const me = (await request(token, "/users/me")) as { id?: string; bot?: { workspace_name?: string | null } };
    return { accountName: me.bot?.workspace_name ?? "Notion", accountId: me.id };
  } catch (err) {
    if (err instanceof ConnectorAuthError) {
      throw new SourceFetchError("Notion rejected that key. Copy the Internal Integration Secret again (starts with ntn_).");
    }
    throw err;
  }
}

// --- Picker and rows -----------------------------------------------------------

export type NotionDataSource = { id: string; title: string; url?: string };

type RichText = { plain_text?: string }[] | undefined;
const plain = (t: RichText) => (t ?? []).map((x) => x.plain_text ?? "").join("");

/** Data sources (database tables) the user shared with the integration. */
export async function notionDataSources(workspaceId: string): Promise<NotionDataSource[]> {
  return withAccessToken(workspaceId, "notion", notionRefresh, async (token) => {
    const out: NotionDataSource[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 3; page++) {
      const res = (await request(token, "/search", {
        filter: { property: "object", value: "data_source" },
        page_size: 100,
        start_cursor: cursor,
      })) as { results: { object: string; id: string; title?: RichText; url?: string }[]; has_more: boolean; next_cursor: string | null };
      for (const r of res.results) {
        if (r.object === "data_source") out.push({ id: r.id, title: plain(r.title) || "Untitled", url: r.url });
      }
      if (!res.has_more || !res.next_cursor) break;
      cursor = res.next_cursor;
    }
    return out;
  });
}

type PropertyValue = { type: string; [key: string]: unknown };
type NotionPage = {
  object: string;
  id: string;
  url?: string;
  created_time?: string;
  properties: Record<string, PropertyValue>;
};

const named = (list: unknown) =>
  ((list as { name?: string | null }[] | undefined) ?? [])
    .map((x) => x.name ?? "")
    .filter(Boolean)
    .join(", ");

/** One Notion property value as a flat cell. */
export function notionCell(p: PropertyValue): string | number | boolean | null {
  const v = p[p.type] as never;
  switch (p.type) {
    case "title":
    case "rich_text":
      return plain(v) || null;
    case "number":
    case "checkbox":
    case "url":
    case "email":
    case "phone_number":
    case "created_time":
    case "last_edited_time":
      return (v as string | number | boolean | null) ?? null;
    case "select":
    case "status":
      return (v as { name?: string } | null)?.name ?? null;
    case "multi_select":
    case "people":
    case "files":
      return named(v) || null;
    case "date":
      return (v as { start?: string } | null)?.start ?? null;
    case "created_by":
    case "last_edited_by":
      return (v as { name?: string } | null)?.name ?? null;
    case "relation":
      return ((v as unknown[] | undefined) ?? []).length;
    case "unique_id": {
      const u = v as { prefix?: string | null; number?: number | null } | null;
      return u?.number == null ? null : u.prefix ? `${u.prefix}-${u.number}` : u.number;
    }
    case "formula": {
      const f = v as { type: string; [k: string]: unknown } | null;
      if (!f) return null;
      const val = f[f.type];
      return f.type === "date" ? ((val as { start?: string } | null)?.start ?? null) : ((val as string | number | boolean | null) ?? null);
    }
    case "rollup": {
      const r = v as { type: string; number?: number | null; date?: { start?: string } | null; array?: PropertyValue[] } | null;
      if (!r) return null;
      if (r.type === "number") return r.number ?? null;
      if (r.type === "date") return r.date?.start ?? null;
      if (r.type === "array") return (r.array ?? []).map(notionCell).filter((x) => x != null && x !== "").join(", ") || null;
      return null;
    }
    default:
      return null;
  }
}

/** Notion pages to flat rows: one column per property (title first), plus the page link. */
export function notionRowsFromPages(pages: NotionPage[]): Row[] {
  const props = new Map<string, string>(); // property name -> column key
  const titleFirst = (p: NotionPage) =>
    Object.entries(p.properties).sort(([, a], [, b]) => Number(b.type === "title") - Number(a.type === "title"));
  for (const page of pages) {
    for (const [name] of titleFirst(page)) {
      if (props.has(name)) continue;
      let key = columnKey(name, props.size);
      while ([...props.values()].includes(key)) key = `${key}_2`;
      props.set(name, key);
    }
  }
  const taken = new Set(props.values());
  const extra = (k: string) => (taken.has(k) ? null : k);
  const createdKey = extra("created");
  const urlKey = extra("notion_url");
  return pages.map((page) => {
    const row: Row = {};
    for (const [name, key] of props) row[key] = page.properties[name] ? notionCell(page.properties[name]) : null;
    if (createdKey) row[createdKey] = page.created_time?.slice(0, 10) ?? null;
    if (urlKey) row[urlKey] = page.url ?? null;
    return row;
  });
}

export async function notionRows(workspaceId: string, cfg: NotionConfig): Promise<Row[]> {
  return withAccessToken(workspaceId, "notion", notionRefresh, async (token) => {
    const pages: NotionPage[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < MAX_PAGES; i++) {
      const res = (await request(token, `/data_sources/${encodeURIComponent(cfg.dataSourceId)}/query`, {
        page_size: 100,
        start_cursor: cursor,
      })) as { results: NotionPage[]; has_more: boolean; next_cursor: string | null };
      pages.push(...res.results.filter((r) => r.object === "page" && r.properties));
      if (!res.has_more || !res.next_cursor) break;
      cursor = res.next_cursor;
    }
    return notionRowsFromPages(pages.slice(0, MAX_ROWS));
  });
}
