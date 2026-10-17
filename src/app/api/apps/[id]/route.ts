import { handle, HttpError, json, requireUser } from "@/lib/api";
import { getStore } from "@/lib/store";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/apps/[id]">) => {
  await requireUser();
  const { id } = await ctx.params;
  const store = await getStore();
  const app = await store.getApp(id);
  if (!app) throw new HttpError(404, "App not found");
  return json({ app, versions: await store.listVersions(id) });
});
