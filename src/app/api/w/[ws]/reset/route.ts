import { handle, HttpError, json } from "@/lib/api";
import { getStore } from "@/lib/store";
import { seedDemoContent } from "@/lib/store/seed";
import { DEMO_WORKSPACE_ID, requireOwner } from "@/lib/workspaces";

/** Demo maintainers wipe what visitors built and restore the curated seed. */
export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/w/[ws]/reset">) => {
  const { workspace } = await requireOwner((await ctx.params).ws);
  if (workspace.id !== DEMO_WORKSPACE_ID) throw new HttpError(400, "Only the demo workspace can be reset");
  const store = await getStore();
  await store.clearWorkspace(workspace.id);
  await seedDemoContent(store);
  return json({ ok: true });
});
