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
