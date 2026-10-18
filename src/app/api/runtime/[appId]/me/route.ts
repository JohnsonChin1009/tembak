import { HttpError } from "@/lib/api";
import { preflight, publicJson } from "@/lib/public-api";
import { limit } from "@/lib/rate-limit";
import { callerPerson, handleRuntime, requireRuntimeCaller } from "@/lib/runtime-auth";

export const OPTIONS = preflight;

/** tembak.me(): the member looking at the app. */
export const GET = handleRuntime(async (req: Request, ctx: RouteContext<"/api/runtime/[appId]/me">) => {
  const caller = await requireRuntimeCaller(req, (await ctx.params).appId);
  if (!limit(`runtime-read:${caller.uid}`, 120, 60_000)) throw new HttpError(429, "Too many requests, try again in a minute.");
  return publicJson(await callerPerson(caller), { headers: { "cache-control": "no-store" } });
});
