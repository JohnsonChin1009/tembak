import { z } from "zod";
import { HttpError, parseBody } from "@/lib/api";
import { randomId } from "@/lib/ids";
import { preflight, publicJson } from "@/lib/public-api";
import { limit } from "@/lib/rate-limit";
import { callerPerson, handleRuntime, requireRuntimeCaller } from "@/lib/runtime-auth";
import { getStore } from "@/lib/store";
import type { Message } from "@/lib/types";

export const OPTIONS = preflight;

const TOO_MANY = "This app has posted a lot recently. Try again in a few minutes.";

/**
 * tembak.post(text, { thread }): the app says something in its channel on behalf
 * of the member using it. Never reaches the agent, whatever the text says.
 */
export const POST = handleRuntime(async (req: Request, ctx: RouteContext<"/api/runtime/[appId]/post">) => {
  const caller = await requireRuntimeCaller(req, (await ctx.params).appId);
  const { app, workspaceId, uid } = caller;
  const body = await parseBody(
    req,
    z.object({
      text: z.string().trim().min(1, "Write something to post").max(1000, "Posts are limited to 1,000 characters"),
      thread: z.boolean().optional(),
    }),
  );
  if (!limit(`post:${app.id}:${uid}`, 10, 10 * 60_000) || !limit(`post:${app.id}`, 60, 60 * 60_000)) {
    throw new HttpError(429, TOO_MANY);
  }

  const store = await getStore();
  const [channel, members, person] = await Promise.all([
    store.getChannel(workspaceId, app.channelId),
    store.listMembers(workspaceId),
    callerPerson(caller),
  ]);
  if (!channel) throw new HttpError(404, "This app's channel no longer exists.");

  // Only real members can be tagged; any other tag reads as plain text.
  const uids = new Set(members.map((m) => m.uid));
  const text = body.text.replace(/<@([A-Za-z0-9_-]+)>/g, (tag, id: string) => (uids.has(id) ? tag : "@someone"));

  let threadId: string | undefined;
  if (body.thread) {
    // The thread under the agent message that introduced the app. When it's out
    // of reach (very old, or the app was built inside a thread), post top-level.
    const recent = await store.listMessages(workspaceId, app.channelId, 200);
    threadId = recent.find((m) => m.author.kind === "agent" && m.appRef?.appId === app.id)?.id;
  }

  const message: Message = {
    id: randomId(),
    workspaceId,
    channelId: app.channelId,
    createdAt: Date.now(),
    author: { kind: "app", appId: app.id, appTitle: app.title, uid, name: person.name },
    text,
    // Never an agent trigger, even when the text says "@tembak".
    mentionsAgent: false,
    appRef: { appId: app.id, version: app.latestVersion },
    threadId,
  };
  await store.addMessage(message);
  return publicJson({ id: message.id, threadId: threadId ?? null }, { status: 201 });
});
