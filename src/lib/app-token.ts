import "server-only";
import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { config } from "@/lib/config";

// HMAC-signed tokens for app access, same shape as connectors/state.ts. Each kind
// has its own derived key, so one can never be passed off as another.
//
// - App token: the runtime's bearer for /api/public/*, scoped to one app and member.
// - Viewer ticket: one-minute hop from the workspace host to the apps host.
// - Viewer cookie: who is signed in on the apps host, which can't see the session cookie.

export const VIEWER_COOKIE = "tembak_viewer";
export const APP_TOKEN_TTL_MS = 12 * 60 * 60_000;
export const VIEWER_TICKET_TTL_MS = 60_000;
export const VIEWER_COOKIE_TTL_MS = 12 * 60 * 60_000;

function signer<T extends object>(info: string) {
  let cachedKey: Buffer | undefined;
  const mac = (payload: string) => {
    cachedKey ??= Buffer.from(hkdfSync("sha256", config().sessionSecret, "tembak", info, 32));
    return createHmac("sha256", cachedKey).update(payload).digest("base64url");
  };

  return {
    sign(claims: T, ttlMs: number): string {
      const payload = Buffer.from(JSON.stringify({ ...claims, exp: Date.now() + ttlMs })).toString("base64url");
      return `${payload}.${mac(payload)}`;
    },
    /** Returns the claims if the signature is valid and it hasn't expired; null otherwise. */
    verify(raw: string | null | undefined, now = Date.now()): (T & { exp: number }) | null {
      if (!raw) return null;
      const [payload, sig] = raw.split(".");
      if (!payload || !sig) return null;
      const expected = Buffer.from(mac(payload));
      const actual = Buffer.from(sig);
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
      try {
        const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as T & { exp: number };
        if (typeof claims.exp !== "number" || claims.exp < now) return null;
        return claims;
      } catch {
        return null;
      }
    },
  };
}

export type AppTokenClaims = { appId: string; workspaceId: string; uid: string };
const appToken = signer<AppTokenClaims>("tembak:app-token:v1");
export const signAppToken = (claims: AppTokenClaims, ttlMs = APP_TOKEN_TTL_MS) => appToken.sign(claims, ttlMs);
export const verifyAppToken = appToken.verify;

const viewerTicket = signer<{ uid: string; appId: string }>("tembak:viewer-ticket:v1");
export const signViewerTicket = (claims: { uid: string; appId: string }) => viewerTicket.sign(claims, VIEWER_TICKET_TTL_MS);
export const verifyViewerTicket = viewerTicket.verify;

const viewerCookie = signer<{ uid: string }>("tembak:viewer-cookie:v1");
export const signViewerCookie = (claims: { uid: string }) => viewerCookie.sign(claims, VIEWER_COOKIE_TTL_MS);
export const verifyViewerCookie = viewerCookie.verify;
