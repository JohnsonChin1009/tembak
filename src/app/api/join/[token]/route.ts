import { handle, HttpError, json, requireUser } from "@/lib/api";
import { getStore } from "@/lib/store";
import { joinWorkspace } from "@/lib/workspaces";

export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/join/[token]">) => {
  const user = await requireUser();
  const { token } = await ctx.params;
  const ws = await (await getStore()).getWorkspaceByInvite(token);
  if (!ws || ws.open) throw new HttpError(404, "This invite link is no longer valid");
  await joinWorkspace(ws, user);
  return json({ slug: ws.slug });
});
