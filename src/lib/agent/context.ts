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

function line(m: Message, apps: Map<string, App>): string | null {
  const t = timeFmt.format(m.createdAt);
  if (m.author.kind === "agent") {
    if (m.status === "thinking" || m.status === "building") return null;
    const app = m.appRef ? apps.get(m.appRef.appId) : undefined;
    const built = app ? ` [built app "${app.title}" v${m.appRef!.version}, id ${app.id}]` : "";
    return `[${t}] Tembak (you): ${m.text}${built}`.trim();
  }
  const about = m.appRef ? ` [about app id ${m.appRef.appId}]` : "";
  return `[${t}] ${m.author.name}${about}: ${m.text}`;
}

export async function buildContext(trigger: Message): Promise<AgentContext> {
  const store = await getStore();
  const [history, allApps, sources, workspace, skills] = await Promise.all([
    store.listMessages(trigger.workspaceId, trigger.channelId, HISTORY + 5),
    store.listApps(trigger.workspaceId),
    store.listSources(trigger.workspaceId),
    store.getWorkspace(trigger.workspaceId),
    workspaceSkills(trigger.workspaceId),
  ]);
  const channelApps = allApps.filter((a) => a.channelId === trigger.channelId);
  const appsById = new Map(allApps.map((a) => [a.id, a]));

  const upto = history.filter((m) => m.createdAt <= trigger.createdAt).slice(-HISTORY);
  const transcript = upto
    .map((m) => line(m, appsById))
    .filter(Boolean)
    .join("\n");

  return {
    trigger,
    request: stripMention(trigger.text),
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
