import "server-only";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import type { User } from "@/lib/types";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Sign in required");
  return user;
}

export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new HttpError(400, result.error.issues.map((i) => i.message).join("; "));
  }
  return result.data;
}

/** Wraps a route handler so thrown HttpErrors become JSON error responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) {
        return json({ error: err.message }, { status: err.status });
      }
      console.error("[api] unhandled error", err);
      return json({ error: "Something went wrong" }, { status: 500 });
    }
  };
}
