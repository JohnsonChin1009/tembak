import { EventEmitter } from "node:events";
import type {
  App,
  AppVersion,
  AppVersionMeta,
  Channel,
  Member,
  Message,
  Source,
  User,
  Workspace,
} from "@/lib/types";
import { DEMO_WORKSPACE_ID, type MessageListener, type Store } from "./types";

// Channels and messages are keyed by "<workspaceId>/<channelId>".
const k = (workspaceId: string, id: string) => `${workspaceId}/${id}`;

const withWorkspace = (app: App): App => ({ ...app, workspaceId: app.workspaceId ?? DEMO_WORKSPACE_ID });

/** Process-local store for development. Data resets on server restart. */
export class MemoryStore implements Store {
  private users = new Map<string, User>();
  private workspaces = new Map<string, Workspace>();
  private members = new Map<string, Map<string, Member>>();
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

  async createWorkspace(workspace: Workspace) {
    this.workspaces.set(workspace.id, workspace);
  }
  async getWorkspace(id: string) {
    return this.workspaces.get(id) ?? null;
  }
  async getWorkspaceBySlug(slug: string) {
    return [...this.workspaces.values()].find((w) => w.slug === slug) ?? null;
  }
  async getWorkspaceByInvite(token: string) {
    return [...this.workspaces.values()].find((w) => w.inviteToken === token) ?? null;
  }
  async updateWorkspace(id: string, patch: Partial<Workspace>) {
    const ws = this.workspaces.get(id);
    if (ws) this.workspaces.set(id, { ...ws, ...patch });
  }
  async addMember(workspaceId: string, member: Member) {
    const list = this.members.get(workspaceId) ?? new Map<string, Member>();
    list.set(member.uid, member);
    this.members.set(workspaceId, list);
    const user = this.users.get(member.uid);
    const ids = new Set(user?.workspaceIds ?? []).add(workspaceId);
    this.users.set(member.uid, { uid: member.uid, name: member.name, ...user, workspaceIds: [...ids] });
  }
  async getMember(workspaceId: string, uid: string) {
    return this.members.get(workspaceId)?.get(uid) ?? null;
  }
  async listMembers(workspaceId: string) {
    return [...(this.members.get(workspaceId)?.values() ?? [])].sort((a, b) => a.joinedAt - b.joinedAt);
  }
  async listWorkspacesForUser(uid: string) {
    const ids = this.users.get(uid)?.workspaceIds ?? [];
    return ids.map((id) => this.workspaces.get(id)).filter((w): w is Workspace => !!w);
  }
  async clearWorkspace(workspaceId: string) {
    const prefix = `${workspaceId}/`;
    for (const key of [...this.channels.keys()]) if (key.startsWith(prefix)) this.channels.delete(key);
    for (const key of [...this.messages.keys()]) if (key.startsWith(prefix)) this.messages.delete(key);
    for (const [id, s] of this.sources) if (s.workspaceId === workspaceId) this.sources.delete(id);
    for (const [id, a] of this.apps) {
      if (withWorkspace(a).workspaceId !== workspaceId) continue;
      this.apps.delete(id);
      this.versions.delete(id);
      for (const key of [...this.kv.keys()]) if (key.startsWith(`${id}/`)) this.kv.delete(key);
    }
  }

  async listChannels(workspaceId: string) {
    return [...this.channels.values()]
      .filter((c) => c.workspaceId === workspaceId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }
  async getChannel(workspaceId: string, id: string) {
    return this.channels.get(k(workspaceId, id)) ?? null;
  }
  async createChannel(channel: Channel) {
    this.channels.set(k(channel.workspaceId, channel.id), channel);
  }

  async listMessages(workspaceId: string, channelId: string, limit = 100) {
    return structuredClone((this.messages.get(k(workspaceId, channelId)) ?? []).slice(-limit));
  }
  async getMessage(workspaceId: string, channelId: string, id: string) {
    const m = this.messages.get(k(workspaceId, channelId))?.find((x) => x.id === id);
    return m ? structuredClone(m) : null;
  }
  async addMessage(message: Message) {
    const key = k(message.workspaceId, message.channelId);
    const list = this.messages.get(key) ?? [];
    list.push(message);
    list.sort((a, b) => a.createdAt - b.createdAt);
    this.messages.set(key, list);
    this.bus.emit(key, structuredClone(message));
  }
  async updateMessage(workspaceId: string, channelId: string, id: string, patch: Partial<Message>) {
    const key = k(workspaceId, channelId);
    const list = this.messages.get(key) ?? [];
    const i = list.findIndex((m) => m.id === id);
    if (i < 0) return;
    list[i] = { ...list[i], ...patch };
    this.bus.emit(key, structuredClone(list[i]));
  }
  subscribeMessages(workspaceId: string, channelId: string, listener: MessageListener) {
    const key = k(workspaceId, channelId);
    const onMessage = (m: Message) => listener([m], false);
    this.bus.on(key, onMessage);
    void this.listMessages(workspaceId, channelId).then((ms) => listener(ms, true));
    return () => {
      this.bus.off(key, onMessage);
    };
  }

  async listApps(workspaceId: string) {
    return [...this.apps.values()]
      .map(withWorkspace)
      .filter((a) => a.workspaceId === workspaceId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async getApp(id: string) {
    const app = this.apps.get(id);
    return app ? withWorkspace(app) : null;
  }
  async getAppBySlug(slug: string) {
    const app = [...this.apps.values()].find((a) => a.slug === slug);
    return app ? withWorkspace(app) : null;
  }
  async createApp(app: App) {
    this.apps.set(app.id, app);
  }
  async updateApp(id: string, patch: Partial<App>) {
    const app = this.apps.get(id);
    if (app) this.apps.set(id, { ...app, ...patch });
  }
  async adoptLegacyApps(workspaceId: string) {
    let n = 0;
    for (const [id, a] of this.apps) {
      if (a.workspaceId) continue;
      this.apps.set(id, { ...a, workspaceId });
      n++;
    }
    return n;
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

  async listSources(workspaceId: string) {
    return [...this.sources.values()]
      .filter((s) => s.workspaceId === workspaceId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  async getSource(workspaceId: string, id: string) {
    const s = this.sources.get(id);
    return s?.workspaceId === workspaceId ? s : null;
  }
  async getSourceByKey(workspaceId: string, key: string) {
    return [...this.sources.values()].find((s) => s.workspaceId === workspaceId && s.key === key) ?? null;
  }
  async upsertSource(source: Source) {
    this.sources.set(source.id, source);
  }
  async deleteSource(workspaceId: string, id: string) {
    if (this.sources.get(id)?.workspaceId === workspaceId) this.sources.delete(id);
  }
}
