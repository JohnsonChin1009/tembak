import "server-only";
import { config } from "@/lib/config";
import type { ConnectionProvider } from "@/lib/types";
import { linearAuthorizeUrl, linearExchangeCode, linearVerifyKey } from "./linear";
import { notionAuthorizeUrl, notionExchangeCode, notionVerifyKey } from "./notion";

export { connectionInfo, PROVIDER_LABEL, saveConnection } from "./connections";

type Provider = {
  authorizeUrl: (clientId: string, redirectUri: string, state: string) => string;
  exchangeCode: (
    code: string,
    redirectUri: string,
  ) => Promise<{ accessToken: string; refreshToken?: string; expiresAt?: number; accountName: string; accountId?: string }>;
  verifyKey: (key: string) => Promise<{ accountName: string; accountId?: string }>;
};

export const PROVIDERS: Record<ConnectionProvider, Provider> = {
  notion: { authorizeUrl: notionAuthorizeUrl, exchangeCode: notionExchangeCode, verifyKey: notionVerifyKey },
  linear: { authorizeUrl: linearAuthorizeUrl, exchangeCode: linearExchangeCode, verifyKey: linearVerifyKey },
};

export function isProvider(value: string): value is ConnectionProvider {
  return value === "notion" || value === "linear";
}

export function oauthApp(provider: ConnectionProvider) {
  return config().oauth[provider];
}

/** Must match the redirect URI registered with the provider exactly. */
export function redirectUri(provider: ConnectionProvider): string {
  return `${config().appUrl}/api/oauth/${provider}/callback`;
}
