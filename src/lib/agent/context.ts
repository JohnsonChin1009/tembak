import "server-only";
import { stripMention } from "@/lib/mentions";
import { getStore } from "@/lib/store";
import type { App, AppVersion, Message, Source } from "@/lib/types";
import { workspaceSkills, type SkillDef } from "./skills";

const HISTORY = 40;

export type AgentContext = {
  trigger: Message;
  request: string;
  transcript: string;
  channelApps: App[];
  /** App the user is explicitly asking to change (from the builder panel). */
  targetApp: App | null;
  sources: Source[];
  /** Workspace rules for every run (Agent settings). */
  rules?: string;
  skills: SkillDef[];
};

const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

/** "<@uid>" tags as "@Name", so the agent reads people, not ids. */
function names(text: string, members: Map<string, string>): string {
  return text.replace(/<@([A-Za-z0-9_-]+)>/g, (tag, uid: string) => `@${members.get(uid) ?? "someone"}`);
}

function line(m: Message, apps: Map<string, App>, members: Map<string, string>): string | null {
  const t = timeFmt.format(m.createdAt);
  if (m.author.kind === "agent") {
    if (m.status === "thinking" || m.status === "building") return null;
    const app = m.appRef ? apps.get(m.appRef.appId) : undefined;
    const built = app ? ` [built app "${app.title}" v${m.appRef!.version}, id ${app.id}]` : "";
    return `[${t}] Tembak (you): ${m.text}${built}`.trim();
  }
  if (m.author.kind === "app") {
    return `[${t}] App "${m.author.appTitle}" (posted by ${m.author.name}): ${names(m.text, members)}`;
  }
  const about = m.appRef ? ` [about app id ${m.appRef.appId}]` : "";
  return `[${t}] ${m.author.name}${about}: ${names(m.text, members)}`;
}

/** In a thread, the conversation is the parent message and its replies. */
function threadHistory(trigger: Message): Promise<Message[]> | null {
  const { workspaceId, channelId, threadId } = trigger;
  if (!threadId) return null;
  return getStore().then(async (store) => {
    const [parent, replies] = await Promise.all([
      store.getMessage(workspaceId, channelId, threadId),
      store.listReplies(workspaceId, channelId, threadId),
    ]);
    return parent ? [parent, ...replies] : replies;
  });
}

export async function buildContext(trigger: Message): Promise<AgentContext> {
  const store = await getStore();
  const [history, allApps, sources, workspace, skills, members] = await Promise.all([
    threadHistory(trigger) ?? store.listMessages(trigger.workspaceId, trigger.channelId, HISTORY + 5),
    store.listApps(trigger.workspaceId),
    store.listSources(trigger.workspaceId),
    store.getWorkspace(trigger.workspaceId),
    workspaceSkills(trigger.workspaceId),
    store.listMembers(trigger.workspaceId),
  ]);
  const memberNames = new Map(members.map((m) => [m.uid, m.name]));
  const channelApps = allApps.filter((a) => a.channelId === trigger.channelId);
  const appsById = new Map(allApps.map((a) => [a.id, a]));

  const upto = history.filter((m) => m.createdAt <= trigger.createdAt).slice(-HISTORY);
  const transcript = upto
    .map((m) => line(m, appsById, memberNames))
    .filter(Boolean)
    .join("\n");

  return {
    trigger,
    request: names(stripMention(trigger.text), memberNames),
    transcript,
    channelApps,
    targetApp: trigger.appRef ? (appsById.get(trigger.appRef.appId) ?? null) : null,
    sources,
    rules: workspace?.agentRules?.trim() || undefined,
    skills,
  };
}

export function describeSources(sources: Source[]): string {
  if (sources.length === 0) return "(none connected)";
  return sources
    .map((s) => {
      const sample = JSON.stringify(s.sample.slice(0, 3));
      return `- key "${s.key}": ${s.name} (${s.kind}${s.rowCount ? `, ${s.rowCount} rows` : ""})\n  columns: ${s.columns.join(", ")}\n  sample rows: ${sample}`;
    })
    .join("\n");
}

/** Without sample rows: what the agent loop needs to pick a source (query_source shows data). */
export function describeSourcesBrief(sources: Source[]): string {
  if (sources.length === 0) return "(none connected)";
  return sources
    .map((s) => `- key "${s.key}": ${s.name} (${s.kind}${s.rowCount ? `, ${s.rowCount} rows` : ""}); columns: ${s.columns.join(", ")}`)
    .join("\n");
}

export function describeApps(apps: App[]): string {
  if (apps.length === 0) return "(none yet)";
  return apps
    .map((a) => `- id ${a.id}: "${a.title}" (latest v${a.latestVersion}${a.publishedVersion ? `, live v${a.publishedVersion}` : ", draft"})`)
    .join("\n");
}

export async function currentVersion(app: App): Promise<AppVersion | null> {
  return (await getStore()).getVersion(app.id, app.latestVersion);
}
