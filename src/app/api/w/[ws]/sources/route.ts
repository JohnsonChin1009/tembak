import { z } from "zod";
import { handle, HttpError, json, parseBody } from "@/lib/api";
import { SourceFetchError } from "@/lib/data/fetch";
import { sourceConfigSchema } from "@/lib/data/schema";
import { createSource, redact } from "@/lib/data/sources";
import { getStore } from "@/lib/store";
import { requireMember } from "@/lib/workspaces";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/w/[ws]/sources">) => {
  const { workspace } = await requireMember((await ctx.params).ws);
  return json((await (await getStore()).listSources(workspace.id)).map(redact));
});

const body = z.object({
  name: z.string().trim().min(1).max(80),
  config: sourceConfigSchema,
});

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/w/[ws]/sources">) => {
  const { user, workspace } = await requireMember((await ctx.params).ws);
  const input = await parseBody(req, body);
  try {
    const source = await createSource({ ...input, workspaceId: workspace.id, createdBy: user.uid });
    return json(redact(source), { status: 201 });
  } catch (err) {
    if (err instanceof SourceFetchError) throw new HttpError(422, err.message);
    throw err;
  }
});
