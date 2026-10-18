import { handle, json } from "@/lib/api";
import { connectionInfo, oauthApp, PROVIDER_LABEL } from "@/lib/connectors";
import { canConfigure } from "@/lib/permissions";
import { getStore } from "@/lib/store";
import type { ConnectionProvider } from "@/lib/types";
import { requireMember } from "@/lib/workspaces";

/** Notion and Linear: whether OAuth is available, and the current connection (no tokens). */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/w/[ws]/connections">) => {
  const m = await requireMember((await ctx.params).ws);
  const connections = await (await getStore()).listConnections(m.workspace.id);
  const providers = (["notion", "linear"] as ConnectionProvider[]).map((provider) => {
    const conn = connections.find((c) => c.provider === provider);
    return {
      provider,
      label: PROVIDER_LABEL[provider],
      oauth: !!oauthApp(provider),
      connection: conn ? connectionInfo(conn) : null,
    };
  });
  return json({ providers, canConfigure: canConfigure(m) });
});
