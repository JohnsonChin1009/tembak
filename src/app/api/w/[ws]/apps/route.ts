import { handle, json } from "@/lib/api";
import { getStore } from "@/lib/store";
import { requireMember } from "@/lib/workspaces";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/w/[ws]/apps">) => {
  const { workspace } = await requireMember((await ctx.params).ws);
  return json(await (await getStore()).listApps(workspace.id));
});
