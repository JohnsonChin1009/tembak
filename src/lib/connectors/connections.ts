import "server-only";
import { seal, unseal } from "@/lib/crypto";
import { SourceFetchError } from "@/lib/data/errors";
import { getStore } from "@/lib/store";
import type { Connection, ConnectionInfo, ConnectionProvider } from "@/lib/types";

export const PROVIDER_LABEL: Record<ConnectionProvider, string> = { notion: "Notion", linear: "Linear" };

/** The provider rejected the token (expired or revoked). */
export class ConnectorAuthError extends Error {}

export type Tokens = { accessToken: string; refreshToken?: string; expiresAt?: number };
/** Exchanges the stored refresh token for new tokens, or returns null if the provider can't refresh. */
export type Refresher = (refreshToken: string) => Promise<Tokens | null>;

const EXPIRY_SKEW_MS = 60_000;
const inflight = new Map<string, Promise<Connection>>();

export function connectionInfo(c: Connection): ConnectionInfo {
  return {
    workspaceId: c.workspaceId,
    provider: c.provider,
    authType: c.authType,
    accountName: c.accountName,
    accountId: c.accountId,
    connectedBy: c.connectedBy,
    connectedAt: c.connectedAt,
  };
}

/** Stores a connection with its tokens sealed. */
export async function saveConnection(
  input: Omit<Connection, "accessToken" | "refreshToken"> & Tokens,
): Promise<Connection> {
  const connection: Connection = {
    ...input,
    accessToken: seal(input.accessToken),
    refreshToken: input.refreshToken ? seal(input.refreshToken) : undefined,
  };
  await (await getStore()).upsertConnection(connection);
  return connection;
}

async function refresh(conn: Connection, refresher: Refresher): Promise<Connection> {
  const key = `${conn.workspaceId}/${conn.provider}`;
  // One refresh at a time per connection: refresh tokens rotate on use.
  const pending = inflight.get(key);
  if (pending) return pending;
  const run = (async () => {
    const label = PROVIDER_LABEL[conn.provider];
    const tokens = conn.refreshToken ? await refresher(unseal(conn.refreshToken)).catch(() => null) : null;
    if (!tokens) throw new SourceFetchError(`${label} access expired. Reconnect ${label} in Settings → Connectors.`);
    return saveConnection({ ...conn, ...tokens, refreshToken: tokens.refreshToken ?? unseal(conn.refreshToken!) });
  })().finally(() => inflight.delete(key));
  inflight.set(key, run);
  return run;
}

/**
 * Runs `fn` with a usable access token for the workspace's connection, refreshing
 * it first when it's about to expire, and once more if the provider rejects it.
 */
export async function withAccessToken<T>(
  workspaceId: string,
  provider: ConnectionProvider,
  refresher: Refresher,
  fn: (token: string, conn: Connection) => Promise<T>,
): Promise<T> {
  const label = PROVIDER_LABEL[provider];
  let conn = await (await getStore()).getConnection(workspaceId, provider);
  if (!conn) throw new SourceFetchError(`${label} isn't connected to this workspace. Connect it in Settings → Connectors.`);
  if (conn.expiresAt && conn.expiresAt - EXPIRY_SKEW_MS < Date.now()) conn = await refresh(conn, refresher);
  try {
    return await fn(unseal(conn.accessToken), conn);
  } catch (err) {
    if (!(err instanceof ConnectorAuthError)) throw err;
    if (!conn.refreshToken) {
      throw new SourceFetchError(`${label} rejected the saved key. Reconnect ${label} in Settings → Connectors.`);
    }
    conn = await refresh(conn, refresher);
    try {
      return await fn(unseal(conn.accessToken), conn);
    } catch (again) {
      if (again instanceof ConnectorAuthError) {
        throw new SourceFetchError(`${label} access was revoked. Reconnect ${label} in Settings → Connectors.`);
      }
      throw again;
    }
  }
}

/** Reads a provider error body without ever echoing request headers. */
export async function errorMessage(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string; errors?: { message?: string }[] } | null;
  return (body?.message ?? body?.errors?.[0]?.message ?? `HTTP ${res.status}`).slice(0, 200);
}
