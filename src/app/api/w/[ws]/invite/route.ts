import { handle, HttpError, json } from "@/lib/api";
import { getStore } from "@/lib/store";
import { inviteUrl, newInviteToken, requireOwner } from "@/lib/workspaces";

/** Rotates the invite token so links already shared stop working. */
export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/w/[ws]/invite">) => {
  const { workspace } = await requireOwner((await ctx.params).ws);
  if (workspace.open) throw new HttpError(400, "Open workspaces don't use invite links");
  const inviteToken = newInviteToken();
  await (await getStore()).updateWorkspace(workspace.id, { inviteToken });
  return json({ inviteUrl: inviteUrl({ ...workspace, inviteToken }) });
});
