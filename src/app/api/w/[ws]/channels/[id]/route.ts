import { z } from "zod";
import { handle, HttpError, json, parseBody } from "@/lib/api";
import { kebab } from "@/lib/ids";
import { getStore } from "@/lib/store";
import { requireMember } from "@/lib/workspaces";

/**
 * Renames a channel or changes its topic. The id (and so the URL) stays the
 * same; only the display name changes, so links and messages keep working.
 */
export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/w/[ws]/channels/[id]">) => {
  const { ws, id } = await ctx.params;
  const { workspace, role } = await requireMember(ws);
  // The shared demo stays as curated: only its maintainers can rename channels.
  if (workspace.open && role !== "owner") throw new HttpError(403, "Only demo maintainers can rename channels");
  const body = await parseBody(
    req,
    z.object({ name: z.string().max(40).optional(), topic: z.string().max(200).optional() }),
  );
  const store = await getStore();
  const channel = await store.getChannel(workspace.id, id);
  if (!channel) throw new HttpError(404, "Channel not found");

  const patch: { name?: string; topic?: string } = {};
  if (body.name !== undefined) {
    const name = kebab(body.name, 32);
    if (!name) throw new HttpError(400, "Channel name can't be empty");
    const taken = (await store.listChannels(workspace.id)).some((c) => c.id !== id && (c.name === name || c.id === name));
    if (taken) throw new HttpError(409, `#${name} already exists`);
    patch.name = name;
  }
  if (body.topic !== undefined) patch.topic = body.topic.trim();
  await store.updateChannel(workspace.id, id, patch);
  return json({ ...channel, ...patch });
});

/**
 * Deletes a channel and its messages, threads, and workflows. Apps built there
 * move to the first remaining channel so their links and posts keep working.
 * Owners and the channel's creator can delete; the last channel stays.
 */
export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/w/[ws]/channels/[id]">) => {
  const { ws, id } = await ctx.params;
  const { user, workspace, role } = await requireMember(ws);
  const store = await getStore();
  const channel = await store.getChannel(workspace.id, id);
  if (!channel) throw new HttpError(404, "Channel not found");
  const canDelete = role === "owner" || (!workspace.open && channel.createdBy === user.uid);
  if (!canDelete) throw new HttpError(403, "Only workspace owners and the person who made a channel can delete it");

  const fallback = (await store.listChannels(workspace.id)).find((c) => c.id !== id);
  if (!fallback) throw new HttpError(400, "A workspace needs at least one channel");

  const apps = (await store.listApps(workspace.id)).filter((a) => a.channelId === id);
  await Promise.all(apps.map((a) => store.updateApp(a.id, { channelId: fallback.id })));
  await store.deleteChannel(workspace.id, id);
  return json({ ok: true, fallback: fallback.id, movedApps: apps.length });
});
