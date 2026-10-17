import "server-only";
import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { firestore } from "@/lib/firebase-admin";
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

const as = <T>(d: DocumentData | undefined) => (d ? (d as T) : null);

/** Single-workspace Firestore layout; see docs/prd/01-foundation.md. */
export class FirestoreStore implements Store {
  private get db(): Firestore {
    return firestore();
  }
  private messagesCol(channelId: string) {
    return this.db.collection("channels").doc(channelId).collection("messages");
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

  async listChannels() {
    const snap = await this.db.collection("channels").orderBy("createdAt").get();
    return snap.docs.map((d) => d.data() as Channel);
  }
  async getChannel(id: string) {
    return as<Channel>((await this.db.collection("channels").doc(id).get()).data());
  }
  async createChannel(channel: Channel) {
    await this.db.collection("channels").doc(channel.id).set(channel);
  }

  async listMessages(channelId: string, limit = 100) {
    const snap = await this.messagesCol(channelId)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    return snap.docs.map((d) => d.data() as Message).reverse();
  }
  async getMessage(channelId: string, id: string) {
    return as<Message>((await this.messagesCol(channelId).doc(id).get()).data());
  }
  async addMessage(message: Message) {
    await this.messagesCol(message.channelId).doc(message.id).set(message);
  }
  async updateMessage(channelId: string, id: string, patch: Partial<Message>) {
    await this.messagesCol(channelId).doc(id).set(patch, { merge: true });
  }
  subscribeMessages(channelId: string, listener: MessageListener) {
    let first = true;
    return this.messagesCol(channelId)
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

  async listApps() {
    const snap = await this.db.collection("apps").orderBy("updatedAt", "desc").limit(200).get();
    return snap.docs.map((d) => d.data() as App);
  }
  async getApp(id: string) {
    return as<App>((await this.db.collection("apps").doc(id).get()).data());
  }
  async getAppBySlug(slug: string) {
    const snap = await this.db.collection("apps").where("slug", "==", slug).limit(1).get();
    return as<App>(snap.docs[0]?.data());
  }
  async createApp(app: App) {
    await this.db.collection("apps").doc(app.id).set(app);
  }
  async updateApp(id: string, patch: Partial<App>) {
    await this.db.collection("apps").doc(id).set(patch, { merge: true });
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

  async listSources() {
    const snap = await this.db.collection("sources").get();
    return snap.docs
      .map((d) => d.data() as Source)
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  async getSource(id: string) {
    return as<Source>((await this.db.collection("sources").doc(id).get()).data());
  }
  async getSourceByKey(key: string) {
    const snap = await this.db.collection("sources").where("key", "==", key).limit(1).get();
    return as<Source>(snap.docs[0]?.data());
  }
  async upsertSource(source: Source) {
    await this.db.collection("sources").doc(source.id).set(source);
  }
  async deleteSource(id: string) {
    await this.db.collection("sources").doc(id).delete();
  }
}
