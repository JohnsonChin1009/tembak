import { getSessionUser } from "@/lib/auth/session";
import { messageStream } from "@/lib/sse";
import { getStore } from "@/lib/store";
import { membership } from "@/lib/workspaces";

export const maxDuration = 300;

/** Live replies in one thread, in the same event format as the channel stream. */
export async function GET(req: Request, ctx: RouteContext<"/api/w/[ws]/channels/[id]/threads/[threadId]/stream">) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { ws, id: channelId, threadId } = await ctx.params;
  const store = await getStore();
  const m = await membership(user, await store.getWorkspaceBySlug(ws));
  if (!m) return Response.json({ error: "Workspace not found" }, { status: 404 });
  return messageStream(req, (listener) => store.subscribeReplies(m.workspace.id, channelId, threadId, listener));
}
