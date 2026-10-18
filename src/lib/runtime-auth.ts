import "server-only";
import { verifyAppToken } from "@/lib/app-token";
import { getStore } from "@/lib/store";
import type { App } from "@/lib/types";

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
