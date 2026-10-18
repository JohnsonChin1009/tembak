import "server-only";
import { GoogleAuth } from "google-auth-library";
import { z } from "zod";
import { HttpError } from "@/lib/api";
import { config } from "@/lib/config";
import { invalidateSourceRows, parseSheetUrl } from "@/lib/data/fetch";
import { columnKey } from "@/lib/data/normalize";
import type { Source, SourceConfig } from "@/lib/types";
import { action, cellValue, ownSource, valueMap, type ActionContext } from "./shared";

// Google Sheets writes as the service account. Reading only needs Viewer (or a
// public link); writing needs the `spreadsheets` scope and Editor access on the
// sheet. Values are written RAW, so text starting with "=" never becomes a formula.

const API = "https://sheets.googleapis.com/v4/spreadsheets";
const TIMEOUT_MS = 15_000;
/** updateRow refuses to touch more rows than this in one call. */
const MAX_MATCHES = 25;

type SheetConfig = Extract<SourceConfig, { kind: "sheet" }>;
type Cell = z.infer<typeof cellValue>;

let auth: GoogleAuth | undefined;
async function writeAuth(): Promise<{ token: string; email: string }> {
  try {
    auth ??= new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
    const token = await auth.getAccessToken();
    if (token) {
      const email = config().serviceAccountEmail ?? (await auth.getCredentials().catch(() => null))?.client_email;
      return { token, email: email ?? "the Tembak service account" };
    }
  } catch {
    // No Google credentials (local dev without ADC).
  }
  throw new HttpError(409, "Google Sheets isn't connected on this server, so apps can't update sheets yet.");
}

async function google<T>(token: string, email: string, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API}/${path}`, {
    method: init.method ?? "GET",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    redirect: "error",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.ok) return (await res.json()) as T;
  if (res.status === 403 || res.status === 401) {
    throw new HttpError(403, `Share this sheet with ${email} as an editor so apps can update it.`);
  }
  if (res.status === 404) throw new HttpError(404, "Google couldn't find that sheet. It may have been deleted.");
  if (res.status === 429) throw new HttpError(429, "Google Sheets is rate limiting requests. Try again in a minute.");
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  throw new HttpError(502, `Google Sheets says: ${(body?.error?.message ?? `HTTP ${res.status}`).slice(0, 200)}`);
}

const quote = (tab: string) => `'${tab.replace(/'/g, "''")}'`;

/** "AB" -> 27 (1-based) and back. */
function colIndex(letters: string): number {
  return [...letters.toUpperCase()].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
}
export function colLetters(n: number): string {
  let s = "";
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** "'My tab'!B3:F200" -> { tab: "'My tab'", col: 2, row: 3 }. */
export function rangeStart(range: string): { tab: string; col: number; row: number } {
  const bang = range.lastIndexOf("!");
  const tab = bang === -1 ? range : range.slice(0, bang);
  const m = /^\$?([A-Za-z]+)\$?(\d*)/.exec(bang === -1 ? "" : range.slice(bang + 1));
  return { tab, col: m ? colIndex(m[1]) : 1, row: m?.[2] ? Number(m[2]) : 1 };
}

/** The same column keys tembak.data gives this sheet's header (see rowsFromTable). */
export function headerKeys(header: unknown[]): string[] {
  const seen = new Map<string, number>();
  return header.map((h, i) => {
    const k = columnKey(String(h ?? ""), i);
    const n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    return n ? `${k}_${n + 1}` : k;
  });
}

/** Column index (0-based, within the table) for an app's column name: header text or tembak.data key. */
function columnFor(table: Table, name: string): number {
  const exact = table.header.findIndex((h) => String(h ?? "").trim() === name.trim());
  const i = exact !== -1 ? exact : table.keys.indexOf(name);
  if (i === -1) throw new HttpError(400, `The sheet has no "${name}" column. Columns: ${table.keys.join(", ")}.`);
  return i;
}

type Table = {
  source: Source;
  sheetId: string;
  tab: string;
  /** 1-based sheet coordinates of the header row's first cell. */
  col: number;
  headerRow: number;
  header: unknown[];
  keys: string[];
  /** Rows below the header, each with its 1-based sheet row number. */
  body: { row: number; values: unknown[] }[];
};

/** Reads the sheet the way tembak.data does (same tab, first non-blank row is the header). */
async function readTable(source: Source, token: string, email: string): Promise<Table> {
  const cfg = source.config as SheetConfig;
  const sheet = parseSheetUrl(cfg.url);
  if (!sheet) throw new HttpError(400, `"${source.key}" doesn't point at a Google Sheet.`);
  let range = cfg.range;
  if (!range) {
    const meta = await google<{ sheets: { properties: { sheetId: number; title: string } }[] }>(
      token,
      email,
      `${sheet.id}?fields=sheets.properties(sheetId,title)`,
    );
    const tab = meta.sheets.find((s) => String(s.properties.sheetId) === sheet.gid) ?? meta.sheets[0];
    if (!tab) throw new HttpError(404, "That sheet has no tabs.");
    range = quote(tab.properties.title);
  }
  const data = await google<{ range: string; values?: unknown[][] }>(
    token,
    email,
    `${sheet.id}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`,
  );
  const start = rangeStart(data.range);
  const values = data.values ?? [];
  const blank = (r: unknown[]) => !r.some((c) => String(c ?? "").trim() !== "");
  const h = values.findIndex((r) => !blank(r));
  if (h === -1) throw new HttpError(400, "That sheet is empty: add a header row first.");
  return {
    source,
    sheetId: sheet.id,
    tab: start.tab,
    col: start.col,
    headerRow: start.row + h,
    header: values[h],
    keys: headerKeys(values[h]),
    body: values.slice(h + 1).map((v, i) => ({ row: start.row + h + 1 + i, values: v })),
  };
}

function sheetSource(ctx: ActionContext, key: string): Source {
  const source = ownSource(ctx, key);
  if (source.config.kind !== "sheet") throw new HttpError(400, `"${key}" isn't a Google Sheet.`);
  return source;
}

const raw = (v: Cell) => (v === null ? "" : v);
const same = (cell: unknown, v: Cell) => String(cell ?? "").trim() === String(v ?? "").trim();

const row = valueMap(cellValue);

export const SHEETS_ACTIONS = {
  "sheets.appendRow": action({
    provider: "sheets",
    input: z.strictObject({ sourceKey: z.string().min(1).max(100), row }),
    run: async (input, ctx) => {
      const source = sheetSource(ctx, input.sourceKey);
      const { token, email } = await writeAuth();
      const table = await readTable(source, token, email);
      const out: (string | number | boolean)[] = table.header.map(() => "");
      for (const [name, value] of Object.entries(input.row)) out[columnFor(table, name)] = raw(value);
      const last = colLetters(table.col + table.header.length - 1);
      const target = `${table.tab}!${colLetters(table.col)}${table.headerRow}:${last}${table.headerRow}`;
      const res = await google<{ updates?: { updatedRange?: string } }>(
        token,
        email,
        `${table.sheetId}/values/${encodeURIComponent(target)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        { method: "POST", body: { values: [out] } },
      );
      invalidateSourceRows(source.id);
      return { updatedRange: res.updates?.updatedRange ?? null };
    },
  }),

  "sheets.updateRow": action({
    provider: "sheets",
    input: z.strictObject({
      sourceKey: z.string().min(1).max(100),
      match: z.strictObject({ column: z.string().min(1).max(200), value: cellValue.refine((v) => v !== null && v !== "", "Give a value to match") }),
      set: row,
    }),
    run: async (input, ctx) => {
      const source = sheetSource(ctx, input.sourceKey);
      const { token, email } = await writeAuth();
      const table = await readTable(source, token, email);
      const at = columnFor(table, input.match.column);
      const sets = Object.entries(input.set).map(([name, value]) => ({ col: columnFor(table, name), value: raw(value) }));
      const rows = table.body.filter((r) => same(r.values[at], input.match.value));
      if (rows.length > MAX_MATCHES) {
        throw new HttpError(400, `${rows.length} rows match, which is too many to change at once. Match on a unique column.`);
      }
      if (rows.length) {
        await google(token, email, `${table.sheetId}/values:batchUpdate`, {
          method: "POST",
          body: {
            valueInputOption: "RAW",
            data: rows.flatMap((r) =>
              sets.map((s) => ({ range: `${table.tab}!${colLetters(table.col + s.col)}${r.row}`, values: [[s.value]] })),
            ),
          },
        });
        invalidateSourceRows(source.id);
      }
      return { updated: rows.length };
    },
  }),
};
