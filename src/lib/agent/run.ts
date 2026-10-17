import "server-only";
import { addAppVersion, createApp } from "@/lib/apps";
import { config } from "@/lib/config";
import { sourcesFromMessage } from "@/lib/data/sources";
import { SAMPLE_DATASETS } from "@/lib/data/samples";
import { randomId } from "@/lib/ids";
import { getStore } from "@/lib/store";
import type { App, Message, Source } from "@/lib/types";
import { buildContext, currentVersion, describeApps, describeSources, type AgentContext } from "./context";
import { generateJson, generateText } from "./gemini";
import { extractHtml, InvalidHtmlError } from "./html";
import { mockBuild, mockTriage, pickSource } from "./mock";
import {
  BUILD_SYSTEM,
  buildPrompt,
  repairPrompt,
  revisePrompt,
  TRIAGE_SCHEMA,
  TRIAGE_SYSTEM,
  triagePrompt,
  type Triage,
} from "./prompts";
import { dashboardTemplate } from "./template";

const RUN_TIMEOUT_MS = 180_000;
const BUILD_TIMEOUT_MS = 150_000;
const TRIAGE_TIMEOUT_MS = 30_000;

type Update = Partial<Pick<Message, "text" | "status" | "statusLine" | "appRef" | "error">>;

/** Handles one @tembak mention end to end. Never throws. */
export async function startAgentRun(trigger: Message): Promise<void> {
  const store = await getStore();
  const reply: Message = {
    id: randomId(),
    channelId: trigger.channelId,
    createdAt: Date.now(),
    author: { kind: "agent" },
    text: "",
    mentionsAgent: false,
    status: "thinking",
    statusLine: "Reading the conversation...",
    replyTo: trigger.id,
  };
  await store.addMessage(reply);
  const update = (patch: Update) => store.updateMessage(reply.channelId, reply.id, patch);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("This took too long, so I stopped. Try again?")), RUN_TIMEOUT_MS);
  });
  try {
    await Promise.race([run(trigger, update), timeout]);
  } catch (err) {
    console.error("[agent] run failed", err);
    await update({
      status: "error",
      statusLine: "",
      error: err instanceof Error ? err.message : "Something went wrong.",
    });
  } finally {
    clearTimeout(timer);
  }
}

async function run(trigger: Message, update: (patch: Update) => Promise<void>) {
  const createdBy = trigger.author.kind === "user" ? trigger.author.uid : "agent";
  const linked = await sourcesFromMessage(trigger.text, createdBy);
  if (linked.created.length || linked.failed.length) {
    await update({ statusLine: linked.created.length ? "Connected your sheet. Reading the conversation..." : "Reading the conversation..." });
  }
  const ctx = await buildContext(trigger);
  if (linked.failed.length) {
    ctx.request += `\n\n(Note for Tembak: the linked sheet couldn't be read. Tell the user to share it with the Tembak service account or make it viewable by link, and use sample data meanwhile.)`;
  }
  const mode = config().agentMode;
  const triage = mode === "gemini" ? await geminiTriage(ctx) : await delayed(mockTriage(ctx), 700);

  if (triage.action === "reply") {
    await update({ status: "done", statusLine: "", text: triage.message });
    return;
  }

  const sources = resolveSources(triage.sourceKeys, ctx.sources);

  if (triage.action === "revise") {
    const app = ctx.channelApps.find((a) => a.id === triage.appId) ?? ctx.targetApp;
    if (!app) {
      await update({ status: "done", statusLine: "", text: triage.message || "Which app should I change?" });
      return;
    }
    await update({
      status: "building",
      statusLine: `Revising ${app.title} (v${app.latestVersion + 1})...`,
      text: triage.message,
    });
    const instructions = triage.brief || ctx.request;
    const { html, summary, model } = await produce({ mode, ctx, sources, revise: { app, instructions } });
    const result = await addAppVersion(app, {
      html,
      summary,
      prompt: instructions,
      model,
      createdBy,
      sourceKeys: sources.map((s) => s.key),
    });
    await update({
      status: "done",
      statusLine: "",
      text: `${triage.message}\n\n${summary}`.trim(),
      appRef: { appId: app.id, version: result.version.n },
    });
    return;
  }

  const title = (triage.title || "Untitled App").slice(0, 60);
  await update({ status: "building", statusLine: `Building ${title}...`, text: triage.message });
  const brief = triage.brief || ctx.request;
  const { html, summary, model } = await produce({ mode, ctx, sources, build: { title, brief } });
  const { app } = await createApp({
    title,
    channelId: trigger.channelId,
    html,
    summary,
    prompt: brief,
    model,
    createdBy,
    sourceKeys: sources.map((s) => s.key),
  });
  await update({
    status: "done",
    statusLine: "",
    text: `${triage.message}\n\n${summary}`.trim(),
    appRef: { appId: app.id, version: 1 },
  });
}

function resolveSources(keys: string[] | undefined, all: Source[]): Source[] {
  const wanted = new Set(keys ?? []);
  return all.filter((s) => wanted.has(s.key));
}

async function geminiTriage(ctx: AgentContext): Promise<Triage> {
  const channel = await (await getStore()).getChannel(ctx.trigger.channelId);
  const prompt = triagePrompt({
    channelName: channel?.name ?? ctx.trigger.channelId,
    transcript: ctx.transcript,
    request: ctx.request,
    requesterName: ctx.trigger.author.kind === "user" ? ctx.trigger.author.name : "Someone",
    apps: describeApps(ctx.channelApps),
    sources: describeSources(ctx.sources),
    targetAppId: ctx.targetApp?.id,
  });
  const triage = await generateJson<Triage>({
    model: config().gemini.fastModel,
    system: TRIAGE_SYSTEM,
    prompt,
    schema: TRIAGE_SCHEMA,
    timeoutMs: TRIAGE_TIMEOUT_MS,
    temperature: 0.4,
  });
  if (!["reply", "build", "revise"].includes(triage.action)) triage.action = "reply";
  return triage;
}

type ProduceInput = {
  mode: "mock" | "gemini";
  ctx: AgentContext;
  sources: Source[];
  build?: { title: string; brief: string };
  revise?: { app: App; instructions: string };
};

async function produce(input: ProduceInput): Promise<{ html: string; summary: string; model: string }> {
  const { ctx, sources } = input;
  if (input.mode === "mock") {
    // Revisions keep the app's own data unless the triage picked new sources.
    const own = input.revise ? ctx.sources.find((s) => input.revise!.app.sourceKeys.includes(s.key)) : undefined;
    const source = sources[0] ?? own ?? pickSource(ctx.request, ctx.sources);
    const out = mockBuild({
      title: input.revise?.app.title ?? input.build!.title,
      request: ctx.request,
      source,
      revisionOf: input.revise ? { app: input.revise.app, n: input.revise.app.latestVersion } : undefined,
    });
    await delayed(null, 1200);
    return { ...out, model: "mock" };
  }

  const model = config().gemini.model;
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
    });
  } else {
    prompt = buildPrompt({
      title: input.build!.title,
      brief: input.build!.brief,
      transcript: ctx.transcript,
      sources: describeSources(ctx.sources),
      sourceKeys: sources.map((s) => s.key),
    });
  }

  try {
    return { ...(await generateHtml(model, prompt)), model };
  } catch (err) {
    // Demo safety net: a new build still produces a working dashboard.
    if (input.revise) throw err;
    console.error("[agent] build failed, using template fallback", err);
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

function delayed<T>(value: T, ms: number): Promise<T> {
  return new Promise((r) => setTimeout(() => r(value), ms));
}
