import { z } from "zod";
import { HttpError, parseBody } from "@/lib/api";
import { performAction } from "@/lib/actions";
import { preflight, publicJson } from "@/lib/public-api";
import { limit } from "@/lib/rate-limit";
import { handleRuntime, requireRuntimeCaller } from "@/lib/runtime-auth";

export const OPTIONS = preflight;

// Each action validates its own input; this only checks the envelope.
const schema = z.object({ name: z.string().min(1).max(64), input: z.unknown().optional() });

/** tembak.action(name, input): a write to Linear, Notion, or a Google Sheet. */
export const POST = handleRuntime(async (req: Request, ctx: RouteContext<"/api/runtime/[appId]/action">) => {
  const caller = await requireRuntimeCaller(req, (await ctx.params).appId);
  if (!limit(`action:${caller.workspaceId}:${caller.uid}`, 30, 10 * 60_000)) {
    throw new HttpError(429, "That's a lot of changes at once. Try again in a few minutes.");
  }
  const { name, input } = await parseBody(req, schema);
  const result = await performAction(caller, name, input ?? {});
  return publicJson(result ?? null, { headers: { "cache-control": "no-store" } });
});
