import type {
  App,
  AppVersion,
  AppVersionMeta,
  Channel,
  Connection,
  ConnectionProvider,
  Member,
  Message,
  OnboardingPatch,
  Skill,
  Source,
  User,
  Workspace,
} from "@/lib/types";

export type MessageListener = (messages: Message[], initial: boolean) => void;

/** The open demo workspace. Apps created before workspaces existed belong to it. */
export const DEMO_WORKSPACE_ID = "demo";

export interface Store {
  upsertUser(user: User): Promise<void>;
  getUser(uid: string): Promise<User | null>;

  createWorkspace(workspace: Workspace): Promise<void>;
  getWorkspace(id: string): Promise<Workspace | null>;
  getWorkspaceBySlug(slug: string): Promise<Workspace | null>;
  getWorkspaceByInvite(token: string): Promise<Workspace | null>;
  updateWorkspace(id: string, patch: Partial<Workspace>): Promise<void>;
  /** Also records the workspace on the user's `workspaceIds`. */
  addMember(workspaceId: string, member: Member): Promise<void>;
  getMember(workspaceId: string, uid: string): Promise<Member | null>;
  listMembers(workspaceId: string): Promise<Member[]>;
  /** Merges one onboarding change into the member (field-level, safe under concurrent calls). */
  updateOnboarding(workspaceId: string, uid: string, patch: OnboardingPatch): Promise<void>;
  listWorkspacesForUser(uid: string): Promise<Workspace[]>;
  /** Deletes a workspace's channels, messages, sources, and apps. Keeps the workspace and members. */
  clearWorkspace(workspaceId: string): Promise<void>;
  /** Deletes the workspace and everything in it, and removes it from members' workspace lists. */
  deleteWorkspace(workspaceId: string): Promise<void>;

  listChannels(workspaceId: string): Promise<Channel[]>;
  getChannel(workspaceId: string, id: string): Promise<Channel | null>;
  createChannel(channel: Channel): Promise<void>;
  updateChannel(workspaceId: string, id: string, patch: Partial<Pick<Channel, "name" | "topic">>): Promise<void>;

  /** Most recent `limit` messages, oldest first. */
  listMessages(workspaceId: string, channelId: string, limit?: number): Promise<Message[]>;
  getMessage(workspaceId: string, channelId: string, id: string): Promise<Message | null>;
  addMessage(message: Message): Promise<void>;
  updateMessage(workspaceId: string, channelId: string, id: string, patch: Partial<Message>): Promise<void>;
  /** Emits the recent history once (initial=true), then every added or changed message. */
  subscribeMessages(workspaceId: string, channelId: string, listener: MessageListener): () => void;

  listApps(workspaceId: string): Promise<App[]>;
  getApp(id: string): Promise<App | null>;
  getAppBySlug(slug: string): Promise<App | null>;
  createApp(app: App): Promise<void>;
  updateApp(id: string, patch: Partial<App>): Promise<void>;
  /** Gives apps created before workspaces a `workspaceId`. Returns how many changed. */
  adoptLegacyApps(workspaceId: string): Promise<number>;

  addVersion(version: AppVersion): Promise<void>;
  getVersion(appId: string, n: number): Promise<AppVersion | null>;
  listVersions(appId: string): Promise<AppVersionMeta[]>;

  /** Small JSON values that generated apps persist through `tembak.kv`. */
  getKv(appId: string, key: string): Promise<unknown | null>;
  setKv(appId: string, key: string, value: unknown): Promise<void>;

  listSources(workspaceId: string): Promise<Source[]>;
  getSource(workspaceId: string, id: string): Promise<Source | null>;
  getSourceByKey(workspaceId: string, key: string): Promise<Source | null>;
  upsertSource(source: Source): Promise<void>;
  deleteSource(workspaceId: string, id: string): Promise<void>;

  /** Notion and Linear links, one per provider per workspace. Tokens arrive and leave sealed. */
  listConnections(workspaceId: string): Promise<Connection[]>;
  getConnection(workspaceId: string, provider: ConnectionProvider): Promise<Connection | null>;
  upsertConnection(connection: Connection): Promise<void>;
  deleteConnection(workspaceId: string, provider: ConnectionProvider): Promise<void>;

  /** Workspace skills for the agent (built-ins live in code). */
  listSkills(workspaceId: string): Promise<Skill[]>;
  upsertSkill(skill: Skill): Promise<void>;
  deleteSkill(workspaceId: string, id: string): Promise<void>;
}
