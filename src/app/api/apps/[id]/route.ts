import { handle, json } from "@/lib/api";
import { getStore } from "@/lib/store";
import { requireAppAccess } from "@/lib/workspaces";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/apps/[id]">) => {
  const { app } = await requireAppAccess((await ctx.params).id);
  return json({ app, versions: await (await getStore()).listVersions(app.id) });
});
