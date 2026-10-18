import "server-only";

// Fixed-window rate limiter kept in memory. Fine while Cloud Run runs a single
// instance; swap for a shared store if that changes. Keys are free-form, e.g.
// `post:${appId}:${uid}`, so callers can stack limits (per member, per app, ...).

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();
let nextSweep = 0;

/** Drops expired windows now and then so the map doesn't grow forever. */
function sweep(now: number) {
  if (now < nextSweep) return;
  nextSweep = now + 60_000;
  for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
}

/**
 * Counts one hit against `key`. Returns true if it's allowed (at most `max` hits
 * per `windowMs`), false if the caller should be refused, typically with a 429.
 * Refused hits don't count.
 */
export function limit(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  if (max < 1) return false;
  sweep(now);
  const w = windows.get(key);
  if (!w || w.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (w.count >= max) return false;
  w.count++;
  return true;
}
