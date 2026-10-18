import { z } from "zod";
import { handle, HttpError, json, parseBody } from "@/lib/api";
import { randomId } from "@/lib/ids";
import { requireConfigurer } from "@/lib/permissions";
import { getStore } from "@/lib/store";
import type { Skill } from "@/lib/types";

const MAX_SKILLS = 20;

const body = z.object({
  id: z.string().max(40).optional(),
  name: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{0,39}$/, "Use lowercase letters, numbers, and dashes (e.g. weekly-report)"),
  description: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(4000),
});

/** Create or update a workspace skill. A skill named like a built-in overrides it. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/w/[ws]/agent/skills">) => {
  const { user, workspace } = await requireConfigurer((await ctx.params).ws);
  const input = await parseBody(req, body);
  const store = await getStore();
  const existing = await store.listSkills(workspace.id);
  const current = existing.find((s) => s.id === input.id);
  if (existing.some((s) => s.name === input.name && s.id !== current?.id)) {
    throw new HttpError(409, `There's already a skill named "${input.name}"`);
  }
  if (!current && existing.length >= MAX_SKILLS) throw new HttpError(400, `Up to ${MAX_SKILLS} skills per workspace`);
  const skill: Skill = {
    id: current?.id ?? randomId(),
    workspaceId: workspace.id,
    name: input.name,
    description: input.description,
    body: input.body,
    createdBy: current?.createdBy ?? user.uid,
    updatedAt: Date.now(),
  };
  await store.upsertSkill(skill);
  return json(skill, { status: current ? 200 : 201 });
});
