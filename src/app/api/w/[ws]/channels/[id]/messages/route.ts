import { after } from "next/server";
import { z } from "zod";
import { handle, HttpError, json, parseBody } from "@/lib/api";
import { startAgentRun } from "@/lib/agent/run";
import { randomId } from "@/lib/ids";
import { mentionsAgent, taggedUids } from "@/lib/mentions";
import { getStore } from "@/lib/store";
import type { Message } from "@/lib/types";
import { requireMember } from "@/lib/workspaces";

export const maxDuration = 300;

type Ctx = RouteContext<"/api/w/[ws]/channels/[id]/messages">;

export const GET = handle(async (req: Request, ctx: Ctx) => {
  const { ws, id } = await ctx.params;
  const { workspace } = await requireMember(ws);
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") ?? 100) || 100, 200);
  return json(await (await getStore()).listMessages(workspace.id, id, limit));
});

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { ws, id: channelId } = await ctx.params;
  const { user, workspace } = await requireMember(ws);
  const body = await parseBody(
    req,
    z.object({
      // Client-generated id so optimistic messages reconcile with the stream.
      id: z.string().regex(/^[a-z0-9]{8,32}$/).optional(),
      text: z.string().trim().min(1).max(8000),
      appRef: z.object({ appId: z.string(), version: z.number().int().positive() }).optional(),
      /** Reply in the thread under this channel message. */
      threadId: z.string().max(64).optional(),
    }),
  );

  const store = await getStore();
  if (!(await store.getChannel(workspace.id, channelId))) throw new HttpError(404, "Channel not found");
  if (body.threadId) {
    const parent = await store.getMessage(workspace.id, channelId, body.threadId);
    if (!parent) throw new HttpError(404, "Message not found");
  }
  if (body.appRef) {
    const app = await store.getApp(body.appRef.appId);
    if (app?.workspaceId !== workspace.id) throw new HttpError(404, "App not found");
  }

  const message: Message = {
    id: body.id ?? randomId(),
    workspaceId: workspace.id,
    channelId,
    createdAt: Date.now(),
    author: { kind: "user", uid: user.uid, name: user.name, photoUrl: user.photoUrl },
    text: body.text,
    // Requests from the builder panel always go to the agent.
    mentionsAgent: !!body.appRef || mentionsAgent(body.text),
    appRef: body.appRef,
    threadId: body.threadId,
  };
  await store.addMessage(message);

  // Tagged members see the channel marked in their sidebar. Tags of non-members are just text.
  const tagged = taggedUids(message.text).filter((uid) => uid !== user.uid);
  if (tagged.length) {
    const members = await Promise.all(tagged.map((uid) => store.getMember(workspace.id, uid)));
    await store.addMentions(workspace.id, channelId, tagged.filter((_, i) => members[i]));
  }

  if (message.mentionsAgent) {
    after(() => startAgentRun(message));
  }
  return json(message, { status: 201 });
});
