import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { config } from "@/lib/config";
import { isProvider, oauthApp, PROVIDERS, redirectUri, saveConnection } from "@/lib/connectors";
import { nonceMatches, NONCE_COOKIE, verifyState } from "@/lib/connectors/state";
import { canConfigure } from "@/lib/permissions";
import { getStore } from "@/lib/store";
import { membership } from "@/lib/workspaces";

/**
 * OAuth redirect target. Checks, in order: signed-in user, valid unexpired state
 * for this provider, nonce cookie, same user, membership. Only then is the code
 * exchanged (server side) and the connection stored.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/oauth/[provider]/callback">) {
  const { provider } = await ctx.params;
  const url = new URL(req.url);
  if (!isProvider(provider)) return page(404, "Unknown connector.");

  const user = await getSessionUser();
  if (!user) return Response.redirect(`${config().appUrl}/login?next=${encodeURIComponent(url.pathname + url.search)}`, 302);

  const nonce = (await cookies()).get(NONCE_COOKIE)?.value;

  const state = verifyState(url.searchParams.get("state"));
  if (!state || state.p !== provider) return page(400, "This connection link is invalid or expired. Go back and try connecting again.");
  if (!nonceMatches(nonce, state) || state.u !== user.uid) {
    return page(403, "This connection was started in a different browser or by a different account. Try again from Tembak.");
  }

  const store = await getStore();
  const m = await membership(user, await store.getWorkspace(state.w));
  if (!m) return page(404, "Workspace not found.");
  if (!canConfigure(m)) return page(403, "Only the demo's maintainers can connect apps here.");

  const back = (query: string) => {
    const res = NextResponse.redirect(
      `${config().appUrl}/w/${encodeURIComponent(m.workspace.slug)}${state.c ? `/c/${state.c}` : ""}?${query}`,
      302,
    );
    // Single use: the nonce is spent whatever the outcome.
    res.cookies.set(NONCE_COOKIE, "", { path: "/api/oauth", maxAge: 0 });
    return res;
  };

  const code = url.searchParams.get("code");
  if (url.searchParams.get("error") || !code) return back(`connect_error=denied&provider=${provider}`);
  if (!oauthApp(provider)) return back(`connect_error=not_configured&provider=${provider}`);

  try {
    const result = await PROVIDERS[provider].exchangeCode(code, redirectUri(provider));
    await saveConnection({
      workspaceId: m.workspace.id,
      provider,
      authType: "oauth",
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt,
      accountName: result.accountName,
      accountId: result.accountId,
      connectedBy: user.uid,
      connectedAt: Date.now(),
    });
  } catch (err) {
    // The message never includes tokens or the client secret.
    console.error(`[oauth] ${provider} exchange failed:`, err instanceof Error ? err.message : "unknown error");
    return back(`connect_error=failed&provider=${provider}`);
  }
  return back(`connected=${provider}`);
}

function page(status: number, message: string) {
  const esc = message.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Connection failed · Tembak</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0c0e;color:#e9ebee;font-family:ui-sans-serif,system-ui,sans-serif}
.card{max-width:440px;padding:32px;text-align:center}h1{font-size:20px;margin:0 0 8px}p{color:#9ba1a8;line-height:1.55;margin:0 0 20px}
a{color:#0b0c0e;background:#c6f432;padding:8px 14px;border-radius:8px;text-decoration:none;font-weight:600}</style></head>
<body><div class="card"><h1>Couldn't connect</h1><p>${esc}</p><a href="/">Back to Tembak</a></div></body></html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export const dynamic = "force-dynamic";
