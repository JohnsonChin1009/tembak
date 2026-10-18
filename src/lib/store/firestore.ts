import "server-only";
import { FieldValue, type DocumentData, type Firestore } from "firebase-admin/firestore";
import { firestore } from "@/lib/firebase-admin";
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
    await this.messagesCol(message.workspaceId, message.channelId).doc(message.id).set(message);
  }
  async updateMessage(workspaceId: string, channelId: string, id: string, patch: Partial<Message>) {
    await this.messagesCol(workspaceId, channelId).doc(id).set(patch, { merge: true });
  }
  subscribeMessages(workspaceId: string, channelId: string, listener: MessageListener) {
    let first = true;
    return this.messagesCol(workspaceId, channelId)
      .orderBy("createdAt", "desc")
      .limit(100)
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
}
