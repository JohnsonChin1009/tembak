import "server-only";
import { config } from "@/lib/config";
import { SourceFetchError } from "@/lib/data/errors";
import type { Connection, Row, SourceConfig } from "@/lib/types";
import { ConnectorAuthError, errorMessage, withAccessToken, type Tokens } from "./connections";

const GRAPHQL = "https://api.linear.app/graphql";
const TOKEN_URL = "https://api.linear.app/oauth/token";
const TIMEOUT_MS = 15_000;
const PAGE = 100;
const MAX_ROWS = 1000;

type LinearConfig = Extract<SourceConfig, { kind: "linear" }>;

/** OAuth tokens go as Bearer; personal API keys go bare. */
export function authHeader(token: string, conn: Pick<Connection, "authType">): string {
  return conn.authType === "oauth" ? `Bearer ${token}` : token;
}

export async function gql<T>(auth: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(GRAPHQL, {
    method: "POST",
    headers: { authorization: auth, "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
    redirect: "error",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = (await res.json().catch(() => null)) as {
    data?: T;
    errors?: { message?: string; extensions?: { type?: string; code?: string } }[];
  } | null;
  const authFailed =
    res.status === 401 ||
    body?.errors?.some((e) => /authenticat/i.test(`${e.extensions?.type ?? ""} ${e.extensions?.code ?? ""} ${e.message ?? ""}`));
  if (authFailed) throw new ConnectorAuthError("Linear rejected the token");
  if (res.status === 429 || body?.errors?.some((e) => /ratelimit/i.test(e.extensions?.code ?? ""))) {
    throw new SourceFetchError("Linear is rate limiting requests. Try again in a minute.");
  }
  if (!res.ok || !body?.data) {
    throw new SourceFetchError(`Linear: ${body?.errors?.[0]?.message?.slice(0, 200) ?? `HTTP ${res.status}`}`);
  }
  return body.data;
}

// --- OAuth -------------------------------------------------------------------

export function linearAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    // write: apps can create and update issues (tembak.action, src/lib/actions).
    scope: "read,write",
    state,
    prompt: "consent",
  });
  return `https://linear.app/oauth/authorize?${q}`;
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in?: number };

async function tokenRequest(params: Record<string, string>): Promise<Tokens> {
  const app = config().oauth.linear;
  if (!app) throw new Error("Linear OAuth isn't configured");
  // Linear's token endpoint only accepts form encoding.
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...params, client_id: app.clientId, client_secret: app.clientSecret }),
    redirect: "error",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Linear token request failed: ${await errorMessage(res)}`);
  const t = (await res.json()) as TokenResponse;
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    // Access tokens last about 24 hours.
    expiresAt: t.expires_in ? Date.now() + t.expires_in * 1000 : undefined,
  };
}

const ORG_QUERY = `query { organization { id name } }`;

export async function linearExchangeCode(code: string, redirectUri: string) {
  const tokens = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
  const { organization } = await gql<{ organization: { id: string; name: string } }>(`Bearer ${tokens.accessToken}`, ORG_QUERY);
  return { ...tokens, accountName: organization.name, accountId: organization.id };
}

export async function linearRefresh(refreshToken: string): Promise<Tokens | null> {
  if (!config().oauth.linear) return null;
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}

/** For the API-key fallback: checks a personal API key and names its organization. */
export async function linearVerifyKey(key: string): Promise<{ accountName: string; accountId: string }> {
  try {
    const { organization } = await gql<{ organization: { id: string; name: string } }>(key, ORG_QUERY);
    return { accountName: organization.name, accountId: organization.id };
  } catch (err) {
    if (err instanceof ConnectorAuthError) {
      throw new SourceFetchError("Linear rejected that key. Create a personal API key in Linear → Settings → Security & access.");
    }
    throw err;
  }
}

// --- Picker and rows -----------------------------------------------------------

export type LinearTeam = { id: string; key: string; name: string };

export async function linearTeams(workspaceId: string): Promise<LinearTeam[]> {
  return withAccessToken(workspaceId, "linear", linearRefresh, async (token, conn) => {
    const data = await gql<{ teams: { nodes: LinearTeam[] } }>(
      authHeader(token, conn),
      `query { teams(first: 100) { nodes { id key name } } }`,
    );
    return data.teams.nodes.sort((a, b) => a.name.localeCompare(b.name));
  });
}

const ISSUES_QUERY = `query Issues($first: Int!, $after: String, $filter: IssueFilter) {
  issues(first: $first, after: $after, filter: $filter, orderBy: updatedAt) {
    nodes {
      identifier title url priority priorityLabel estimate createdAt updatedAt completedAt dueDate
      state { name type } assignee { name } team { key } project { name } cycle { number }
      labels { nodes { name } }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

const PROJECTS_QUERY = `query Projects($first: Int!, $after: String) {
  projects(first: $first, after: $after) {
    nodes { name state progress url targetDate startDate lead { name } }
    pageInfo { hasNextPage endCursor }
  }
}`;

type Page<T> = { nodes: T[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };

export type LinearIssue = {
  identifier: string;
  title: string;
  url: string;
  priority: number;
  priorityLabel: string;
  estimate: number | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  dueDate: string | null;
  state: { name: string; type: string } | null;
  assignee: { name: string } | null;
  team: { key: string } | null;
  project: { name: string } | null;
  cycle: { number: number } | null;
  labels: { nodes: { name: string }[] };
};

export type LinearProject = {
  name: string;
  state: string;
  progress: number;
  url: string;
  targetDate: string | null;
  startDate: string | null;
  lead: { name: string } | null;
};

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : null);

export function linearIssueRow(i: LinearIssue): Row {
  return {
    identifier: i.identifier,
    title: i.title,
    state: i.state?.name ?? null,
    state_type: i.state?.type ?? null,
    priority: i.priority,
    priority_label: i.priorityLabel,
    assignee: i.assignee?.name ?? null,
    team: i.team?.key ?? null,
    project: i.project?.name ?? null,
    cycle: i.cycle?.number ?? null,
    labels: i.labels.nodes.map((l) => l.name).join(", ") || null,
    estimate: i.estimate,
    created_at: day(i.createdAt),
    updated_at: day(i.updatedAt),
    completed_at: day(i.completedAt),
    due_date: i.dueDate,
    url: i.url,
  };
}

export function linearProjectRow(p: LinearProject): Row {
  return {
    name: p.name,
    state: p.state,
    progress: Math.round(p.progress * 1000) / 10,
    lead: p.lead?.name ?? null,
    start_date: p.startDate,
    target_date: p.targetDate,
    url: p.url,
  };
}

export async function linearRows(workspaceId: string, cfg: LinearConfig): Promise<Row[]> {
  return withAccessToken(workspaceId, "linear", linearRefresh, async (token, conn) => {
    const auth = authHeader(token, conn);
    const rows: Row[] = [];
    let after: string | null = null;
    while (rows.length < MAX_ROWS) {
      if (cfg.resource === "projects") {
        const data: { projects: Page<LinearProject> } = await gql(auth, PROJECTS_QUERY, { first: PAGE, after });
        rows.push(...data.projects.nodes.map(linearProjectRow));
        if (!data.projects.pageInfo.hasNextPage) break;
        after = data.projects.pageInfo.endCursor;
      } else {
        const filter = cfg.teamKey ? { team: { key: { eq: cfg.teamKey } } } : undefined;
        const data: { issues: Page<LinearIssue> } = await gql(auth, ISSUES_QUERY, { first: PAGE, after, filter });
        rows.push(...data.issues.nodes.map(linearIssueRow));
        if (!data.issues.pageInfo.hasNextPage) break;
        after = data.issues.pageInfo.endCursor;
      }
    }
    return rows.slice(0, MAX_ROWS);
  });
}
