import { handle, HttpError, json } from "@/lib/api";
import { getStore } from "@/lib/store";
import { requireMember } from "@/lib/workspaces";

/** One member's public profile, for the hover card and profile sheet in chat. */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/w/[ws]/members/[uid]">) => {
  const { ws, uid } = await ctx.params;
  const { workspace } = await requireMember(ws);
  const member = await (await getStore()).getMember(workspace.id, uid);
  if (!member) throw new HttpError(404, "Not a member");
  return json({ ...member, onboarding: undefined });
});
