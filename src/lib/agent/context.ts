import "server-only";
import { stripMention } from "@/lib/mentions";
import { getStore } from "@/lib/store";
import type { App, AppVersion, Message, Source } from "@/lib/types";

const HISTORY = 40;

export type AgentContext = {
  trigger: Message;
  request: string;
  transcript: string;
  channelApps: App[];
  /** App the user is explicitly asking to change (from the builder panel). */
  targetApp: App | null;
  sources: Source[];
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
  const [history, allApps, sources] = await Promise.all([
    store.listMessages(trigger.channelId, HISTORY + 5),
    store.listApps(),
    store.listSources(),
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

export function describeApps(apps: App[]): string {
  if (apps.length === 0) return "(none yet)";
  return apps
    .map((a) => `- id ${a.id}: "${a.title}" (latest v${a.latestVersion}${a.publishedVersion ? `, live v${a.publishedVersion}` : ", draft"})`)
    .join("\n");
}

export async function currentVersion(app: App): Promise<AppVersion | null> {
  return (await getStore()).getVersion(app.id, app.latestVersion);
}
