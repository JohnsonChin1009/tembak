import { z } from "zod";
import { handle, json, parseBody } from "@/lib/api";
import { getStore } from "@/lib/store";
import { requireMember } from "@/lib/workspaces";

const Body = z
  .object({
    step: z.enum(["mention", "preview", "revise", "publish", "invite"]).optional(),
    hint: z.string().regex(/^[a-z-]{1,32}$/).optional(),
    dismissed: z.boolean().optional(),
  })
  .refine((b) => b.step || b.hint || b.dismissed !== undefined, "Nothing to update");

/** Records the signed-in member's onboarding progress in this workspace. */
export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/w/[ws]/me/onboarding">) => {
  const { workspace, user } = await requireMember((await ctx.params).ws);
  const patch = await parseBody(req, Body);
  await (await getStore()).updateOnboarding(workspace.id, user.uid, patch);
  return json({ ok: true });
});
