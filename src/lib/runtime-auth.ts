import "server-only";
import { HttpError } from "@/lib/api";
import { verifyAppToken } from "@/lib/app-token";
import { applyProfile } from "@/lib/profile";
import { publicError } from "@/lib/public-api";
import { getStore } from "@/lib/store";
import type { App, Member, User } from "@/lib/types";

export class RuntimeAuthError extends Error {
  constructor(
    public status: 401 | 403 | 404,
    message: string,
  ) {
    super(message);
  }
}

/** Members of the workspace can use its apps; open workspaces (the demo) let anyone signed in. */
export async function canUseWorkspaceApps(workspaceId: string, uid: string): Promise<boolean> {
  const store = await getStore();
  const [member, ws] = await Promise.all([store.getMember(workspaceId, uid), store.getWorkspace(workspaceId)]);
  return !!ws && (!!member || !!ws.open);
}

export type RuntimeCaller = { app: App; workspaceId: string; uid: string };

/** Verifies the bearer token, loads the app and checks the uid can still use it. */
export async function requireRuntimeCaller(req: Request, appId: string): Promise<RuntimeCaller> {
  const header = req.headers.get("authorization");
  const claims = verifyAppToken(header?.startsWith("Bearer ") ? header.slice(7) : null);
  if (!claims) throw new RuntimeAuthError(401, "Open this app from Tembak to use it.");
  if (claims.appId !== appId) throw new RuntimeAuthError(403, "This token is for a different app.");

  const app = await (await getStore()).getApp(appId);
  if (!app || app.workspaceId !== claims.workspaceId) throw new RuntimeAuthError(404, "Unknown app");
  if (!(await canUseWorkspaceApps(app.workspaceId, claims.uid))) {
    throw new RuntimeAuthError(403, "You're no longer a member of this workspace.");
  }
  return { app, workspaceId: app.workspaceId, uid: claims.uid };
}

/** What apps may know about a person. Never the email. */
export type RuntimePerson = { uid: string; name: string; photoUrl?: string; title?: string };

export function runtimePerson(p: Pick<Member | User, "uid" | "name" | "photoUrl" | "title">): RuntimePerson {
  // Uploaded pictures are same-origin, cookie-auth URLs the sandboxed app can't load.
  const photoUrl = p.photoUrl && /^https:\/\//i.test(p.photoUrl) ? p.photoUrl : undefined;
  return { uid: p.uid, name: p.name, photoUrl, title: p.title || undefined };
}

/**
 * The caller as a person: their membership, or their own profile when an open
 * workspace (the demo) let them in without joining.
 */
export async function callerPerson({ workspaceId, uid }: RuntimeCaller): Promise<RuntimePerson> {
  const store = await getStore();
  const member = await store.getMember(workspaceId, uid);
  if (member) return runtimePerson(member);
  const user = await store.getUser(uid);
  return runtimePerson(user ? applyProfile(user, user.profile) : { uid, name: "Teammate" });
}

/**
 * Wraps a /api/runtime/* handler: RuntimeAuthError and HttpError (e.g. from
 * parseBody) become CORS-enabled JSON errors the runtime turns into rejections.
 */
export function handleRuntime<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof RuntimeAuthError || err instanceof HttpError) return publicError(err.status, err.message);
      console.error("[runtime] unhandled error", err);
      return publicError(500, "Something went wrong");
    }
  };
}
