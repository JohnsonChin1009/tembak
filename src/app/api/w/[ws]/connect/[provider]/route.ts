import { NextResponse } from "next/server";
import { handle, HttpError } from "@/lib/api";
import { isProvider, oauthApp, PROVIDERS, redirectUri } from "@/lib/connectors";
import { newNonce, NONCE_COOKIE, signState, STATE_TTL_MS } from "@/lib/connectors/state";
import { config } from "@/lib/config";
import { requireConfigurer } from "@/lib/permissions";

/** Starts OAuth: signed state plus a matching nonce cookie, then off to the provider. */
export const GET = handle(async (req: Request, ctx: RouteContext<"/api/w/[ws]/connect/[provider]">) => {
  const params = await ctx.params;
  if (!isProvider(params.provider)) throw new HttpError(404, "Unknown connector");
  const app = oauthApp(params.provider);
  if (!app) throw new HttpError(400, "OAuth isn't set up for this connector. Use an API key instead.");
  const { user, workspace } = await requireConfigurer(params.ws);

  const channel = new URL(req.url).searchParams.get("channel") ?? undefined;
  const nonce = newNonce();
  const state = signState({
    w: workspace.id,
    u: user.uid,
    p: params.provider,
    n: nonce,
    x: Date.now() + STATE_TTL_MS,
    c: channel && /^[\w-]{1,64}$/.test(channel) ? channel : undefined,
  });
  const res = NextResponse.redirect(PROVIDERS[params.provider].authorizeUrl(app.clientId, redirectUri(params.provider), state), 302);
  res.cookies.set(NONCE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: config().isProd,
    path: "/api/oauth",
    maxAge: STATE_TTL_MS / 1000,
  });
  return res;
});
