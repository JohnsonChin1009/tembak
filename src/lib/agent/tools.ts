import "server-only";
import type { FunctionDeclaration } from "@google/genai";
import { availableActionProviders } from "@/lib/actions";
import { addAppVersion, createApp } from "@/lib/apps";
import { config } from "@/lib/config";
import { sourceRows } from "@/lib/data/fetch";
import { SAMPLE_DATASETS } from "@/lib/data/samples";
import { getStore } from "@/lib/store";
import type { App, AppRef, Message, Row, Source } from "@/lib/types";
import { currentVersion, describeSources, type AgentContext } from "./context";
import { generateText } from "./gemini";
import { extractHtml, InvalidHtmlError } from "./html";
import { mockBuild, pickSource } from "./mock";
import { actionsDoc, BUILD_SYSTEM, buildPrompt, repairPrompt, revisePrompt } from "./prompts";
import { dashboardTemplate } from "./template";

const BUILD_TIMEOUT_MS = 150_000;
/** Tool results go back to the model; keep them to roughly 4k tokens. */
const MAX_RESULT_CHARS = 14_000;

export type Update = Partial<Pick<Message, "text" | "status" | "statusLine" | "appRef" | "error">>;

/** Everything one agent run shares across tool calls. */
export type RunState = {
  ctx: AgentContext;
  mode: "mock" | "gemini";
  createdBy: string;
  update: (patch: Update) => Promise<void>;
  /** The latest app built or revised in this run; shown as the app card. */
  appRef?: AppRef;
  summaries: string[];
};

type Args = Record<string, unknown>;
type Result = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "list_sources",
    description: "List the data sources connected to this workspace: key, name, kind, columns, row count.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "query_source",
    description:
      "Read rows from a connected data source, optionally filtered, grouped, and aggregated. Use it to answer data questions with real numbers and to check data before building.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Source key from the list" },
        columns: { type: "array", items: { type: "string" }, description: "Columns to return (ungrouped rows only)" },
        filters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              column: { type: "string" },
              op: { type: "string", enum: ["eq", "neq", "contains", "gt", "gte", "lt", "lte"] },
              value: { type: ["string", "number", "boolean"] },
            },
            required: ["column", "op", "value"],
          },
        },
        group_by: { type: "string", description: "Column to group by" },
        metrics: { type: "array", items: { type: "string" }, description: "Numeric columns to aggregate per group" },
        agg: { type: "string", enum: ["sum", "avg", "min", "max"], description: "Aggregation for metrics (default sum)" },
        sort_by: { type: "string" },
        desc: { type: "boolean" },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
      required: ["key"],
    },
  },
  {
    name: "list_apps",
    description: "List the apps already built in this channel with their versions and published state.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "load_skill",
    description: "Read the full recipe of a skill from the skills list.",
    parametersJsonSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  },
  {
    name: "build_app",
    description: "Build a NEW app. Takes 30-90 seconds. Returns the app id and a summary.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "2 to 5 words, Title Case" },
        brief: {
          type: "string",
          description:
            "Precise spec for the builder: purpose, audience, layout, components, metrics with formulas, interactions, which columns to use, and what someone should see in 5 seconds.",
        },
        source_keys: { type: "array", items: { type: "string" }, description: "Data source keys the app reads" },
        skill: { type: "string", description: "Optional skill name to follow" },
      },
      required: ["title", "brief"],
    },
  },
  {
    name: "revise_app",
    description: "Make a new version of an existing app in this channel.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        app_id: { type: "string" },
        instructions: { type: "string", description: "Exactly what to change" },
        source_keys: { type: "array", items: { type: "string" }, description: "Extra data sources it should read" },
      },
      required: ["app_id", "instructions"],
    },
  },
  {
    name: "publish_app",
    description: "Publish an app's latest version to its live link (members of this workspace only). Only when someone explicitly asks.",
    parametersJsonSchema: { type: "object", properties: { app_id: { type: "string" } }, required: ["app_id"] },
  },
];

/** Runs one tool call. Errors come back as { error } so the model can recover. */
export async function runTool(name: string, args: Args, state: RunState): Promise<Result> {
  try {
    switch (name) {
      case "list_sources":
        return { sources: state.ctx.sources.map(sourceSummary) };
      case "query_source":
        return await querySource(args, state);
      case "list_apps":
        return { apps: state.ctx.channelApps.map(appSummary) };
      case "load_skill": {
        const skill = state.ctx.skills.find((s) => s.name === str(args.name));
        if (!skill) return { error: `No skill named "${str(args.name)}"` };
        await state.update({ statusLine: `Reading the ${skill.name} recipe...` });
        return { name: skill.name, recipe: skill.body };
      }
      case "build_app":
        return await buildApp(args, state);
      case "revise_app":
        return await reviseApp(args, state);
      case "publish_app":
        return await publishApp(args, state);
      default:
        return { error: `Unknown tool ${name}` };
    }
  } catch (err) {
    console.error(`[agent] tool ${name} failed:`, err instanceof Error ? err.message : err);
    return { error: err instanceof Error ? err.message : "Tool failed" };
  }
}

function sourceSummary(s: Source) {
  return { key: s.key, name: s.name, kind: s.kind, columns: s.columns, row_count: s.rowCount ?? null };
}

function appSummary(a: App) {
  return { id: a.id, title: a.title, latest_version: a.latestVersion, published_version: a.publishedVersion || null };
}

function findSource(state: RunState, key: string): Source {
  const source = state.ctx.sources.find((s) => s.key === key);
  if (!source) throw new Error(`No data source with key "${key}". Call list_sources.`);
  return source;
}

// --- query_source ----------------------------------------------------------------

type Filter = { column: string; op: string; value: unknown };

function matches(row: Row, f: Filter): boolean {
  const v = row[f.column];
  const target = f.value;
  switch (f.op) {
    case "eq":
      return String(v ?? "").toLowerCase() === String(target ?? "").toLowerCase();
    case "neq":
      return String(v ?? "").toLowerCase() !== String(target ?? "").toLowerCase();
    case "contains":
      return String(v ?? "").toLowerCase().includes(String(target ?? "").toLowerCase());
    default: {
      // Numbers compare numerically; ISO dates compare as strings.
      const [a, b] = typeof v === "number" ? [v, Number(target)] : [String(v ?? ""), String(target ?? "")];
      if (f.op === "gt") return a > b;
      if (f.op === "gte") return a >= b;
      if (f.op === "lt") return a < b;
      if (f.op === "lte") return a <= b;
      return true;
    }
  }
}

function aggregate(rows: Row[], col: string, op: string): number {
  const nums = rows.map((r) => r[col]).filter((v): v is number => typeof v === "number");
  if (!nums.length) return 0;
  if (op === "avg") return round(nums.reduce((a, b) => a + b, 0) / nums.length);
  if (op === "min") return Math.min(...nums);
  if (op === "max") return Math.max(...nums);
  return round(nums.reduce((a, b) => a + b, 0));
}

const round = (n: number) => Math.round(n * 100) / 100;

export async function querySource(args: Args, state: RunState): Promise<Result> {
  const source = findSource(state, str(args.key));
  await state.update({ statusLine: `Looking at ${source.name}...` });
  const all = await sourceRows(source);
  const filters = (Array.isArray(args.filters) ? args.filters : []) as Filter[];
  const unknown = filters.map((f) => f.column).filter((c) => !source.columns.includes(c));
  if (unknown.length) return { error: `Unknown columns: ${unknown.join(", ")}. Columns are: ${source.columns.join(", ")}` };
  let rows = all.filter((r) => filters.every((f) => matches(r, f)));
  const matched = rows.length;

  const groupBy = str(args.group_by);
  if (groupBy) {
    const metrics = strs(args.metrics).filter((m) => source.columns.includes(m));
    const op = str(args.agg) || "sum";
    const groups = new Map<string, Row[]>();
    for (const r of rows) {
      const k = String(r[groupBy] ?? "(none)");
      groups.set(k, [...(groups.get(k) ?? []), r]);
    }
    rows = [...groups].map(([k, list]) => {
      const out: Row = { [groupBy]: k, count: list.length };
      for (const m of metrics) out[`${op}_${m}`] = aggregate(list, m, op);
      return out;
    });
  } else {
    const cols = strs(args.columns).filter((c) => source.columns.includes(c));
    if (cols.length) rows = rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c] ?? null])));
  }

  const sortBy = str(args.sort_by);
  if (sortBy) {
    const dir = args.desc === false ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const x = a[sortBy] ?? "";
      const y = b[sortBy] ?? "";
      return (x > y ? 1 : x < y ? -1 : 0) * dir;
    });
  }

  const limit = Math.min(50, Math.max(1, Number(args.limit) || 20));
  let out = rows.slice(0, limit);
  while (out.length > 1 && JSON.stringify(out).length > MAX_RESULT_CHARS) out = out.slice(0, Math.ceil(out.length / 2));
  return {
    source: source.key,
    total_rows: all.length,
    matched_rows: matched,
    returned: out.length,
    truncated: out.length < rows.length,
    rows: out,
  };
}

// --- build, revise, publish ----------------------------------------------------------

function resolveKeys(state: RunState, keys: string[]): Source[] {
  const wanted = new Set(keys);
  return state.ctx.sources.filter((s) => wanted.has(s.key));
}

async function buildApp(args: Args, state: RunState): Promise<Result> {
  const { ctx } = state;
  const title = (str(args.title) || "Untitled App").slice(0, 60);
  const brief = str(args.brief) || ctx.request;
  const sources = resolveKeys(state, strs(args.source_keys));
  const skill = ctx.skills.find((s) => s.name === str(args.skill));
  await state.update({ status: "building", statusLine: `Building ${title}...` });

  const { html, summary, model } = await produce({ state, sources, build: { title, brief, skill } });
  const { app } = await createApp({
    title,
    workspaceId: ctx.trigger.workspaceId,
    channelId: ctx.trigger.channelId,
    html,
    summary,
    prompt: brief,
    model,
    createdBy: state.createdBy,
    sourceKeys: sources.map((s) => s.key),
  });
  ctx.channelApps.unshift(app);
  state.appRef = { appId: app.id, version: 1 };
  state.summaries.push(summary);
  await state.update({ statusLine: "Wrapping up..." });
  return {
    app_id: app.id,
    title,
    version: 1,
    summary,
    note:
      model === "template-fallback"
        ? "IMPORTANT: the custom build failed, so this is a generic starter dashboard. Tell the user that plainly and offer to try again."
        : undefined,
  };
}

async function reviseApp(args: Args, state: RunState): Promise<Result> {
  const { ctx } = state;
  const app = ctx.channelApps.find((a) => a.id === str(args.app_id));
  if (!app) return { error: "That app isn't in this channel. Call list_apps." };
  const instructions = str(args.instructions) || ctx.request;
  const sources = resolveKeys(state, strs(args.source_keys));
  await state.update({ status: "building", statusLine: `Revising ${app.title} (v${app.latestVersion + 1})...` });

  const { html, summary, model } = await produce({ state, sources, revise: { app, instructions } });
  const result = await addAppVersion(app, {
    html,
    summary,
    prompt: instructions,
    model,
    createdBy: state.createdBy,
    sourceKeys: sources.map((s) => s.key),
  });
  Object.assign(app, result.app);
  state.appRef = { appId: app.id, version: result.version.n };
  state.summaries.push(summary);
  await state.update({ statusLine: "Wrapping up..." });
  return { app_id: app.id, version: result.version.n, summary };
}

async function publishApp(args: Args, state: RunState): Promise<Result> {
  const app = state.ctx.channelApps.find((a) => a.id === str(args.app_id));
  if (!app) return { error: "That app isn't in this channel. Call list_apps." };
  await state.update({ statusLine: `Publishing ${app.title}...` });
  await (await getStore()).updateApp(app.id, { publishedVersion: app.latestVersion, updatedAt: Date.now() });
  app.publishedVersion = app.latestVersion;
  state.appRef = { appId: app.id, version: app.latestVersion };
  return { url: `${config().appsUrl}/a/${app.slug}`, version: app.latestVersion };
}

type ProduceInput = {
  state: RunState;
  sources: Source[];
  build?: { title: string; brief: string; skill?: { name: string; body: string } };
  revise?: { app: App; instructions: string };
};

async function produce(input: ProduceInput): Promise<{ html: string; summary: string; model: string }> {
  const { state, sources } = input;
  const { ctx } = state;
  if (state.mode === "mock") {
    // Revisions keep the app's own data unless new sources were picked.
    const own = input.revise ? ctx.sources.find((s) => input.revise!.app.sourceKeys.includes(s.key)) : undefined;
    const source = sources[0] ?? own ?? pickSource(ctx.request, ctx.sources);
    const out = mockBuild({
      title: input.revise?.app.title ?? input.build!.title,
      request: input.revise?.instructions ?? ctx.request,
      source,
      revisionOf: input.revise ? { app: input.revise.app, n: input.revise.app.latestVersion } : undefined,
    });
    await new Promise((r) => setTimeout(r, 1200));
    return { ...out, model: "mock" };
  }

  const model = config().gemini.model;
  const actions = actionsDoc(await availableActionProviders(ctx.trigger.workspaceId, ctx.sources));
  let prompt: string;
  if (input.revise) {
    const current = await currentVersion(input.revise.app);
    prompt = revisePrompt({
      title: input.revise.app.title,
      instructions: input.revise.instructions,
      currentHtml: current?.html ?? "",
      sources: describeSources(ctx.sources),
      sourceKeys: [...new Set([...input.revise.app.sourceKeys, ...sources.map((s) => s.key)])],
      transcript: ctx.transcript,
      rules: ctx.rules,
      actions,
    });
  } else {
    prompt = buildPrompt({
      title: input.build!.title,
      brief: input.build!.brief,
      transcript: ctx.transcript,
      sources: describeSources(ctx.sources),
      sourceKeys: sources.map((s) => s.key),
      rules: ctx.rules,
      skill: input.build!.skill,
      actions,
    });
  }

  try {
    return { ...(await generateHtml(model, prompt)), model };
  } catch (err) {
    // Demo safety net: a new build still produces a working dashboard.
    if (input.revise) throw err;
    console.error("[agent] build failed, using template fallback:", err instanceof Error ? err.message : err);
    const source = sources[0] ?? null;
    const summary = "The full build hit a snag, so here's a starter dashboard. Ask me to tweak it.";
    return {
      model: "template-fallback",
      summary,
      html: dashboardTemplate({
        title: input.build!.title,
        description: source ? `Live from “${source.name}”` : "Sample data",
        summary,
        accent: "#4f46e5",
        sourceKey: source?.key ?? null,
        sampleRows: source ? [] : SAMPLE_DATASETS.campaign.rows(),
      }),
    };
  }
}

async function generateHtml(model: string, prompt: string): Promise<{ html: string; summary: string }> {
  let attempt = prompt;
  for (let i = 0; ; i++) {
    const raw = await generateText({ model, system: BUILD_SYSTEM, prompt: attempt, timeoutMs: BUILD_TIMEOUT_MS, temperature: 0.6 });
    try {
      const { html, summary } = extractHtml(raw);
      return { html, summary: summary ?? "Done." };
    } catch (err) {
      if (!(err instanceof InvalidHtmlError) || i >= 1) throw err;
      attempt = repairPrompt(prompt, err.message);
    }
  }
}
