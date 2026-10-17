import "server-only";
import { SAMPLE_DATASETS } from "@/lib/data/samples";
import type { App, Source } from "@/lib/types";
import type { AgentContext } from "./context";
import type { Triage } from "./prompts";
import { dashboardTemplate } from "./template";

const ACCENTS = ["#4f46e5", "#0d9488", "#e11d48", "#ea580c", "#7c3aed", "#0284c7"];
const REVISE_RE = /\b(change|make it|add|remove|update|revise|tweak|instead|also|switch|rename|color|colour)\b/i;
const BUILD_RE = /\b(build|make|create|dashboard|tracker|app|tool|go|yes)\b/i;

export function pickSource(text: string, sources: Source[]): Source | null {
  const t = text.toLowerCase();
  const scored = sources
    .map((s) => {
      const words = `${s.key} ${s.name} ${s.columns.join(" ")}`.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
      return { s, score: words.filter((w) => t.includes(w)).length };
    })
    .sort((a, b) => b.score - a.score);
  if (scored[0]?.score) return scored[0].s;
  return sources.find((s) => s.key === "campaign") ?? sources[0] ?? null;
}

function titleFor(source: Source | null, request: string): string {
  if (/tracker/i.test(request)) return source ? `${source.key[0].toUpperCase()}${source.key.slice(1)} Tracker` : "Team Tracker";
  if (!source) return "Team Dashboard";
  const map: Record<string, string> = {
    campaign: "Q4 Campaign Dashboard",
    sales: "Sales Pipeline Dashboard",
    support: "Support Queue Dashboard",
  };
  return map[source.key] ?? `${source.name} Dashboard`;
}

export function mockTriage(ctx: AgentContext): Triage {
  const req = ctx.request;
  const latest = ctx.targetApp ?? ctx.channelApps[0];
  if (latest && (ctx.targetApp || REVISE_RE.test(req))) {
    return {
      action: "revise",
      appId: latest.id,
      message: `Updated **${latest.title}**.`,
      brief: req,
    };
  }
  if (req.includes("?") && !BUILD_RE.test(req)) {
    return {
      action: "reply",
      message:
        "Happy to help! A couple of quick questions so I build the right thing:\n\n- **Who's it for?** (I'll assume the people in this channel)\n- **Which numbers matter most?** (I'll start with the totals and trends from the conversation)\n\nOr just say **go** and I'll build with those defaults.",
    };
  }
  const source = pickSource(`${ctx.transcript}\n${req}`, ctx.sources);
  const title = titleFor(source, req);
  return {
    action: "build",
    title,
    message: `Here's **${title}**, built from what you've discussed.\n\n- Using the **${source?.name ?? "sample"}** data\n- Totals up top, trend over time, breakdown by category, then a searchable table`,
    brief: req,
    sourceKeys: source ? [source.key] : [],
  };
}

export function mockBuild(input: {
  title: string;
  request: string;
  source: Source | null;
  revisionOf?: { app: App; n: number };
}): { html: string; summary: string } {
  const n = input.revisionOf ? input.revisionOf.n + 1 : 1;
  const accent = ACCENTS[(n - 1) % ACCENTS.length];
  const summary = input.revisionOf
    ? `Revision ${n}: applied "${input.request.slice(0, 120)}" (mock agent: new accent color).`
    : `A live dashboard with KPIs, a trend chart, a category breakdown, and a searchable table for ${input.source?.name ?? "sample data"}.`;
  const sample = input.source ? [] : SAMPLE_DATASETS.campaign.rows();
  return {
    summary,
    html: dashboardTemplate({
      title: input.title,
      description: input.source ? `Live from “${input.source.name}”` : "Sample data",
      summary,
      accent,
      sourceKey: input.source?.key ?? null,
      sampleRows: sample,
      note: input.revisionOf ? `Revision note: ${input.request}` : undefined,
    }),
  };
}
