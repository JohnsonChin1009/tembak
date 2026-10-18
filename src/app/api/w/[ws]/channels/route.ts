import { z } from "zod";
import { handle, json, parseBody, requireUser } from "@/lib/api";
import { kebab } from "@/lib/ids";
import { getStore } from "@/lib/store";
import type { Channel } from "@/lib/types";

export const GET = handle(async () => {
  await requireUser();
  return json(await (await getStore()).listChannels());
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = await parseBody(
    req,
    z.object({ name: z.string().min(1).max(40), topic: z.string().max(200).optional() }),
  );
  const store = await getStore();
  const id = kebab(body.name, 32);
  const existing = await store.getChannel(id);
  if (existing) return json(existing);

  const channel: Channel = {
    id,
    name: id,
    topic: body.topic,
    createdAt: Date.now(),
    createdBy: user.uid,
  };
  await store.createChannel(channel);
  return json(channel, { status: 201 });
});
