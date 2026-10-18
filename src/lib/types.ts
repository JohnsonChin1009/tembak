// Shared domain types. Safe to import from client and server.

export type User = {
  uid: string;
  name: string;
  email?: string;
  photoUrl?: string;
  /** From the profile page; see `profile`. */
  title?: string;
  /** What the user set on the profile page. Overrides the sign-in name and photo. */
  profile?: Profile;
  /** Workspaces this user belongs to (avoids a collection-group query). */
  workspaceIds?: string[];
  lastWorkspaceId?: string;
};

/** Profile edits. `photoUrl: ""` means the user removed their photo. */
export type Profile = {
  name?: string;
  title?: string;
  photoUrl?: string;
};

/** A stored profile picture, served from /api/avatars/:uid. */
export type Avatar = {
  contentType: string;
  /** Base64 image bytes. */
  data: string;
  updatedAt: number;
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
  title?: string;
  joinedAt: number;
  onboarding?: MemberOnboarding;
};

export type OnboardingStep = "mention" | "preview" | "revise" | "publish" | "invite";

/** Per-member first-run progress: checklist steps (timestamps) and hints already shown. */
export type MemberOnboarding = {
  dismissed?: boolean;
  steps: Partial<Record<OnboardingStep, number>>;
  hints: string[];
};

export type OnboardingPatch = { step?: OnboardingStep; hint?: string; dismissed?: boolean };

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
  | { kind: "agent" }
  /** Posted by an app through tembak.post, on behalf of the member using it. */
  | { kind: "app"; appId: string; appTitle: string; uid: string; name: string };

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
  /** A button rendered under the message (seeded welcome messages). */
  action?: "invite";
  /** Set on thread replies: the id of the channel message they reply to. */
  threadId?: string;
  /** Set on a channel message once it has replies. */
  thread?: ThreadSummary;
};

/** Per-member count of unread tags of them, by channel id. Thread replies count for their channel. */
export type UnreadMentions = Record<string, number>;

export type ThreadSummary = {
  count: number;
  lastAt: number;
  /** Most recent repliers first, at most three; "agent" for Tembak. */
  uids: string[];
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

/** Audit trail for tembak.action: one record per write an app attempted. */
export type ActionRecord = {
  id: string;
  workspaceId: string;
  appId: string;
  uid: string;
  /** e.g. "linear.createIssue". */
  name: string;
  /** The input as JSON, cut to 2 KB. */
  input: string;
  ok: boolean;
  error?: string;
  at: number;
};
