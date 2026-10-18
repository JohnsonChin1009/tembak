import { NextResponse } from "next/server";
import { signViewerTicket } from "@/lib/app-token";
import { appNotFound } from "@/lib/app-not-found";
import { getSessionUser } from "@/lib/auth/session";
import { config } from "@/lib/config";
import { getStore } from "@/lib/store";
import { membership } from "@/lib/workspaces";

// Workspace-host side of opening a published app: checks the signed-in user is a
// member of the app's workspace, then sends them to the apps host with a ticket.
export async function GET(_req: Request, ctx: RouteContext<"/view/[slug]">) {
  const { slug } = await ctx.params;
  const { appUrl, appsUrl } = config();
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(`${appUrl}/login?next=${encodeURIComponent(`/view/${slug}`)}`);

  const store = await getStore();
  const app = await store.getAppBySlug(slug);
  const m = app?.publishedVersion ? await membership(user, await store.getWorkspace(app.workspaceId)) : null;
  if (!app || !m) return appNotFound();

  const ticket = signViewerTicket({ uid: user.uid, appId: app.id });
  return NextResponse.redirect(`${appsUrl}/a/${encodeURIComponent(slug)}?ticket=${encodeURIComponent(ticket)}`);
}
