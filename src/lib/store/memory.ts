import { EventEmitter } from "node:events";
import type {
  App,
  Avatar,
  AppVersion,
  AppVersionMeta,
  Channel,
  Connection,
  ConnectionProvider,
  Member,
  Message,
  OnboardingPatch,
  Profile,
  Skill,
  Source,
  UnreadMentions,
  User,
  Workflow,
  Workspace,
} from "@/lib/types";
import type { ActionRecord } from "@/lib/types";
import { nextThread } from "@/lib/threads";
import { DEMO_WORKSPACE_ID, type MessageListener, type Store } from "./types";

// Channels and messages are keyed by "<workspaceId>/<channelId>".
const k = (workspaceId: string, id: string) => `${workspaceId}/${id}`;
// Thread replies: "<workspaceId>/<channelId>#<threadId>", so workspace cleanup by prefix covers them.
const tk = (workspaceId: string, channelId: string, threadId: string) => `${k(workspaceId, channelId)}#${threadId}`;

const withWorkspace = (app: App): App => ({ ...app, workspaceId: app.workspaceId ?? DEMO_WORKSPACE_ID });

/** Process-local store for development. Data resets on server restart. */
export class MemoryStore implements Store {
  private users = new Map<string, User>();
  private avatars = new Map<string, Avatar>();
  private workspaces = new Map<string, Workspace>();
  private members = new Map<string, Map<string, Member>>();
  private channels = new Map<string, Channel>();
  private messages = new Map<string, Message[]>();
  private apps = new Map<string, App>();
  private versions = new Map<string, AppVersion[]>();
  private sources = new Map<string, Source>();
  private kv = new Map<string, unknown>();
  private connections = new Map<string, Connection>();
  private skills = new Map<string, Skill>();
  private actions = new Map<string, ActionRecord>();
  private workflows = new Map<string, Workflow>();
  // Keyed by "<workspaceId>/<uid>".
  private mentions = new Map<string, UnreadMentions>();
  private bus = new EventEmitter().setMaxListeners(0);

  async upsertUser(user: User) {
    this.users.set(user.uid, { ...this.users.get(user.uid), ...user });
  }
  async getUser(uid: string) {
    return this.users.get(uid) ?? null;
  }
  async setProfile(uid: string, profile: Profile, resolved: Pick<Member, "name" | "title" | "photoUrl">) {
    const user = this.users.get(uid) ?? { uid, name: resolved.name };
    this.users.set(uid, { ...user, profile });
    for (const id of user.workspaceIds ?? []) {
      const member = this.members.get(id)?.get(uid);
      if (member) Object.assign(member, resolved);
    }
  }
  async getAvatar(uid: string) {
    return this.avatars.get(uid) ?? null;
  }
  async setAvatar(uid: string, avatar: Avatar | null) {
    if (avatar) this.avatars.set(uid, avatar);
    else this.avatars.delete(uid);
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
  async updateOnboarding(workspaceId: string, uid: string, patch: OnboardingPatch) {
    const member = this.members.get(workspaceId)?.get(uid);
    if (!member) return;
    const ob = member.onboarding ?? { steps: {}, hints: [] };
    member.onboarding = {
      dismissed: patch.dismissed ?? ob.dismissed,
      steps: patch.step ? { ...ob.steps, [patch.step]: Date.now() } : ob.steps,
      hints: patch.hint && !ob.hints.includes(patch.hint) ? [...ob.hints, patch.hint] : ob.hints,
    };
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
    for (const [id, w] of this.workflows) if (w.workspaceId === workspaceId) this.workflows.delete(id);
  }

  async deleteWorkspace(workspaceId: string) {
    await this.clearWorkspace(workspaceId);
    const prefix = `${workspaceId}/`;
    for (const key of [...this.connections.keys()]) if (key.startsWith(prefix)) this.connections.delete(key);
    for (const key of [...this.skills.keys()]) if (key.startsWith(prefix)) this.skills.delete(key);
    for (const key of [...this.actions.keys()]) if (key.startsWith(prefix)) this.actions.delete(key);
    for (const key of [...this.mentions.keys()]) if (key.startsWith(prefix)) this.mentions.delete(key);
    for (const uid of this.members.get(workspaceId)?.keys() ?? []) {
      const user = this.users.get(uid);
      if (!user) continue;
      this.users.set(uid, {
        ...user,
        workspaceIds: (user.workspaceIds ?? []).filter((id) => id !== workspaceId),
        lastWorkspaceId: user.lastWorkspaceId === workspaceId ? undefined : user.lastWorkspaceId,
      });
    }
    this.members.delete(workspaceId);
    this.workspaces.delete(workspaceId);
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
  async updateChannel(workspaceId: string, id: string, patch: Partial<Pick<Channel, "name" | "topic">>) {
    const channel = this.channels.get(k(workspaceId, id));
    if (channel) this.channels.set(k(workspaceId, id), { ...channel, ...patch });
  }

  async listMessages(workspaceId: string, channelId: string, limit = 100) {
    return structuredClone((this.messages.get(k(workspaceId, channelId)) ?? []).slice(-limit));
  }
  async getMessage(workspaceId: string, channelId: string, id: string) {
    const m = this.messages.get(k(workspaceId, channelId))?.find((x) => x.id === id);
    return m ? structuredClone(m) : null;
  }
  async addMessage(message: Message) {
    const key = message.threadId ? tk(message.workspaceId, message.channelId, message.threadId) : k(message.workspaceId, message.channelId);
    const list = this.messages.get(key) ?? [];
    list.push(message);
    list.sort((a, b) => a.createdAt - b.createdAt);
    this.messages.set(key, list);
    this.bus.emit(key, structuredClone(message));
    if (message.threadId) {
      const parent = this.messages.get(k(message.workspaceId, message.channelId))?.find((m) => m.id === message.threadId);
      if (parent) {
        parent.thread = nextThread(parent.thread, message);
        this.bus.emit(k(message.workspaceId, message.channelId), structuredClone(parent));
      }
    }
  }
  async updateMessage(workspaceId: string, channelId: string, id: string, patch: Partial<Message>, threadId?: string) {
    const key = threadId ? tk(workspaceId, channelId, threadId) : k(workspaceId, channelId);
    const list = this.messages.get(key) ?? [];
    const i = list.findIndex((m) => m.id === id);
    if (i < 0) return;
    list[i] = { ...list[i], ...patch };
    this.bus.emit(key, structuredClone(list[i]));
  }
  subscribeMessages(workspaceId: string, channelId: string, listener: MessageListener) {
    return this.subscribe(k(workspaceId, channelId), () => this.listMessages(workspaceId, channelId), listener);
  }
  async listReplies(workspaceId: string, channelId: string, threadId: string) {
    return structuredClone(this.messages.get(tk(workspaceId, channelId, threadId)) ?? []);
  }
  subscribeReplies(workspaceId: string, channelId: string, threadId: string, listener: MessageListener) {
    return this.subscribe(tk(workspaceId, channelId, threadId), () => this.listReplies(workspaceId, channelId, threadId), listener);
  }
  private subscribe(key: string, initial: () => Promise<Message[]>, listener: MessageListener) {
    const onMessage = (m: Message) => listener([m], false);
    this.bus.on(key, onMessage);
    void initial().then((ms) => listener(ms, true));
    return () => {
      this.bus.off(key, onMessage);
    };
  }

  async addMentions(workspaceId: string, channelId: string, uids: string[]) {
    for (const uid of uids) {
      const counts = this.mentions.get(k(workspaceId, uid)) ?? {};
      this.mentions.set(k(workspaceId, uid), { ...counts, [channelId]: (counts[channelId] ?? 0) + 1 });
    }
  }
  async getMentions(workspaceId: string, uid: string) {
    return { ...this.mentions.get(k(workspaceId, uid)) };
  }
  async clearMentions(workspaceId: string, uid: string, channelId: string) {
    const counts = this.mentions.get(k(workspaceId, uid));
    if (counts) delete counts[channelId];
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

  async listConnections(workspaceId: string) {
    return [...this.connections.values()].filter((c) => c.workspaceId === workspaceId);
  }
  async getConnection(workspaceId: string, provider: ConnectionProvider) {
    return this.connections.get(k(workspaceId, provider)) ?? null;
  }
  async upsertConnection(connection: Connection) {
    this.connections.set(k(connection.workspaceId, connection.provider), connection);
  }
  async deleteConnection(workspaceId: string, provider: ConnectionProvider) {
    this.connections.delete(k(workspaceId, provider));
  }

  async listSkills(workspaceId: string) {
    return [...this.skills.values()]
      .filter((s) => s.workspaceId === workspaceId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  async upsertSkill(skill: Skill) {
    this.skills.set(k(skill.workspaceId, skill.id), skill);
  }
  async deleteSkill(workspaceId: string, id: string) {
    this.skills.delete(k(workspaceId, id));
  }

  async addActionRecord(record: ActionRecord) {
    this.actions.set(k(record.workspaceId, record.id), record);
  }
  async listActionRecords(workspaceId: string, limit = 50) {
    return [...this.actions.values()]
      .filter((a) => a.workspaceId === workspaceId)
      .sort((a, b) => b.at - a.at)
      .slice(0, limit);
  }

  async listWorkflows(workspaceId: string) {
    return [...this.workflows.values()]
      .filter((w) => w.workspaceId === workspaceId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }
  async getWorkflow(id: string) {
    return this.workflows.get(id) ?? null;
  }
  async upsertWorkflow(workflow: Workflow) {
    this.workflows.set(workflow.id, workflow);
  }
  async updateWorkflow(id: string, patch: Partial<Workflow>) {
    const w = this.workflows.get(id);
    if (w) this.workflows.set(id, { ...w, ...patch });
  }
  async deleteWorkflow(id: string) {
    this.workflows.delete(id);
  }
  async listDueWorkflows(now: number, limit: number) {
    return [...this.workflows.values()]
      .filter((w) => w.nextRunAt <= now)
      .sort((a, b) => a.nextRunAt - b.nextRunAt)
      .slice(0, limit);
  }
  async claimWorkflow(id: string, expected: number, next: number) {
    const w = this.workflows.get(id);
    if (!w || w.nextRunAt !== expected) return false;
    this.workflows.set(id, { ...w, nextRunAt: next });
    return true;
  }
}
