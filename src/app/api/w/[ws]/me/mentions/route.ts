import { z } from "zod";
import { handle, json, parseBody } from "@/lib/api";
import { getStore } from "@/lib/store";
import { requireMember } from "@/lib/workspaces";

type Ctx = RouteContext<"/api/w/[ws]/me/mentions">;

/** The signed-in member's unread tags in this workspace, by channel id. */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { workspace, user } = await requireMember((await ctx.params).ws);
  return json(await (await getStore()).getMentions(workspace.id, user.uid));
});

/** Marks a channel's tags as read. */
export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const { workspace, user } = await requireMember((await ctx.params).ws);
  const { channelId } = await parseBody(req, z.object({ channelId: z.string().min(1).max(64) }));
  await (await getStore()).clearMentions(workspace.id, user.uid, channelId);
  return json({ ok: true });
});
