import { handle, json } from "@/lib/api";
import { getStore } from "@/lib/store";
import { DEMO_WORKSPACE_ID, inviteUrl, requireMember, workspaceInfo } from "@/lib/workspaces";

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
