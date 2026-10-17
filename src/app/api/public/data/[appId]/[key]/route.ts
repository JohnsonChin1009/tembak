import { SourceFetchError, sourceRows } from "@/lib/data/fetch";
import { preflight, publicError, publicJson } from "@/lib/public-api";
import { getStore } from "@/lib/store";

export const OPTIONS = preflight;

export async function GET(_req: Request, ctx: RouteContext<"/api/public/data/[appId]/[key]">) {
  const { appId, key } = await ctx.params;
  const store = await getStore();
  const app = await store.getApp(appId);
  if (!app) return publicError(404, "Unknown app");
  // Apps can only read the sources they were built with.
  if (!app.sourceKeys.includes(key)) return publicError(403, `This app isn't connected to "${key}"`);
  const source = await store.getSourceByKey(key);
  if (!source) return publicError(404, `Data source "${key}" was removed`);
  try {
    const rows = await sourceRows(source);
    return publicJson(rows, { headers: { "cache-control": "public, max-age=30" } });
  } catch (err) {
    console.error("[data] fetch failed", key, err);
    return publicError(502, err instanceof SourceFetchError ? err.message : "Couldn't load data right now");
  }
}
