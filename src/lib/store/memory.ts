import { EventEmitter } from "node:events";
import type {
  App,
  AppVersion,
  AppVersionMeta,
  Channel,
  Message,
  Source,
  User,
} from "@/lib/types";
import type { MessageListener, Store } from "./types";

/** Process-local store for development. Data resets on server restart. */
export class MemoryStore implements Store {
  private users = new Map<string, User>();
  private channels = new Map<string, Channel>();
  private messages = new Map<string, Message[]>();
  private apps = new Map<string, App>();
  private versions = new Map<string, AppVersion[]>();
  private sources = new Map<string, Source>();
  private kv = new Map<string, unknown>();
  private bus = new EventEmitter().setMaxListeners(0);

  async upsertUser(user: User) {
    this.users.set(user.uid, { ...this.users.get(user.uid), ...user });
  }
  async getUser(uid: string) {
    return this.users.get(uid) ?? null;
  }

  async listChannels() {
    return [...this.channels.values()].sort((a, b) => a.createdAt - b.createdAt);
  }
  async getChannel(id: string) {
    return this.channels.get(id) ?? null;
  }
  async createChannel(channel: Channel) {
    this.channels.set(channel.id, channel);
  }

  async listMessages(channelId: string, limit = 100) {
    return structuredClone((this.messages.get(channelId) ?? []).slice(-limit));
  }
  async getMessage(channelId: string, id: string) {
    const m = this.messages.get(channelId)?.find((x) => x.id === id);
    return m ? structuredClone(m) : null;
  }
  async addMessage(message: Message) {
    const list = this.messages.get(message.channelId) ?? [];
    list.push(message);
    list.sort((a, b) => a.createdAt - b.createdAt);
    this.messages.set(message.channelId, list);
    this.bus.emit(message.channelId, structuredClone(message));
  }
  async updateMessage(channelId: string, id: string, patch: Partial<Message>) {
    const list = this.messages.get(channelId) ?? [];
    const i = list.findIndex((m) => m.id === id);
    if (i < 0) return;
    list[i] = { ...list[i], ...patch };
    this.bus.emit(channelId, structuredClone(list[i]));
  }
  subscribeMessages(channelId: string, listener: MessageListener) {
    const onMessage = (m: Message) => listener([m], false);
    this.bus.on(channelId, onMessage);
    void this.listMessages(channelId).then((ms) => listener(ms, true));
    return () => {
      this.bus.off(channelId, onMessage);
    };
  }

  async listApps() {
    return [...this.apps.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async getApp(id: string) {
    return this.apps.get(id) ?? null;
  }
  async getAppBySlug(slug: string) {
    return [...this.apps.values()].find((a) => a.slug === slug) ?? null;
  }
  async createApp(app: App) {
    this.apps.set(app.id, app);
  }
  async updateApp(id: string, patch: Partial<App>) {
    const app = this.apps.get(id);
    if (app) this.apps.set(id, { ...app, ...patch });
  }

  async addVersion(version: AppVersion) {
    const list = this.versions.get(version.appId) ?? [];
    list.push(version);
    this.versions.set(version.appId, list);
  }
  async getVersion(appId: string, n: number) {
    return this.versions.get(appId)?.find((v) => v.n === n) ?? null;
  }
  async listVersions(appId: string): Promise<AppVersionMeta[]> {
    return (this.versions.get(appId) ?? [])
      .map((v) => {
        const meta: Partial<AppVersion> = { ...v };
        delete meta.html;
        return meta as AppVersionMeta;
      })
      .sort((a, b) => a.n - b.n);
  }

  async getKv(appId: string, key: string) {
    const v = this.kv.get(`${appId}/${key}`);
    return v === undefined ? null : structuredClone(v);
  }
  async setKv(appId: string, key: string, value: unknown) {
    this.kv.set(`${appId}/${key}`, structuredClone(value));
  }

  async listSources() {
    return [...this.sources.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  async getSource(id: string) {
    return this.sources.get(id) ?? null;
  }
  async getSourceByKey(key: string) {
    return [...this.sources.values()].find((s) => s.key === key) ?? null;
  }
  async upsertSource(source: Source) {
    this.sources.set(source.id, source);
  }
  async deleteSource(id: string) {
    this.sources.delete(id);
  }
}
