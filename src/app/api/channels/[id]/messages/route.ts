import { after } from "next/server";
import { z } from "zod";
import { handle, HttpError, json, parseBody, requireUser } from "@/lib/api";
import { startAgentRun } from "@/lib/agent/run";
import { randomId } from "@/lib/ids";
import { mentionsAgent } from "@/lib/mentions";
import { getStore } from "@/lib/store";
import type { Message } from "@/lib/types";

export const maxDuration = 300;

export const GET = handle(async (req: Request, ctx: RouteContext<"/api/channels/[id]/messages">) => {
  await requireUser();
  const { id } = await ctx.params;
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") ?? 100) || 100, 200);
  return json(await (await getStore()).listMessages(id, limit));
});

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/channels/[id]/messages">) => {
  const user = await requireUser();
  const { id: channelId } = await ctx.params;
  const body = await parseBody(
    req,
    z.object({
      // Client-generated id so optimistic messages reconcile with the stream.
      id: z.string().regex(/^[a-z0-9]{8,32}$/).optional(),
      text: z.string().trim().min(1).max(8000),
      appRef: z.object({ appId: z.string(), version: z.number().int().positive() }).optional(),
    }),
  );

  const store = await getStore();
  if (!(await store.getChannel(channelId))) throw new HttpError(404, "Channel not found");

  const message: Message = {
    id: body.id ?? randomId(),
    channelId,
    createdAt: Date.now(),
    author: { kind: "user", uid: user.uid, name: user.name, photoUrl: user.photoUrl },
    text: body.text,
    // Requests from the builder panel always go to the agent.
    mentionsAgent: !!body.appRef || mentionsAgent(body.text),
    appRef: body.appRef,
  };
  await store.addMessage(message);

  if (message.mentionsAgent) {
    after(() => startAgentRun(message));
  }
  return json(message, { status: 201 });
});
