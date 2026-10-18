import { timingSafeEqual } from "node:crypto";
import { handle, HttpError, json } from "@/lib/api";
import { config } from "@/lib/config";
import { runDueWorkflows } from "@/lib/workflows";

// Cloud Scheduler calls this every minute (scripts/deploy.sh). Runs are awaited, not
// deferred with after(), so the instance keeps working until they finish.
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const expected = config().cronSecret;
  const given = req.headers.get("x-cron-secret") ?? "";
  if (!expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const POST = handle(async (req: Request) => {
  if (!authorized(req)) throw new HttpError(401, "Unauthorized");
  // Outside production, ?now=<ms> runs workflows as if it were that time (testing, demos).
  const now = config().isProd ? NaN : Number(new URL(req.url).searchParams.get("now"));
  return json(await runDueWorkflows(Number.isFinite(now) && now > 0 ? now : Date.now()));
});
