import { z } from "zod";
import { handle, HttpError, json, parseBody } from "@/lib/api";
import { getStore } from "@/lib/store";
import { DEMO_WORKSPACE_ID, inviteUrl, requireMember, requireOwner, workspaceInfo } from "@/lib/workspaces";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/w/[ws]">) => {
  const m = await requireMember((await ctx.params).ws);
  const members = await (await getStore()).listMembers(m.workspace.id);
  return json({
    workspace: workspaceInfo(m),
    // Open workspaces don't need invites; anyone signed in can join.
    inviteUrl: m.workspace.open ? null : inviteUrl(m.workspace),
    canReset: m.workspace.id === DEMO_WORKSPACE_ID && m.role === "owner",
    // Onboarding progress is private to each member.
    members: members.map((member) => ({ ...member, onboarding: undefined })),
  });
});

/** Owners delete a workspace for good. The body must repeat the workspace name. */
export const DELETE = handle(async (req: Request, ctx: RouteContext<"/api/w/[ws]">) => {
  const { workspace } = await requireOwner((await ctx.params).ws);
  if (workspace.id === DEMO_WORKSPACE_ID) throw new HttpError(400, "The demo workspace can't be deleted");
  const { confirm } = await parseBody(req, z.object({ confirm: z.string() }));
  if (confirm.trim() !== workspace.name) throw new HttpError(400, "Type the workspace name to confirm");
  await (await getStore()).deleteWorkspace(workspace.id);
  return json({ ok: true });
});
