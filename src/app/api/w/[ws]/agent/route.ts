import { z } from "zod";
import { handle, json, parseBody } from "@/lib/api";
import { BUILTIN_SKILLS } from "@/lib/agent/skills";
import { canConfigure, requireConfigurer } from "@/lib/permissions";
import { getStore } from "@/lib/store";
import { requireMember } from "@/lib/workspaces";

const MAX_RULES = 2000;

/** Agent settings: team rules plus workspace and built-in skills. */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/w/[ws]/agent">) => {
  const m = await requireMember((await ctx.params).ws);
  const skills = await (await getStore()).listSkills(m.workspace.id);
  return json({
    rules: m.workspace.agentRules ?? "",
    skills,
    builtins: BUILTIN_SKILLS.map(({ name, description }) => ({ name, description })),
    canEdit: canConfigure(m),
  });
});

const body = z.object({ rules: z.string().max(MAX_RULES) });

export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/w/[ws]/agent">) => {
  const { workspace } = await requireConfigurer((await ctx.params).ws);
  const { rules } = await parseBody(req, body);
  await (await getStore()).updateWorkspace(workspace.id, { agentRules: rules.trim() });
  return json({ rules: rules.trim() });
});
