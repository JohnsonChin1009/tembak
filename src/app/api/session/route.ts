import { cookies } from "next/headers";
import { z } from "zod";
import { handle, HttpError, json, parseBody } from "@/lib/api";
import {
  AuthError,
  createSession,
  getSessionUser,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth/session";

export const GET = handle(async () => {
  return json({ user: await getSessionUser() });
});

export const POST = handle(async (req: Request) => {
  const body = await parseBody(
    req,
    z.object({ name: z.string().optional(), idToken: z.string().optional() }),
  );
  try {
    const { token, user } = await createSession(body);
    (await cookies()).set(SESSION_COOKIE, token, { ...sessionCookieOptions });
    return json({ user });
  } catch (err) {
    if (err instanceof AuthError) throw new HttpError(403, err.message);
    throw err;
  }
});

export const DELETE = handle(async () => {
  (await cookies()).delete(SESSION_COOKIE);
  return json({ ok: true });
});
