import { SourceFetchError, sourceRows } from "@/lib/data/fetch";
import { preflight, publicError, publicJson } from "@/lib/public-api";
import { requireRuntimeCaller, RuntimeAuthError } from "@/lib/runtime-auth";
import { getStore } from "@/lib/store";

export const OPTIONS = preflight;

export async function GET(req: Request, ctx: RouteContext<"/api/public/data/[appId]/[key]">) {
  const { appId, key } = await ctx.params;
  let app;
  try {
    ({ app } = await requireRuntimeCaller(req, appId));
  } catch (err) {
    if (err instanceof RuntimeAuthError) return publicError(err.status, err.message);
    throw err;
  }
  const store = await getStore();
  // Apps can only read the sources they were built with.
  if (!app.sourceKeys.includes(key)) return publicError(403, `This app isn't connected to "${key}"`);
  // Sources are looked up in the app's own workspace only.
  const source = await store.getSourceByKey(app.workspaceId, key);
  if (!source) return publicError(404, `Data source "${key}" was removed`);
  try {
    const rows = await sourceRows(source);
    return publicJson(rows, { headers: { "cache-control": "private, max-age=30" } });
  } catch (err) {
    console.error("[data] fetch failed", key, err);
    return publicError(502, err instanceof SourceFetchError ? err.message : "Couldn't load data right now");
  }
}
