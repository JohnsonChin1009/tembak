import { z } from "zod";
import { handle, json, parseBody } from "@/lib/api";
import { kebab } from "@/lib/ids";
import { getStore } from "@/lib/store";
import type { Channel } from "@/lib/types";
import { requireMember } from "@/lib/workspaces";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/w/[ws]/channels">) => {
  const { workspace } = await requireMember((await ctx.params).ws);
  return json(await (await getStore()).listChannels(workspace.id));
});

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/w/[ws]/channels">) => {
  const { user, workspace } = await requireMember((await ctx.params).ws);
  const body = await parseBody(
    req,
    z.object({ name: z.string().min(1).max(40), topic: z.string().max(200).optional() }),
  );
  const store = await getStore();
  const id = kebab(body.name, 32);
  const existing = await store.getChannel(workspace.id, id);
  if (existing) return json(existing);

  const channel: Channel = {
    id,
    workspaceId: workspace.id,
    name: id,
    topic: body.topic,
    createdAt: Date.now(),
    createdBy: user.uid,
  };
  await store.createChannel(channel);
  return json(channel, { status: 201 });
});
