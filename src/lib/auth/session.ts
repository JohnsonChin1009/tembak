import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { config } from "@/lib/config";
import { adminAuth } from "@/lib/firebase-admin";
import { kebab, randomId } from "@/lib/ids";
import { applyProfile } from "@/lib/profile";
import { getStore } from "@/lib/store";
import type { Profile, User } from "@/lib/types";

export const SESSION_COOKIE = "tembak_session";
const MAX_AGE_S = 60 * 60 * 24 * 5;

function sign(payload: string) {
  return createHmac("sha256", config().sessionSecret).update(payload).digest("base64url");
}

function encodeDev(user: User) {
  const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeDev(token: string): User | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as User;
  } catch {
    return null;
  }
}

// verifySessionCookie hits a cached public key set, but skip it for hot paths.
const verified = new Map<string, { user: User; until: number }>();

async function decodeFirebase(token: string): Promise<User | null> {
  const hit = verified.get(token);
  if (hit && hit.until > Date.now()) return hit.user;
  try {
    const claims = await adminAuth().verifySessionCookie(token);
    const user: User = {
      uid: claims.uid,
      name: (claims.name as string | undefined) ?? claims.email?.split("@")[0] ?? "Member",
      email: claims.email,
      photoUrl: claims.picture,
    };
    verified.set(token, { user, until: Date.now() + 5 * 60_000 });
    return user;
  } catch {
    return null;
  }
}

// Profile edits, cached briefly so every request doesn't read the user doc.
// Cloud Run runs one instance, so invalidating here is enough.
const profiles = new Map<string, { profile: Profile | undefined; until: number }>();

async function storedProfile(uid: string): Promise<Profile | undefined> {
  const hit = profiles.get(uid);
  if (hit && hit.until > Date.now()) return hit.profile;
  const profile = (await (await getStore()).getUser(uid))?.profile;
  profiles.set(uid, { profile, until: Date.now() + 60_000 });
  return profile;
}

export function forgetProfile(uid: string) {
  profiles.delete(uid);
}

/** The signed-in identity as the token carries it, without profile edits. */
async function accountFromToken(token: string | undefined): Promise<User | null> {
  if (!token) return null;
  return config().authMode === "firebase" ? decodeFirebase(token) : decodeDev(token);
}

export async function userFromToken(token: string | undefined): Promise<User | null> {
  const account = await accountFromToken(token);
  return account && applyProfile(account, await storedProfile(account.uid));
}

export async function getSessionUser(): Promise<User | null> {
  const jar = await cookies();
  return userFromToken(jar.get(SESSION_COOKIE)?.value);
}

/** For the profile page: the sign-in identity (to offer its photo back) and the stored profile. */
export async function getSessionAccount(): Promise<{ account: User; profile: Profile } | null> {
  const account = await accountFromToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!account) return null;
  return { account, profile: (await storedProfile(account.uid)) ?? {} };
}

function emailAllowed(email: string | undefined) {
  const domains = config().allowedEmailDomains;
  if (domains.length === 0) return true;
  const domain = email?.split("@")[1]?.toLowerCase();
  return !!domain && domains.includes(domain);
}

export class AuthError extends Error {}

/** Creates a session from either a dev name or a Firebase ID token. Returns the cookie value. */
export async function createSession(input: { name?: string; idToken?: string }): Promise<{
  token: string;
  user: User;
}> {
  const store = await getStore();
  if (config().authMode === "firebase") {
    if (!input.idToken) throw new AuthError("Missing ID token");
    const decoded = await adminAuth().verifyIdToken(input.idToken);
    if (!emailAllowed(decoded.email)) {
      throw new AuthError("This workspace is limited to approved email domains.");
    }
    const token = await adminAuth().createSessionCookie(input.idToken, {
      expiresIn: MAX_AGE_S * 1000,
    });
    const user: User = {
      uid: decoded.uid,
      name: (decoded.name as string | undefined) ?? decoded.email?.split("@")[0] ?? "Member",
      email: decoded.email,
      photoUrl: decoded.picture,
    };
    await store.upsertUser(user);
    return { token, user: applyProfile(user, await storedProfile(user.uid)) };
  }

  const name = input.name?.trim().slice(0, 40);
  if (!name) throw new AuthError("Enter a name");
  const user: User = { uid: `dev-${kebab(name, 20)}-${randomId(4)}`, name };
  await store.upsertUser(user);
  return { token: encodeDev(user), user };
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_S,
  get secure() {
    return config().isProd;
  },
};
