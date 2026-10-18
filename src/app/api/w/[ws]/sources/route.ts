import { z } from "zod";
import { handle, HttpError, json, parseBody } from "@/lib/api";
import { SourceFetchError } from "@/lib/data/fetch";
import { createSource, redact } from "@/lib/data/sources";
import { getStore } from "@/lib/store";
import { requireMember } from "@/lib/workspaces";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/w/[ws]/sources">) => {
  const { workspace } = await requireMember((await ctx.params).ws);
  return json((await (await getStore()).listSources(workspace.id)).map(redact));
});

const body = z.object({
  name: z.string().trim().min(1).max(80),
  config: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("sheet"), url: z.string().url(), range: z.string().max(100).optional() }),
    z.object({ kind: z.literal("csv"), text: z.string().min(1).max(1_000_000) }),
    z.object({
      kind: z.literal("json"),
      url: z.string().url(),
      headerName: z.string().max(100).optional(),
      headerValue: z.string().max(2000).optional(),
    }),
  ]),
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
