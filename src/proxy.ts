import { NextResponse, type NextRequest } from "next/server";

// Proxy reads env directly (not lib/config) to stay dependency-free.
const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const APPS_URL = (process.env.APPS_URL ?? APP_URL).replace(/\/$/, "");
const APP_HOST = new URL(APP_URL).host;
const APPS_HOST = new URL(APPS_URL).host;
const SPLIT_HOSTS = APP_HOST !== APPS_HOST;

const PUBLIC_PREFIXES = ["/a/", "/api/public/", "/api/session", "/login", "/_next/", "/favicon"];

function hostOf(req: NextRequest) {
  return req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
}

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const host = hostOf(req);

  if (SPLIT_HOSTS && host === APPS_HOST) {
    // The apps host only serves published apps and their data.
    if (pathname.startsWith("/a/") || pathname.startsWith("/api/public/") || pathname.startsWith("/_next/")) {
      return NextResponse.next();
    }
    return new NextResponse("Not found", { status: 404 });
  }

  if (SPLIT_HOSTS && pathname.startsWith("/a/")) {
    return NextResponse.redirect(`${APPS_URL}${pathname}${search}`);
  }

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // Optimistic check only; route handlers and pages verify the session.
  if (!req.cookies.has("tembak_session")) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
