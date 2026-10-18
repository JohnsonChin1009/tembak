import { handle, HttpError, json } from "@/lib/api";
import { getStore } from "@/lib/store";
import { requireAppAccess } from "@/lib/workspaces";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/apps/[id]/versions/[n]">) => {
  const { id, n } = await ctx.params;
  await requireAppAccess(id);
  const version = await (await getStore()).getVersion(id, Number(n));
  if (!version) throw new HttpError(404, "Version not found");
  // Versions are immutable, so the browser can cache them.
  return json(version, { headers: { "cache-control": "private, max-age=86400, immutable" } });
});
