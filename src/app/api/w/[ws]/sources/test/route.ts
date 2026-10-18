import { z } from "zod";
import { handle, HttpError, json, parseBody } from "@/lib/api";
import { SourceFetchError } from "@/lib/data/fetch";
import { sourceConfigSchema } from "@/lib/data/schema";
import { previewSource } from "@/lib/data/sources";
import { requireMember } from "@/lib/workspaces";

const body = z.object({ config: sourceConfigSchema });

/** "Test connection": fetches the source without saving it. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/w/[ws]/sources/test">) => {
  const { workspace } = await requireMember((await ctx.params).ws);
  const { config } = await parseBody(req, body);
  try {
    return json(await previewSource(workspace.id, config));
  } catch (err) {
    if (err instanceof SourceFetchError) throw new HttpError(422, err.message);
    throw err;
  }
});
