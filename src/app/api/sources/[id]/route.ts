import { handle, HttpError, json, requireUser } from "@/lib/api";
import { getStore } from "@/lib/store";

export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/sources/[id]">) => {
  await requireUser();
  const { id } = await ctx.params;
  const store = await getStore();
  if (!(await store.getSource(id))) throw new HttpError(404, "Source not found");
  await store.deleteSource(id);
  return json({ ok: true });
});
