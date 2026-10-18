import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { signAppToken, signViewerCookie, VIEWER_COOKIE, VIEWER_COOKIE_TTL_MS, verifyViewerCookie, verifyViewerTicket } from "@/lib/app-token";
import { appNotFound } from "@/lib/app-not-found";
import { getSessionUser } from "@/lib/auth/session";
import { config } from "@/lib/config";
import { canUseWorkspaceApps } from "@/lib/runtime-auth";
import { injectRuntime } from "@/lib/runtime";
import { getStore } from "@/lib/store";

// Opaque origin even at top level: published code can't use workspace cookies.
const SANDBOX_CSP = "sandbox allow-scripts allow-forms allow-popups allow-modals allow-downloads";

// Published apps are for members of the app's workspace only. The apps host can't
// see the session cookie, so signed-out visitors bounce through /view/:slug on the
// workspace host, which checks membership and hands back a one-minute ticket.
export async function GET(req: Request, ctx: RouteContext<"/a/[slug]">) {
  const { slug } = await ctx.params;
  const store = await getStore();
  const app = await store.getAppBySlug(slug);
  const n = app?.publishedVersion;
  const version = app && n ? await store.getVersion(app.id, n) : null;
  if (!app || !version) return appNotFound();

  const { appsUrl, appUrl, isProd } = config();
  const cleanUrl = `${appsUrl}/a/${slug}`;

  const ticket = verifyViewerTicket(new URL(req.url).searchParams.get("ticket"));
  if (ticket && ticket.appId === app.id) {
    const res = NextResponse.redirect(cleanUrl);
    res.cookies.set(VIEWER_COOKIE, signViewerCookie({ uid: ticket.uid }), {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/a/",
      maxAge: VIEWER_COOKIE_TTL_MS / 1000,
    });
    return res;
  }

  const jar = await cookies();
  // On a single host (local dev) the session cookie is visible here too.
  const uid = verifyViewerCookie(jar.get(VIEWER_COOKIE)?.value)?.uid ?? (await getSessionUser())?.uid;
  // Not signed in here, or signed in as someone else: let the workspace host decide.
  if (!uid || !(await canUseWorkspaceApps(app.workspaceId, uid))) {
    return NextResponse.redirect(`${appUrl}/view/${encodeURIComponent(slug)}`);
  }

  const token = signAppToken({ appId: app.id, workspaceId: app.workspaceId, uid });
  const html = injectRuntime(version.html, { appId: app.id, version: version.n, apiBase: appsUrl, token });
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": SANDBOX_CSP,
      // Carries a per-member token, so never shared caches.
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex",
      "referrer-policy": "no-referrer",
    },
  });
}
