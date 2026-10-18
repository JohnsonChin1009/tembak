import { HttpError } from "@/lib/api";
import { preflight, publicJson } from "@/lib/public-api";
import { limit } from "@/lib/rate-limit";
import { handleRuntime, requireRuntimeCaller, runtimePerson } from "@/lib/runtime-auth";
import { getStore } from "@/lib/store";

export const OPTIONS = preflight;

/** tembak.members(): everyone in the app's workspace, for owner pickers and avatars. */
export const GET = handleRuntime(async (req: Request, ctx: RouteContext<"/api/runtime/[appId]/members">) => {
  const { workspaceId, uid } = await requireRuntimeCaller(req, (await ctx.params).appId);
  if (!limit(`runtime-read:${uid}`, 120, 60_000)) throw new HttpError(429, "Too many requests, try again in a minute.");
  const members = await (await getStore()).listMembers(workspaceId);
  const people = members.map(runtimePerson).sort((a, b) => a.name.localeCompare(b.name));
  return publicJson(people, { headers: { "cache-control": "no-store" } });
});
