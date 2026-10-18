import "server-only";
import { z } from "zod";
import { HttpError } from "@/lib/api";
import { withAccessToken } from "@/lib/connectors/connections";
import { notionRefresh, request } from "@/lib/connectors/notion";
import { invalidateSourceRows } from "@/lib/data/fetch";
import { SourceFetchError } from "@/lib/data/errors";
import { columnKey } from "@/lib/data/normalize";
import type { Source, SourceConfig } from "@/lib/types";
import { action, cellValue, ownSource, requireConnection, valueMap, type ActionContext } from "./shared";

// Notion writes, limited to the data sources (database tables) behind the app's
// own sources. Apps pass plain values; the data source's property types decide
// the Notion payload.

type Schema = Record<string, { type: string }>;
type Value = z.infer<typeof notionValue>;

const notionValue = z.union([cellValue, z.array(z.string().max(200)).max(50)]);

const CAPABILITIES =
  "Notion won't let Tembak make changes. Give the Tembak integration the Insert content and Update content capabilities, then try again.";

const bare = (id: string) => id.replace(/-/g, "").toLowerCase();

/** A page id from an id or a Notion URL (the notion_url column). */
function pageIdFrom(value: string): string | null {
  const m = /([0-9a-f]{32})(?:[?#/]|$)/i.exec(value.replace(/-/g, ""));
  return m ? m[1].toLowerCase() : null;
}

async function notion<T>(workspaceId: string, fn: (token: string) => Promise<T>): Promise<T> {
  await requireConnection(workspaceId, "notion");
  try {
    return await withAccessToken(workspaceId, "notion", notionRefresh, fn);
  } catch (err) {
    if (err instanceof SourceFetchError && /insufficient permissions|restricted/i.test(err.message)) {
      throw new HttpError(403, CAPABILITIES);
    }
    throw err;
  }
}

type NotionSource = Source & { config: Extract<SourceConfig, { kind: "notion" }> };

function notionSources(ctx: ActionContext): NotionSource[] {
  return ctx.sources.filter((s): s is NotionSource => s.config.kind === "notion");
}

const sourceFor = (sources: NotionSource[], dataSourceId: string) =>
  sources.find((s) => bare(s.config.dataSourceId) === bare(dataSourceId));

/** The app's Notion source for a sourceKey or data source id, or a 403. */
function targetSource(ctx: ActionContext, input: { sourceKey?: string; dataSourceId?: string }) {
  if (input.sourceKey) {
    const source = ownSource(ctx, input.sourceKey);
    if (source.config.kind !== "notion") throw new HttpError(400, `"${source.key}" isn't a Notion database.`);
    return { source, dataSourceId: source.config.dataSourceId };
  }
  const source = sourceFor(notionSources(ctx), input.dataSourceId!);
  if (!source) {
    throw new HttpError(403, "This app can only change the Notion databases it was built with.");
  }
  return { source, dataSourceId: source.config.dataSourceId };
}

const text = (v: Value) => (v === null ? [] : [{ type: "text", text: { content: String(v).slice(0, 2000) } }]);

/** One plain value as a Notion property payload for its type. */
function propertyValue(name: string, type: string, v: Value): unknown {
  const bad = (what: string): never => {
    throw new HttpError(400, `"${name}" needs ${what}.`);
  };
  const str = (x: Value) => (x === null ? null : Array.isArray(x) ? x.join(", ") : String(x));
  switch (type) {
    case "title":
    case "rich_text":
      return text(Array.isArray(v) ? v.join(", ") : v);
    case "number": {
      if (v === null || v === "") return null;
      const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
      return Number.isFinite(n) ? n : bad("a number");
    }
    case "checkbox":
      if (typeof v === "boolean") return v;
      if (v === "true" || v === "false") return v === "true";
      return bad("true or false");
    case "select":
    case "status":
      return v === null || v === "" ? null : { name: str(v)!.slice(0, 100) };
    case "multi_select": {
      const names = v === null ? [] : Array.isArray(v) ? v : String(v).split(",");
      return names.map((n) => n.trim()).filter(Boolean).map((n) => ({ name: n.slice(0, 100) }));
    }
    case "date": {
      if (v === null || v === "") return null;
      const s = String(v);
      return Number.isNaN(Date.parse(s)) ? bad("a date like 2026-10-18") : { start: s };
    }
    case "url":
    case "email":
    case "phone_number":
      return v === null || v === "" ? null : str(v);
    default:
      throw new HttpError(400, `Tembak can't set "${name}" (a ${type.replace(/_/g, " ")} property) yet.`);
  }
}

/** Maps { name or column key: value } onto the schema's properties. */
export function notionProperties(input: Record<string, Value>, schema: Schema): Record<string, unknown> {
  const names = Object.keys(schema);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const lower = key.toLowerCase();
    const name =
      names.find((n) => n === key) ??
      names.find((n) => n.toLowerCase() === lower) ??
      names.find((n, i) => columnKey(n, i) === key);
    if (!name) throw new HttpError(400, `Notion has no "${key}" property here. Properties: ${names.join(", ")}.`);
    out[name] = { [schema[name].type]: propertyValue(name, schema[name].type, value) };
  }
  return out;
}

const properties = valueMap(notionValue);

export const NOTION_ACTIONS = {
  "notion.createPage": action({
    provider: "notion",
    input: z
      .strictObject({
        sourceKey: z.string().min(1).max(100).optional(),
        dataSourceId: z.string().min(1).max(64).optional(),
        properties,
      })
      .refine((i) => i.sourceKey || i.dataSourceId, "Give the sourceKey of the Notion database to add to"),
    run: async (input, ctx) => {
      const { source, dataSourceId } = targetSource(ctx, input);
      const page = await notion(ctx.workspaceId, async (token) => {
        const ds = (await request(token, `/data_sources/${encodeURIComponent(dataSourceId)}`)) as { properties: Schema };
        return (await request(token, "/pages", {
          parent: { type: "data_source_id", data_source_id: dataSourceId },
          properties: notionProperties(input.properties, ds.properties),
        })) as { id: string; url: string };
      });
      invalidateSourceRows(source.id);
      return { id: page.id, url: page.url };
    },
  }),

  "notion.updatePage": action({
    provider: "notion",
    input: z.strictObject({ pageId: z.string().min(1).max(300), properties }),
    run: async (input, ctx) => {
      const pageId = pageIdFrom(input.pageId);
      if (!pageId) throw new HttpError(400, "pageId should be a Notion page id or the row's notion_url.");
      const allowed = notionSources(ctx);
      if (!allowed.length) throw new HttpError(403, "This app can only change the Notion databases it was built with.");
      const { page, source } = await notion(ctx.workspaceId, async (token) => {
        let current: { id: string; parent?: { data_source_id?: string }; properties: Schema };
        try {
          current = (await request(token, `/pages/${pageId}`)) as typeof current;
        } catch (err) {
          if (err instanceof SourceFetchError && /couldn't find/i.test(err.message)) {
            throw new HttpError(404, "Notion couldn't find that page, or Tembak isn't connected to its database.");
          }
          throw err;
        }
        // The page must be a row of one of the app's own databases.
        const parent = current.parent?.data_source_id;
        const source = parent ? sourceFor(allowed, parent) : undefined;
        if (!source) throw new HttpError(403, "This app can only change pages in the Notion databases it was built with.");
        const page = (await request(
          token,
          `/pages/${pageId}`,
          { properties: notionProperties(input.properties, current.properties) },
          "PATCH",
        )) as { id: string; url: string };
        return { page, source };
      });
      invalidateSourceRows(source.id);
      return { id: page.id, url: page.url };
    },
  }),
};
