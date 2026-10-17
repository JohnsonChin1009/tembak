import "server-only";
import { kebab, randomId } from "@/lib/ids";
import { getStore } from "@/lib/store";
import type { Source, SourceConfig } from "@/lib/types";
import { fetchRows, parseSheetUrl } from "./fetch";

/** Test-fetches the config, then stores the source with its columns and a few sample rows. */
export async function createSource(input: { name: string; config: SourceConfig; createdBy: string }): Promise<Source> {
  const rows = await fetchRows(input.config);
  const store = await getStore();
  const taken = new Set((await store.listSources()).map((s) => s.key));
  let key = kebab(input.name, 24).replace(/-/g, "_");
  for (let i = 2; taken.has(key); i++) key = `${kebab(input.name, 20).replace(/-/g, "_")}_${i}`;

  const source: Source = {
    id: randomId(),
    key,
    name: input.name.trim().slice(0, 80),
    kind: input.config.kind,
    config: input.config,
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
export async function sourcesFromMessage(text: string, createdBy: string): Promise<{ created: Source[]; failed: string[] }> {
  const urls = [...new Set(text.match(SHEET_URL_RE) ?? [])];
  if (!urls.length) return { created: [], failed: [] };
  const store = await getStore();
  const existing = await store.listSources();
  const created: Source[] = [];
  const failed: string[] = [];
  for (const url of urls) {
    const id = parseSheetUrl(url)?.id;
    if (!id) continue;
    if (existing.some((s) => s.config.kind === "sheet" && parseSheetUrl(s.config.url)?.id === id)) continue;
    try {
      created.push(await createSource({ name: `Sheet ${id.slice(0, 6)}`, config: { kind: "sheet", url }, createdBy }));
    } catch {
      failed.push(url);
    }
  }
  return { created, failed };
}
