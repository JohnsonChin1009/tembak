import type {
  App,
  AppVersion,
  AppVersionMeta,
  Channel,
  Message,
  Source,
  User,
} from "@/lib/types";

export type MessageListener = (messages: Message[], initial: boolean) => void;

export interface Store {
  upsertUser(user: User): Promise<void>;
  getUser(uid: string): Promise<User | null>;

  listChannels(): Promise<Channel[]>;
  getChannel(id: string): Promise<Channel | null>;
  createChannel(channel: Channel): Promise<void>;

  /** Most recent `limit` messages, oldest first. */
  listMessages(channelId: string, limit?: number): Promise<Message[]>;
  getMessage(channelId: string, id: string): Promise<Message | null>;
  addMessage(message: Message): Promise<void>;
  updateMessage(channelId: string, id: string, patch: Partial<Message>): Promise<void>;
  /** Emits the recent history once (initial=true), then every added or changed message. */
  subscribeMessages(channelId: string, listener: MessageListener): () => void;

  listApps(): Promise<App[]>;
  getApp(id: string): Promise<App | null>;
  getAppBySlug(slug: string): Promise<App | null>;
  createApp(app: App): Promise<void>;
  updateApp(id: string, patch: Partial<App>): Promise<void>;

  addVersion(version: AppVersion): Promise<void>;
  getVersion(appId: string, n: number): Promise<AppVersion | null>;
  listVersions(appId: string): Promise<AppVersionMeta[]>;

  listSources(): Promise<Source[]>;
  getSource(id: string): Promise<Source | null>;
  getSourceByKey(key: string): Promise<Source | null>;
  upsertSource(source: Source): Promise<void>;
  deleteSource(id: string): Promise<void>;
}
