import "server-only";
import { appSlug, randomId } from "@/lib/ids";
import { getStore } from "@/lib/store";
import type { App, AppVersion } from "@/lib/types";

type VersionInput = {
  html: string;
  summary: string;
  prompt: string;
  model: string;
  createdBy: string;
  sourceKeys: string[];
};

export async function createApp(
  input: VersionInput & { title: string; channelId: string },
): Promise<{ app: App; version: AppVersion }> {
  const store = await getStore();
  const now = Date.now();
  const app: App = {
    id: randomId(),
    slug: appSlug(input.title),
    title: input.title,
    channelId: input.channelId,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
    latestVersion: 1,
    sourceKeys: input.sourceKeys,
  };
  const version: AppVersion = {
    appId: app.id,
    n: 1,
    html: input.html,
    summary: input.summary,
    prompt: input.prompt,
    createdAt: now,
    createdBy: input.createdBy,
    model: input.model,
  };
  await store.createApp(app);
  await store.addVersion(version);
  return { app, version };
}

export async function addAppVersion(
  app: App,
  input: VersionInput,
): Promise<{ app: App; version: AppVersion }> {
  const store = await getStore();
  const now = Date.now();
  const n = app.latestVersion + 1;
  const version: AppVersion = {
    appId: app.id,
    n,
    html: input.html,
    summary: input.summary,
    prompt: input.prompt,
    createdAt: now,
    createdBy: input.createdBy,
    model: input.model,
  };
  await store.addVersion(version);
  const sourceKeys = [...new Set([...app.sourceKeys, ...input.sourceKeys])];
  await store.updateApp(app.id, { latestVersion: n, updatedAt: now, sourceKeys });
  return { app: { ...app, latestVersion: n, updatedAt: now, sourceKeys }, version };
}
