import { NextResponse, type NextRequest } from "next/server";

// Proxy reads env directly (not lib/config) to stay dependency-free.
const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const APPS_URL = (process.env.APPS_URL ?? APP_URL).replace(/\/$/, "");
const APP_HOST = new URL(APP_URL).host;
const APPS_HOST = new URL(APPS_URL).host;
const SPLIT_HOSTS = APP_HOST !== APPS_HOST;

// /api/runtime/* is called from app iframes without cookies; it checks a bearer app token itself.
// /api/cron/* is called by Cloud Scheduler and checks its own shared secret.
const PUBLIC_PREFIXES = ["/a/", "/api/public/", "/api/runtime/", "/api/cron/", "/api/session", "/login", "/_next/", "/favicon"];

function hostOf(req: NextRequest) {
  return req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
}

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const host = hostOf(req);

  if (SPLIT_HOSTS && host === APPS_HOST) {
    // The apps host only serves published apps, their data, and the runtime API.
    if (["/a/", "/api/public/", "/api/runtime/", "/_next/"].some((p) => pathname.startsWith(p))) {
      return NextResponse.next();
    }
    return new NextResponse("Not found", { status: 404 });
  }

  if (SPLIT_HOSTS && pathname.startsWith("/a/")) {
    return NextResponse.redirect(`${APPS_URL}${pathname}${search}`);
  }

  // "/" is the landing page when signed out; the page itself redirects members.
  if (pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // Optimistic check only; route handlers and pages verify the session.
  if (!req.cookies.has("tembak_session")) {
    // OAuth callbacks are browser navigations: send people to sign in, then back.
    if (pathname.startsWith("/api/") && !pathname.startsWith("/api/oauth/")) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
