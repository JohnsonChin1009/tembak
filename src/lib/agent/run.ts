import "server-only";
import type { Content, Part } from "@google/genai";
import { config } from "@/lib/config";
import { sourcesFromMessage } from "@/lib/data/sources";
import { randomId } from "@/lib/ids";
import { getStore } from "@/lib/store";
import type { Message, Row } from "@/lib/types";
import { scheduleFromText } from "@/lib/workflows";
import { buildContext, describeApps, describeSourcesBrief } from "./context";
import { generateWithTools } from "./gemini";
import { mockTriage, pickSource } from "./mock";
import { AGENT_SYSTEM, agentPrompt } from "./prompts";
import { skillIndex } from "./skills";
import { runTool, toolsFor, type RunState, type Update } from "./tools";

const RUN_TIMEOUT_MS = 240_000;
const STEP_TIMEOUT_MS = 45_000;
const MAX_STEPS = 6;

export type RunOptions = {
  /** A workflow's scheduled run (src/lib/workflows.ts): read-only tools, no questions back. */
  scheduled?: boolean;
};

/**
 * Handles one @tembak mention end to end: posts a "thinking" message, runs the
 * agent loop, and fills the message in. Never throws. This is the agent's only
 * entry point, so it can move to its own service later without a rewrite.
 */
export async function startAgentRun(trigger: Message, options: RunOptions = {}): Promise<{ messageId: string; ok: boolean }> {
  const store = await getStore();
  const reply: Message = {
    id: randomId(),
    workspaceId: trigger.workspaceId,
    channelId: trigger.channelId,
    createdAt: Date.now(),
    author: { kind: "agent" },
    text: "",
    mentionsAgent: false,
    status: "thinking",
    statusLine: "Reading the conversation...",
    replyTo: trigger.id,
    // Mentioned in a thread, it answers in that thread.
    threadId: trigger.threadId,
  };
  await store.addMessage(reply);
  const update = (patch: Update) =>
    store.updateMessage(reply.workspaceId, reply.channelId, reply.id, patch, reply.threadId);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("This took too long, so I stopped. Try again?")), RUN_TIMEOUT_MS);
  });
  try {
    await Promise.race([run(trigger, update, options), timeout]);
    return { messageId: reply.id, ok: true };
  } catch (err) {
    console.error("[agent] run failed:", err instanceof Error ? err.message : err);
    await update({
      status: "error",
      statusLine: "",
      error: err instanceof Error ? err.message : "Something went wrong.",
    });
    return { messageId: reply.id, ok: false };
  } finally {
    clearTimeout(timer);
  }
}

async function run(trigger: Message, update: (patch: Update) => Promise<void>, options: RunOptions) {
  const createdBy = trigger.author.kind === "user" ? trigger.author.uid : "agent";
  const linked = await sourcesFromMessage(trigger.workspaceId, trigger.text, createdBy);
  if (linked.created.length || linked.failed.length) {
    await update({ statusLine: linked.created.length ? "Connected your sheet. Reading the conversation..." : "Reading the conversation..." });
  }
  const ctx = await buildContext(trigger);
  if (linked.failed.length) {
    ctx.request += `\n\n(Note for Tembak: the linked sheet couldn't be read. Tell the user to share it with the Tembak service account or make it viewable by link, and use sample data meanwhile.)`;
  }
  const state: RunState = { ctx, mode: config().agentMode, createdBy, update, summaries: [], scheduled: options.scheduled };
  const text = state.mode === "gemini" ? await geminiLoop(state) : await mockLoop(state);
  await update({
    status: "done",
    statusLine: "",
    text: text || state.summaries.join("\n\n") || "Done.",
    appRef: state.appRef,
  });
}

/** Gemini decides which tools to call, up to MAX_STEPS rounds, then writes the reply. */
async function geminiLoop(state: RunState): Promise<string> {
  const { ctx } = state;
  const channel = await (await getStore()).getChannel(ctx.trigger.workspaceId, ctx.trigger.channelId);
  const prompt = agentPrompt({
    channelName: channel?.name ?? ctx.trigger.channelId,
    transcript: ctx.transcript,
    request: ctx.request,
    requesterName: ctx.trigger.author.kind === "user" ? ctx.trigger.author.name : "Someone",
    apps: describeApps(ctx.channelApps),
    sources: describeSourcesBrief(ctx.sources),
    skills: skillIndex(ctx.skills),
    rules: ctx.rules,
    targetAppId: ctx.targetApp?.id,
    scheduled: state.scheduled,
  });
  const contents: Content[] = [{ role: "user", parts: [{ text: prompt }] }];

  let said = "";
  for (let step = 1; step <= MAX_STEPS; step++) {
    const turn = await generateWithTools({
      model: config().gemini.fastModel,
      system: AGENT_SYSTEM,
      contents,
      tools: toolsFor(state),
      timeoutMs: STEP_TIMEOUT_MS,
      temperature: 0.4,
    });
    contents.push(turn.content);
    if (!turn.calls.length) return turn.text;

    // A short "on it" line alongside tool calls shows while the tools run.
    if (turn.text) {
      said = turn.text;
      await state.update({ text: said });
    }
    const responses: Part[] = [];
    for (const call of turn.calls) {
      const name = call.name ?? "";
      const detail = name === "load_skill" ? call.args?.name : name === "build_app" ? call.args?.skill : undefined;
      console.log(`[agent] step ${step}: ${name}${detail ? ` (${String(detail)})` : ""}`);
      const response = await runTool(name, call.args ?? {}, state);
      responses.push({ functionResponse: { id: call.id, name, response } });
    }
    contents.push({ role: "user", parts: responses });
  }
  return `${said || state.summaries.join("\n\n")}\n\nI ran out of steps before finishing. Ask me to continue.`.trim();
}

/** Scripted stand-in for local dev and tests: the same tools, no Gemini. */
async function mockLoop(state: RunState): Promise<string> {
  await sleep(700);
  if (state.scheduled) {
    const source = pickSource(state.ctx.request, state.ctx.sources);
    return mockAnswer(state, source?.key);
  }
  // Gemini spots recurring requests itself; the mock wants the word.
  const schedule = /\b(workflow|schedule|remind)/i.test(state.ctx.request) ? scheduleFromText(state.ctx.request) : null;
  if (schedule) {
    const res = await runTool("create_workflow", { prompt: state.ctx.request, ...schedule }, state);
    if (res.error) return `I couldn't set that up: ${String(res.error)}`;
    return `Done. **${String(res.schedule)}**, I'll do this and post it here:\n\n> ${String(res.task)}\n\nFirst run: ${String(res.next_run)}. Ask me to stop it anytime.`;
  }
  const plan = mockTriage(state.ctx);
  if (plan.action === "reply") return plan.message;
  if (plan.action === "answer") return mockAnswer(state, plan.sourceKeys?.[0]);
  if (plan.action === "revise") {
    const res = await runTool("revise_app", { app_id: plan.appId, instructions: plan.brief }, state);
    return res.error ? `I couldn't update that app: ${String(res.error)}` : plan.message;
  }
  await runTool("list_sources", {}, state);
  const res = await runTool(
    "build_app",
    { title: plan.title, brief: plan.brief, source_keys: plan.sourceKeys, skill: "kpi-dashboard" },
    state,
  );
  return res.error ? `I couldn't build that: ${String(res.error)}` : plan.message;
}

/** Answers a data question by grouping the best-matching source by its first category column. */
async function mockAnswer(state: RunState, key: string | undefined): Promise<string> {
  const source = state.ctx.sources.find((s) => s.key === key);
  if (!source) return "I couldn't find data for that. Connect a source and ask again.";
  const numeric = source.columns.filter((c) => source.sample.every((r) => r[c] == null || typeof r[c] === "number"));
  const category = source.columns.find((c) => !numeric.includes(c) && !/date|week|day|month|time|_at$/i.test(c));
  const asked = state.ctx.request.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const metric =
    numeric.find((c) => asked.includes(c.replace(/_/g, "").replace(/s$/, ""))) ??
    numeric.find((c) => /signup|revenue|amount|spend|count|tickets|value/i.test(c)) ??
    numeric[0];
  if (!category || !metric) return `**${source.name}** has ${source.rowCount ?? "some"} rows. Connect Gemini to ask questions about it.`;
  const res = await runTool(
    "query_source",
    { key: source.key, group_by: category, metrics: [metric], sort_by: `sum_${metric}`, limit: 5 },
    state,
  );
  if (res.error) return `I couldn't read **${source.name}**: ${String(res.error)}`;
  const rows = res.rows as Row[];
  const head = `| ${category} | ${metric} |\n|---|---:|`;
  const body = rows.map((r) => `| ${r[category]} | ${Number(r[`sum_${metric}`]).toLocaleString("en-US")} |`).join("\n");
  return `Here's **${metric.replace(/_/g, " ")}** by **${category.replace(/_/g, " ")}** from **${source.name}**:\n\n${head}\n${body}`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
