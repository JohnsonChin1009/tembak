import { z } from "zod";
import { handle, HttpError, json, parseBody } from "@/lib/api";
import { config } from "@/lib/config";
import { randomId } from "@/lib/ids";
import { getStore } from "@/lib/store";
import { requireAppAccess } from "@/lib/workspaces";

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/apps/[id]/publish">) => {
  const { id } = await ctx.params;
  const { user, app } = await requireAppAccess(id);
  const { version } = await parseBody(req, z.object({ version: z.number().int().positive() }));

  const store = await getStore();
  if (!(await store.getVersion(id, version))) throw new HttpError(404, "Version not found");

  const wasLive = !!app.publishedVersion;
  await store.updateApp(id, { publishedVersion: version, updatedAt: Date.now() });
  const url = `${config().appsUrl}/a/${app.slug}`;

  await store.addMessage({
    id: randomId(),
    workspaceId: app.workspaceId,
    channelId: app.channelId,
    createdAt: Date.now(),
    author: { kind: "agent" },
    text: wasLive
      ? `**${app.title}** v${version} is now live (updated by ${user.name}): ${url}`
      : `🚀 **${app.title}** is live! ${user.name} just published it: ${url}`,
    mentionsAgent: false,
    status: "done",
    appRef: { appId: id, version },
  });

  return json({ url, app: { ...app, publishedVersion: version } });
});

export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/apps/[id]/publish">) => {
  const { id } = await ctx.params;
  const { app } = await requireAppAccess(id);
  const store = await getStore();
  // Firestore merge ignores undefined, so store 0 to mean "not published".
  await store.updateApp(id, { publishedVersion: 0, updatedAt: Date.now() });
  return json({ app: { ...app, publishedVersion: 0 } });
});
