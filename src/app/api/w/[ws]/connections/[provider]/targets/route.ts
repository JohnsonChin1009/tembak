import { handle, HttpError, json } from "@/lib/api";
import { isProvider } from "@/lib/connectors";
import { linearTeams } from "@/lib/connectors/linear";
import { notionDataSources } from "@/lib/connectors/notion";
import { SourceFetchError } from "@/lib/data/errors";
import { requireMember } from "@/lib/workspaces";

/** What the picker offers after connecting: Notion databases, or Linear teams. */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/w/[ws]/connections/[provider]/targets">) => {
  const params = await ctx.params;
  if (!isProvider(params.provider)) throw new HttpError(404, "Unknown connector");
  const { workspace } = await requireMember(params.ws);
  try {
    if (params.provider === "notion") return json({ databases: await notionDataSources(workspace.id) });
    return json({ teams: await linearTeams(workspace.id) });
  } catch (err) {
    if (err instanceof SourceFetchError) throw new HttpError(422, err.message);
    throw err;
  }
});
