import { preflight, publicError, publicJson } from "@/lib/public-api";
import { getStore } from "@/lib/store";

const MAX_BYTES = 200_000;
const KEY_RE = /^[\w.-]{1,100}$/;

export const OPTIONS = preflight;

export async function GET(_req: Request, ctx: RouteContext<"/api/public/kv/[appId]/[key]">) {
  const { appId, key } = await ctx.params;
  if (!KEY_RE.test(key)) return publicError(400, "Invalid key");
  const store = await getStore();
  if (!(await store.getApp(appId))) return publicError(404, "Unknown app");
  return publicJson({ value: await store.getKv(appId, key) }, { headers: { "cache-control": "no-store" } });
}

export async function PUT(req: Request, ctx: RouteContext<"/api/public/kv/[appId]/[key]">) {
  const { appId, key } = await ctx.params;
  if (!KEY_RE.test(key)) return publicError(400, "Invalid key");
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return publicError(413, "Value is too large (200KB max)");
  let body: { value?: unknown };
  try {
    body = JSON.parse(raw) as { value?: unknown };
  } catch {
    return publicError(400, "Body must be JSON: { value }");
  }
  const store = await getStore();
  if (!(await store.getApp(appId))) return publicError(404, "Unknown app");
  await store.setKv(appId, key, body.value ?? null);
  return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*" } });
}
