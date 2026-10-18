import { handle, HttpError, json } from "@/lib/api";
import { getStore } from "@/lib/store";
import { requireMember } from "@/lib/workspaces";

export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/w/[ws]/sources/[id]">) => {
  const { ws, id } = await ctx.params;
  const { workspace } = await requireMember(ws);
  const store = await getStore();
  if (!(await store.getSource(workspace.id, id))) throw new HttpError(404, "Source not found");
  await store.deleteSource(workspace.id, id);
  return json({ ok: true });
});
