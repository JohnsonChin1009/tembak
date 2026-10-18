import "server-only";
import { createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "@/lib/config";
import type { ConnectionProvider } from "@/lib/types";

// OAuth `state`: an HMAC-signed payload naming the workspace, user, and provider,
// plus a nonce that must also match a short-lived httpOnly cookie. Together they
// stop CSRF (someone else's code landing in your workspace) and replay.

export const NONCE_COOKIE = "tembak_oauth_nonce";
export const STATE_TTL_MS = 10 * 60_000;

export type OAuthState = {
  /** Workspace id */
  w: string;
  /** User id */
  u: string;
  p: ConnectionProvider;
  /** Nonce, also stored in NONCE_COOKIE */
  n: string;
  /** Expiry, epoch ms */
  x: number;
  /** Channel to return to */
  c?: string;
  /** Return to the settings page instead of a channel */
  s?: 1;
};

let cachedKey: Buffer | undefined;
function key(): Buffer {
  cachedKey ??= Buffer.from(hkdfSync("sha256", config().sessionSecret, "tembak", "tembak:oauth-state:v1", 32));
  return cachedKey;
}

const mac = (payload: string) => createHmac("sha256", key()).update(payload).digest("base64url");

export function newNonce(): string {
  return randomBytes(16).toString("base64url");
}

export function signState(state: OAuthState): string {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  return `${payload}.${mac(payload)}`;
}

/** Returns the payload if the signature is valid and it hasn't expired; null otherwise. */
export function verifyState(raw: string | null, now = Date.now()): OAuthState | null {
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(mac(payload));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const state = JSON.parse(Buffer.from(payload, "base64url").toString()) as OAuthState;
    if (typeof state.x !== "number" || state.x < now) return null;
    return state;
  } catch {
    return null;
  }
}

export function nonceMatches(cookie: string | undefined, state: OAuthState): boolean {
  if (!cookie) return false;
  const a = Buffer.from(cookie);
  const b = Buffer.from(state.n);
  return a.length === b.length && timingSafeEqual(a, b);
}
