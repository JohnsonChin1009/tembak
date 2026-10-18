import { handle, json } from "@/lib/api";
import { APP_TOKEN_TTL_MS, signAppToken } from "@/lib/app-token";
import { requireAppAccess } from "@/lib/workspaces";

// Runtime token for the builder preview, which calls the same /api/public/* routes.
export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/apps/[id]/token">) => {
  const { id } = await ctx.params;
  const { user, app } = await requireAppAccess(id);
  const token = signAppToken({ appId: app.id, workspaceId: app.workspaceId, uid: user.uid });
  return json({ token, expiresAt: Date.now() + APP_TOKEN_TTL_MS });
});
