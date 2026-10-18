import "server-only";

// Endpoints called from generated apps. Those run on an opaque origin (CSP
// sandbox / sandboxed iframe), so they're cross-origin and never send cookies;
// they authenticate with a bearer app token instead (src/lib/runtime-auth.ts).
export const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, PUT, POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
  "access-control-max-age": "86400",
};

export function publicJson(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, { ...init, headers: { ...CORS_HEADERS, ...init.headers } });
}

export function publicError(status: number, error: string) {
  return publicJson({ error }, { status });
}

export function preflight() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
