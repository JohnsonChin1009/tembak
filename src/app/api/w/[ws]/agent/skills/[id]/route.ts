import { handle, json } from "@/lib/api";
import { requireConfigurer } from "@/lib/permissions";
import { getStore } from "@/lib/store";

export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/w/[ws]/agent/skills/[id]">) => {
  const { ws, id } = await ctx.params;
  const { workspace } = await requireConfigurer(ws);
  await (await getStore()).deleteSkill(workspace.id, id);
  return json({ ok: true });
});
