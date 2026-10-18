import { getSessionUser } from "@/lib/auth/session";
import { messageStream } from "@/lib/sse";
import { getStore } from "@/lib/store";
import { membership } from "@/lib/workspaces";

export const maxDuration = 300;

export async function GET(req: Request, ctx: RouteContext<"/api/w/[ws]/channels/[id]/stream">) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { ws, id: channelId } = await ctx.params;
  const store = await getStore();
  const m = await membership(user, await store.getWorkspaceBySlug(ws));
  if (!m) return Response.json({ error: "Workspace not found" }, { status: 404 });
  return messageStream(req, (listener) => store.subscribeMessages(m.workspace.id, channelId, listener));
}
