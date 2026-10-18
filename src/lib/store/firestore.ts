import "server-only";
import { FieldValue, type DocumentData, type Firestore, type Query } from "firebase-admin/firestore";
import { firestore } from "@/lib/firebase-admin";
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
  User,
  Workspace,
} from "@/lib/types";
import type { ActionRecord } from "@/lib/types";
import { nextThread } from "@/lib/threads";
import { DEMO_WORKSPACE_ID, type MessageListener, type Store } from "./types";

const as = <T>(d: DocumentData | undefined) => (d ? (d as T) : null);

const asApp = (d: DocumentData | undefined): App | null =>
  d ? { ...(d as App), workspaceId: (d as App).workspaceId ?? DEMO_WORKSPACE_ID } : null;

/** Workspace-scoped Firestore layout; see docs/prd/08-workspaces.md. */
export class FirestoreStore implements Store {
  private get db(): Firestore {
    return firestore();
  }
  private ws(workspaceId: string) {
    return this.db.collection("workspaces").doc(workspaceId);
  }
  private channelsCol(workspaceId: string) {
    return this.ws(workspaceId).collection("channels");
  }
  private messagesCol(workspaceId: string, channelId: string) {
    return this.channelsCol(workspaceId).doc(channelId).collection("messages");
  }
  private repliesCol(workspaceId: string, channelId: string, threadId: string) {
    return this.messagesCol(workspaceId, channelId).doc(threadId).collection("replies");
  }
  private sourcesCol(workspaceId: string) {
    return this.ws(workspaceId).collection("sources");
  }
  private versionsCol(appId: string) {
    return this.db.collection("apps").doc(appId).collection("versions");
  }

  async upsertUser(user: User) {
    await this.db.collection("users").doc(user.uid).set(user, { merge: true });
  }
  async getUser(uid: string) {
    return as<User>((await this.db.collection("users").doc(uid).get()).data());
  }
  async setProfile(uid: string, profile: Profile, resolved: Pick<Member, "name" | "title" | "photoUrl">) {
    const ids = (await this.getUser(uid))?.workspaceIds ?? [];
    const batch = this.db.batch();
    // mergeFields replaces the whole profile map, so cleared fields go away.
    batch.set(this.db.collection("users").doc(uid), { uid, profile }, { mergeFields: ["uid", "profile"] });
    const member = {
      name: resolved.name,
      title: resolved.title ?? FieldValue.delete(),
      photoUrl: resolved.photoUrl ?? FieldValue.delete(),
    };
    // Only touch memberships that still exist, so a stale workspace id can't create a member.
    const refs = ids.map((id) => this.ws(id).collection("members").doc(uid));
    const snaps = refs.length ? await this.db.getAll(...refs) : [];
    for (const snap of snaps) if (snap.exists) batch.update(snap.ref, member);
    await batch.commit();
  }
  async getAvatar(uid: string) {
    return as<Avatar>((await this.db.collection("avatars").doc(uid).get()).data());
  }
  async setAvatar(uid: string, avatar: Avatar | null) {
    const ref = this.db.collection("avatars").doc(uid);
    await (avatar ? ref.set(avatar) : ref.delete());
  }

  async createWorkspace(workspace: Workspace) {
    await this.ws(workspace.id).set(workspace);
  }
  async getWorkspace(id: string) {
    return as<Workspace>((await this.ws(id).get()).data());
  }
  async getWorkspaceBySlug(slug: string) {
    const snap = await this.db.collection("workspaces").where("slug", "==", slug).limit(1).get();
    return as<Workspace>(snap.docs[0]?.data());
  }
  async getWorkspaceByInvite(token: string) {
    const snap = await this.db.collection("workspaces").where("inviteToken", "==", token).limit(1).get();
    return as<Workspace>(snap.docs[0]?.data());
  }
  async updateWorkspace(id: string, patch: Partial<Workspace>) {
    await this.ws(id).set(patch, { merge: true });
  }
  async addMember(workspaceId: string, member: Member) {
    const batch = this.db.batch();
    batch.set(this.ws(workspaceId).collection("members").doc(member.uid), member);
    batch.set(
      this.db.collection("users").doc(member.uid),
      { uid: member.uid, workspaceIds: FieldValue.arrayUnion(workspaceId) },
      { merge: true },
    );
    await batch.commit();
  }
  async getMember(workspaceId: string, uid: string) {
    return as<Member>((await this.ws(workspaceId).collection("members").doc(uid).get()).data());
  }
  async listMembers(workspaceId: string) {
    const snap = await this.ws(workspaceId).collection("members").orderBy("joinedAt").get();
    return snap.docs.map((d) => d.data() as Member);
  }
  async updateOnboarding(workspaceId: string, uid: string, patch: OnboardingPatch) {
    // A merge set touches only the named fields, so concurrent step/hint writes don't clobber each other.
    const onboarding: DocumentData = {};
    if (patch.step) onboarding.steps = { [patch.step]: Date.now() };
    if (patch.hint) onboarding.hints = FieldValue.arrayUnion(patch.hint);
    if (patch.dismissed !== undefined) onboarding.dismissed = patch.dismissed;
    await this.ws(workspaceId).collection("members").doc(uid).set({ onboarding }, { merge: true });
  }
  async listWorkspacesForUser(uid: string) {
    const ids = (await this.getUser(uid))?.workspaceIds ?? [];
    if (ids.length === 0) return [];
    const snaps = await this.db.getAll(...ids.map((id) => this.ws(id)));
    return snaps.map((s) => s.data() as Workspace | undefined).filter((w): w is Workspace => !!w);
  }
  async clearWorkspace(workspaceId: string) {
    await this.db.recursiveDelete(this.channelsCol(workspaceId));
    await this.db.recursiveDelete(this.sourcesCol(workspaceId));
    const apps = await this.db.collection("apps").where("workspaceId", "==", workspaceId).get();
    for (const doc of apps.docs) await this.db.recursiveDelete(doc.ref);
  }

  async deleteWorkspace(workspaceId: string) {
    const members = await this.ws(workspaceId).collection("members").get();
    const batch = this.db.batch();
    for (const doc of members.docs) {
      batch.set(this.db.collection("users").doc(doc.id), { workspaceIds: FieldValue.arrayRemove(workspaceId) }, { merge: true });
    }
    await batch.commit();
    // Apps live at the top level; everything else is under the workspace doc.
    const apps = await this.db.collection("apps").where("workspaceId", "==", workspaceId).get();
    for (const doc of apps.docs) await this.db.recursiveDelete(doc.ref);
    await this.db.recursiveDelete(this.ws(workspaceId));
  }

  async listChannels(workspaceId: string) {
    const snap = await this.channelsCol(workspaceId).orderBy("createdAt").get();
    return snap.docs.map((d) => d.data() as Channel);
  }
  async getChannel(workspaceId: string, id: string) {
    return as<Channel>((await this.channelsCol(workspaceId).doc(id).get()).data());
  }
  async createChannel(channel: Channel) {
    await this.channelsCol(channel.workspaceId).doc(channel.id).set(channel);
  }
  async updateChannel(workspaceId: string, id: string, patch: Partial<Pick<Channel, "name" | "topic">>) {
    await this.channelsCol(workspaceId).doc(id).set(patch, { merge: true });
  }

  async listMessages(workspaceId: string, channelId: string, limit = 100) {
    const snap = await this.messagesCol(workspaceId, channelId)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    return snap.docs.map((d) => d.data() as Message).reverse();
  }
  async getMessage(workspaceId: string, channelId: string, id: string) {
    return as<Message>((await this.messagesCol(workspaceId, channelId).doc(id).get()).data());
  }
  async addMessage(message: Message) {
    const col = this.messagesCol(message.workspaceId, message.channelId);
    if (!message.threadId) {
      await col.doc(message.id).set(message);
      return;
    }
    // Reply and summary together, so concurrent replies can't lose a count.
    const parent = col.doc(message.threadId);
    await this.db.runTransaction(async (tx) => {
      const current = as<Message>((await tx.get(parent)).data());
      tx.set(parent.collection("replies").doc(message.id), message);
      if (current) tx.update(parent, { thread: nextThread(current.thread, message) });
    });
  }
  async updateMessage(workspaceId: string, channelId: string, id: string, patch: Partial<Message>, threadId?: string) {
    const col = this.messagesCol(workspaceId, channelId);
    const ref = threadId ? col.doc(threadId).collection("replies").doc(id) : col.doc(id);
    await ref.set(patch, { merge: true });
  }
  async listReplies(workspaceId: string, channelId: string, threadId: string) {
    const snap = await this.repliesCol(workspaceId, channelId, threadId).orderBy("createdAt").limit(500).get();
    return snap.docs.map((d) => d.data() as Message);
  }
  subscribeReplies(workspaceId: string, channelId: string, threadId: string, listener: MessageListener) {
    return this.subscribe(this.repliesCol(workspaceId, channelId, threadId).orderBy("createdAt", "desc").limit(500), listener);
  }
  subscribeMessages(workspaceId: string, channelId: string, listener: MessageListener) {
    return this.subscribe(this.messagesCol(workspaceId, channelId).orderBy("createdAt", "desc").limit(100), listener);
  }
  /** Newest-first query in; oldest-first snapshot, then changes, out. */
  private subscribe(query: Query, listener: MessageListener) {
    let first = true;
    return query
      .onSnapshot(
        (snap) => {
          if (first) {
            first = false;
            listener(snap.docs.map((d) => d.data() as Message).reverse(), true);
            return;
          }
          const changed = snap
            .docChanges()
            .filter((c) => c.type !== "removed")
            .map((c) => c.doc.data() as Message)
            .sort((a, b) => a.createdAt - b.createdAt);
          if (changed.length) listener(changed, false);
        },
        (err) => console.error("[store] message subscription failed", err),
      );
  }

  async listApps(workspaceId: string) {
    // Equality filter only, sorted here, so no composite index is needed.
    const snap = await this.db.collection("apps").where("workspaceId", "==", workspaceId).limit(200).get();
    return snap.docs.map((d) => asApp(d.data())!).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async getApp(id: string) {
    return asApp((await this.db.collection("apps").doc(id).get()).data());
  }
  async getAppBySlug(slug: string) {
    const snap = await this.db.collection("apps").where("slug", "==", slug).limit(1).get();
    return asApp(snap.docs[0]?.data());
  }
  async createApp(app: App) {
    await this.db.collection("apps").doc(app.id).set(app);
  }
  async updateApp(id: string, patch: Partial<App>) {
    await this.db.collection("apps").doc(id).set(patch, { merge: true });
  }
  async adoptLegacyApps(workspaceId: string) {
    // Firestore can't query for a missing field, so scan. Only pre-workspace data needs this.
    const snap = await this.db.collection("apps").select("workspaceId").limit(1000).get();
    const orphans = snap.docs.filter((d) => !d.get("workspaceId"));
    for (const d of orphans) await d.ref.set({ workspaceId }, { merge: true });
    return orphans.length;
  }

  async addVersion(version: AppVersion) {
    await this.versionsCol(version.appId).doc(String(version.n)).set(version);
  }
  async getVersion(appId: string, n: number) {
    return as<AppVersion>((await this.versionsCol(appId).doc(String(n)).get()).data());
  }
  async listVersions(appId: string): Promise<AppVersionMeta[]> {
    const snap = await this.versionsCol(appId)
      .orderBy("n")
      .select("appId", "n", "summary", "prompt", "createdAt", "createdBy", "model")
      .get();
    return snap.docs.map((d) => d.data() as AppVersionMeta);
  }

  async getKv(appId: string, key: string) {
    const snap = await this.db.collection("apps").doc(appId).collection("kv").doc(key).get();
    if (!snap.exists) return null;
    // Stored as a JSON string so arbitrary shapes (nested arrays) survive Firestore.
    return JSON.parse((snap.data() as { json: string }).json) as unknown;
  }
  async setKv(appId: string, key: string, value: unknown) {
    await this.db
      .collection("apps")
      .doc(appId)
      .collection("kv")
      .doc(key)
      .set({ json: JSON.stringify(value), updatedAt: Date.now() });
  }

  async listSources(workspaceId: string) {
    const snap = await this.sourcesCol(workspaceId).get();
    return snap.docs
      .map((d) => d.data() as Source)
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  async getSource(workspaceId: string, id: string) {
    return as<Source>((await this.sourcesCol(workspaceId).doc(id).get()).data());
  }
  async getSourceByKey(workspaceId: string, key: string) {
    const snap = await this.sourcesCol(workspaceId).where("key", "==", key).limit(1).get();
    return as<Source>(snap.docs[0]?.data());
  }
  async upsertSource(source: Source) {
    await this.sourcesCol(source.workspaceId).doc(source.id).set(source);
  }
  async deleteSource(workspaceId: string, id: string) {
    await this.sourcesCol(workspaceId).doc(id).delete();
  }

  async listConnections(workspaceId: string) {
    const snap = await this.ws(workspaceId).collection("connections").get();
    return snap.docs.map((d) => d.data() as Connection);
  }
  async getConnection(workspaceId: string, provider: ConnectionProvider) {
    return as<Connection>((await this.ws(workspaceId).collection("connections").doc(provider).get()).data());
  }
  async upsertConnection(connection: Connection) {
    await this.ws(connection.workspaceId).collection("connections").doc(connection.provider).set(connection);
  }
  async deleteConnection(workspaceId: string, provider: ConnectionProvider) {
    await this.ws(workspaceId).collection("connections").doc(provider).delete();
  }

  async listSkills(workspaceId: string) {
    const snap = await this.ws(workspaceId).collection("skills").get();
    return snap.docs.map((d) => d.data() as Skill).sort((a, b) => a.name.localeCompare(b.name));
  }
  async upsertSkill(skill: Skill) {
    await this.ws(skill.workspaceId).collection("skills").doc(skill.id).set(skill);
  }
  async deleteSkill(workspaceId: string, id: string) {
    await this.ws(workspaceId).collection("skills").doc(id).delete();
  }

  async addActionRecord(record: ActionRecord) {
    await this.ws(record.workspaceId).collection("actions").doc(record.id).set(record);
  }
  async listActionRecords(workspaceId: string, limit = 50) {
    const snap = await this.ws(workspaceId).collection("actions").orderBy("at", "desc").limit(limit).get();
    return snap.docs.map((d) => d.data() as ActionRecord);
  }
}
