import { z } from "zod";
import { handle, HttpError, json, parseBody } from "@/lib/api";
import { connectionInfo, isProvider, PROVIDERS, saveConnection } from "@/lib/connectors";
import { SourceFetchError } from "@/lib/data/errors";
import { requireConfigurer } from "@/lib/permissions";
import { getStore } from "@/lib/store";

const body = z.object({ apiKey: z.string().trim().min(10).max(500) });

function provider(raw: string) {
  if (!isProvider(raw)) throw new HttpError(404, "Unknown connector");
  return raw;
}

/** API-key fallback: verify the key with the provider, then store it like an OAuth connection. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/w/[ws]/connections/[provider]">) => {
  const params = await ctx.params;
  const p = provider(params.provider);
  const { user, workspace } = await requireConfigurer(params.ws);
  const { apiKey } = await parseBody(req, body);
  try {
    const account = await PROVIDERS[p].verifyKey(apiKey);
    const conn = await saveConnection({
      workspaceId: workspace.id,
      provider: p,
      authType: "api_key",
      accessToken: apiKey,
      accountName: account.accountName,
      accountId: account.accountId,
      connectedBy: user.uid,
      connectedAt: Date.now(),
    });
    return json(connectionInfo(conn), { status: 201 });
  } catch (err) {
    if (err instanceof SourceFetchError) throw new HttpError(422, err.message);
    throw err;
  }
});

/** Disconnect. Sources that used it stop loading until it's connected again. */
export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/w/[ws]/connections/[provider]">) => {
  const params = await ctx.params;
  const p = provider(params.provider);
  const { workspace } = await requireConfigurer(params.ws);
  await (await getStore()).deleteConnection(workspace.id, p);
  return json({ ok: true });
});
