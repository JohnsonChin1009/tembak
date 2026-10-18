// Shared domain types. Safe to import from client and server.

export type User = {
  uid: string;
  name: string;
  email?: string;
  photoUrl?: string;
  /** Workspaces this user belongs to (avoids a collection-group query). */
  workspaceIds?: string[];
  lastWorkspaceId?: string;
};

export type Workspace = {
  id: string;
  /** Unique, used in URLs: /w/:slug */
  slug: string;
  name: string;
  createdAt: number;
  createdBy: string;
  /** Rotate to revoke old invite links. */
  inviteToken: string;
  /** Any signed-in user can join (the Demo workspace). */
  open?: boolean;
  /** Team rules injected into every agent run in this workspace. */
  agentRules?: string;
};

export type Role = "owner" | "member";

export type Member = {
  uid: string;
  role: Role;
  name: string;
  email?: string;
  photoUrl?: string;
  joinedAt: number;
};

/** What the client gets about the current workspace. */
export type WorkspaceInfo = {
  id: string;
  slug: string;
  name: string;
  open: boolean;
  role: Role;
};

export type Channel = {
  id: string;
  workspaceId: string;
  name: string;
  topic?: string;
  createdAt: number;
  createdBy: string;
};

export type MessageAuthor =
  | { kind: "user"; uid: string; name: string; photoUrl?: string }
  | { kind: "agent" };

export type AgentStatus = "thinking" | "building" | "done" | "error";

export type AppRef = { appId: string; version: number };

export type Message = {
  id: string;
  workspaceId: string;
  channelId: string;
  createdAt: number;
  author: MessageAuthor;
  text: string;
  mentionsAgent: boolean;
  appRef?: AppRef;
  status?: AgentStatus;
  /** Short progress line shown while the agent works. */
  statusLine?: string;
  error?: string;
  /** Id of the user message that triggered this agent message. */
  replyTo?: string;
};

export type App = {
  id: string;
  /** Apps created before workspaces have none; the store fills in the demo id. */
  workspaceId: string;
  slug: string;
  title: string;
  channelId: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  latestVersion: number;
  publishedVersion?: number;
  sourceKeys: string[];
};

export type AppVersion = {
  appId: string;
  n: number;
  html: string;
  summary: string;
  prompt: string;
  createdAt: number;
  createdBy: string;
  model: string;
};

export type AppVersionMeta = Omit<AppVersion, "html">;

export type Row = Record<string, string | number | boolean | null>;

export type SourceKind = "sheet" | "csv" | "json" | "sample" | "notion" | "linear";

export type LinearResource = "issues" | "projects";

export type SourceConfig =
  | { kind: "sheet"; url: string; range?: string }
  | { kind: "csv"; text: string }
  | { kind: "json"; url: string; headerName?: string; headerValue?: string }
  | { kind: "sample"; dataset: string }
  // Notion and Linear read through the workspace's connection (no token on the source).
  | { kind: "notion"; dataSourceId: string; title?: string }
  | { kind: "linear"; resource: LinearResource; teamKey?: string };

export type Source = {
  id: string;
  workspaceId: string;
  /** Unique within a workspace. */
  key: string;
  name: string;
  kind: SourceKind;
  config: SourceConfig;
  columns: string[];
  sample: Row[];
  rowCount?: number;
  updatedAt: number;
  createdBy: string;
};

export type ConnectionProvider = "notion" | "linear";

/** A workspace's link to Notion or Linear. Tokens are encrypted at rest (lib/crypto). */
export type Connection = {
  workspaceId: string;
  provider: ConnectionProvider;
  authType: "oauth" | "api_key";
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms; only set when the provider says tokens expire. */
  expiresAt?: number;
  /** Notion workspace or Linear organization name, for display. */
  accountName?: string;
  accountId?: string;
  connectedBy: string;
  connectedAt: number;
};

/** What the client sees about a connection: never the tokens. */
export type ConnectionInfo = Omit<Connection, "accessToken" | "refreshToken" | "expiresAt">;

/** A named recipe the agent can load on demand. */
export type Skill = {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  body: string;
  createdBy: string;
  updatedAt: number;
};
