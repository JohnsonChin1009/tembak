import "server-only";
import { startAgentRun } from "@/lib/agent/run";
import { config } from "@/lib/config";
import { randomId } from "@/lib/ids";
import { canUseWorkspaceApps } from "@/lib/runtime-auth";
import { getStore } from "@/lib/store";
import type { Message, Weekday, Workflow, WorkflowSchedule } from "@/lib/types";

// Scheduled workflows: a saved @tembak request that Cloud Scheduler's tick
// (/api/cron/tick) replays on a schedule. See docs/prd/15-workflows.md.

export const MAX_WORKFLOWS = 5;
/** Consecutive failed runs before a workflow removes itself. */
const MAX_FAILURES = 3;
/** Workflows started per tick; the rest wait for the next minute. */
const PER_TICK = 5;

export const WEEKDAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_NAMES: Record<Weekday, string> = {
  sun: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday",
};

// --- time zones and schedules ---------------------------------------------------------

/** IANA names pass through; "GMT+8", "UTC-5", "+08:00" become Etc/GMT zones. Null if unknown. */
export function normalizeTz(input: string | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return config().workflowDefaultTz;
  const offset = raw.match(/^(?:GMT|UTC)?\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?$/i);
  if (offset) {
    const [, sign, h, m] = offset;
    if (m && m !== "00") return null;
    // Etc/GMT signs are inverted: UTC+8 is Etc/GMT-8.
    return Number(h) === 0 ? "UTC" : `Etc/GMT${sign === "+" ? "-" : "+"}${Number(h)}`;
  }
  if (/^(GMT|UTC|Z)$/i.test(raw)) return "UTC";
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: raw }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

/** "8", "8am", "08:00", "0800", "8:30 pm" → "HH:MM". Null if it isn't a time. */
export function normalizeTime(input: string | undefined): string | null {
  const m = (input ?? "").trim().toLowerCase().match(/^(\d{1,2}):?(\d{2})?\s*(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

type Parts = { year: number; month: number; day: number; hour: number; minute: number };

function partsIn(tz: string, t: number): Parts {
  const out: Record<string, number> = {};
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric",
  });
  for (const p of fmt.formatToParts(t)) if (p.type !== "literal") out[p.type] = Number(p.value);
  return { year: out.year, month: out.month, day: out.day, hour: out.hour, minute: out.minute };
}

/** The UTC instant of a wall-clock time in `tz` (two passes so DST edges land right). */
function wallToUtc(tz: string, y: number, mo: number, d: number, h: number, mi: number): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const offsetAt = (t: number) => {
    const p = partsIn(tz, t);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(t / 60_000) * 60_000;
  };
  const first = guess - offsetAt(guess);
  return guess - offsetAt(first);
}

/** The first run strictly after `after`. */
export function nextRun(schedule: WorkflowSchedule, tz: string, after: number): number {
  if (schedule.every === "hour") return (Math.floor(after / 3_600_000) + 1) * 3_600_000;
  const [h, mi] = schedule.at.split(":").map(Number);
  const today = partsIn(tz, after);
  for (let i = 0; i <= 8; i++) {
    const date = new Date(Date.UTC(today.year, today.month - 1, today.day + i));
    const weekday = WEEKDAYS[date.getUTCDay()];
    if (schedule.every === "weekday" && (weekday === "sat" || weekday === "sun")) continue;
    if (schedule.every === "week" && weekday !== schedule.day) continue;
    const at = wallToUtc(tz, date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), h, mi);
    if (at > after) return at;
  }
  throw new Error("Couldn't work out the next run time");
}

export function describeSchedule(schedule: WorkflowSchedule, tz: string): string {
  const zone = tz.startsWith("Etc/GMT") ? `GMT${tz.slice(7).replace(/^([+-])/, (s) => (s === "+" ? "-" : "+"))}` : tz;
  switch (schedule.every) {
    case "hour":
      return "Every hour, on the hour";
    case "day":
      return `Every day at ${schedule.at} (${zone})`;
    case "weekday":
      return `Every weekday at ${schedule.at} (${zone})`;
    case "week":
      return `Every ${DAY_NAMES[schedule.day]} at ${schedule.at} (${zone})`;
  }
}

export function formatRunTime(t: number, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(t);
}

/** Builds a schedule from loose agent arguments; throws a message the model can act on. */
export function scheduleFrom(args: { every?: string; day?: string; at?: string }): WorkflowSchedule {
  const every = (args.every ?? "").toLowerCase();
  if (every === "hour") return { every: "hour" };
  if (every !== "day" && every !== "weekday" && every !== "week") {
    throw new Error('every must be "hour", "day", "weekday", or "week"');
  }
  const at = normalizeTime(args.at ?? "09:00");
  if (!at) throw new Error(`"${args.at}" isn't a time. Use 24-hour "HH:MM".`);
  if (every !== "week") return { every, at };
  const day = (args.day ?? "").toLowerCase().slice(0, 3) as Weekday;
  if (!WEEKDAYS.includes(day)) throw new Error('A weekly workflow needs day: "mon" to "sun"');
  return { every, day, at };
}

/** Plain-words schedule in a message, for the mock agent ("every monday 0800 GMT+8"). */
export function scheduleFromText(text: string): { every: string; day?: string; at?: string; timezone?: string } | null {
  const t = text.toLowerCase();
  const every = t.match(/\b(hourly|daily|weekly|every\s+(hour|day|morning|weekday|week|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/);
  if (!every) return null;
  const word = every[2] ?? every[1];
  const tz = text.match(/\b(?:GMT|UTC)\s*[+-]\s*\d{1,2}(?::?\d{2})?\b/i)?.[0];
  const time =
    t.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/)?.[1] ??
    t.replace(/(?:gmt|utc)\s*[+-]\s*\d{1,2}(?::?\d{2})?/g, "").match(/\b([01]\d|2[0-3]):?([0-5]\d)\b/)?.[0];
  if (word === "hourly" || word === "hour") return { every: "hour" };
  if (word === "daily" || word === "day" || word === "morning") return { every: "day", at: time, timezone: tz };
  if (word === "weekday") return { every: "weekday", at: time, timezone: tz };
  if (word === "weekly" || word === "week") return { every: "week", day: "mon", at: time, timezone: tz };
  return { every: "week", day: word.slice(0, 3), at: time, timezone: tz };
}

// --- creating and running ---------------------------------------------------------------

export async function createWorkflow(input: {
  workspaceId: string;
  channelId: string;
  prompt: string;
  schedule: WorkflowSchedule;
  tz: string;
  createdBy: string;
  createdByName: string;
}): Promise<Workflow> {
  const store = await getStore();
  const existing = await store.listWorkflows(input.workspaceId);
  if (existing.length >= MAX_WORKFLOWS) {
    throw new Error(`This workspace already has ${MAX_WORKFLOWS} workflows. Delete one first.`);
  }
  const now = Date.now();
  const workflow: Workflow = {
    id: randomId(),
    ...input,
    prompt: input.prompt.trim().slice(0, 1000),
    createdAt: now,
    nextRunAt: nextRun(input.schedule, input.tz, now),
    failures: 0,
  };
  await store.upsertWorkflow(workflow);
  return workflow;
}

/** One tick: claims due workflows and runs them, awaiting each so the request stays open. */
export async function runDueWorkflows(now = Date.now()): Promise<{ ran: number; skipped: number; failed: number }> {
  const store = await getStore();
  const due = await store.listDueWorkflows(now, PER_TICK);
  const results = await Promise.allSettled(
    due.map(async (w) => {
      // Moving nextRunAt forward is the claim, so an overlapping tick or a retry skips it.
      const claimed = await store.claimWorkflow(w.id, w.nextRunAt, nextRun(w.schedule, w.tz, now));
      if (!claimed) return "skipped" as const;
      return (await runWorkflow(w)) ? ("ran" as const) : ("failed" as const);
    }),
  );
  const count = (s: string) => results.filter((r) => r.status === "fulfilled" && r.value === s).length;
  const crashed = results.filter((r) => r.status === "rejected");
  for (const r of crashed) console.error("[workflows] run crashed:", (r as PromiseRejectedResult).reason);
  return { ran: count("ran"), skipped: count("skipped"), failed: count("failed") + crashed.length };
}

async function runWorkflow(w: Workflow): Promise<boolean> {
  const store = await getStore();
  const notice = (text: string) =>
    store.addMessage({
      id: randomId(), workspaceId: w.workspaceId, channelId: w.channelId, createdAt: Date.now(),
      author: { kind: "agent" }, text, mentionsAgent: false,
    });

  if (!(await store.getChannel(w.workspaceId, w.channelId))) {
    await store.deleteWorkflow(w.id);
    return false;
  }
  if (!(await canUseWorkspaceApps(w.workspaceId, w.createdBy))) {
    await store.deleteWorkflow(w.id);
    await notice(`⏰ I stopped the workflow *${w.prompt}* because ${w.createdByName} who set it up isn't in this workspace anymore.`);
    return false;
  }

  const header: Message = {
    id: randomId(),
    workspaceId: w.workspaceId,
    channelId: w.channelId,
    createdAt: Date.now(),
    author: { kind: "agent" },
    text: `⏰ Scheduled by ${w.createdByName}: *${w.prompt}*`,
    mentionsAgent: false,
  };
  await store.addMessage(header);
  // The run reads like the creator asked again, replying under the header. Never stored.
  const trigger: Message = { ...header, author: { kind: "user", uid: w.createdBy, name: w.createdByName }, text: w.prompt };
  const result = await startAgentRun(trigger, { scheduled: true });

  const failures = result.ok ? 0 : w.failures + 1;
  if (failures >= MAX_FAILURES) {
    await store.deleteWorkflow(w.id);
    await notice(`⏰ The workflow *${w.prompt}* failed ${MAX_FAILURES} times in a row, so I turned it off. Ask me to set it up again once it's fixed.`);
  } else {
    await store.updateWorkflow(w.id, {
      failures,
      lastRun: { at: Date.now(), status: result.ok ? "done" : "error", messageId: result.messageId },
    });
  }
  return result.ok;
}
