import "server-only";
import { GoogleGenAI, type Content, type FunctionCall, type FunctionDeclaration } from "@google/genai";
import { config } from "@/lib/config";

let client: GoogleGenAI | undefined;

function genai(): GoogleGenAI {
  if (client) return client;
  const { apiKey, useVertex, project, location } = config().gemini;
  client = useVertex
    ? new GoogleGenAI({ vertexai: true, project, location })
    : new GoogleGenAI({ apiKey });
  return client;
}

type Call = {
  model: string;
  system: string;
  prompt: string;
  timeoutMs: number;
  temperature?: number;
};

const RETRY_AFTER_MS = 5_000;

/** Runs a Gemini call with a timeout, one retry on rate limits, and readable errors. */
async function withGemini<T>(timeoutMs: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fn(controller.signal);
    } catch (err) {
      if (controller.signal.aborted) throw new Error(`Gemini timed out after ${timeoutMs / 1000}s`);
      // Free-tier per-minute limits and "high demand" 503s pass quickly; wait once, then give up.
      if (attempt === 0 && isTransient(err)) {
        await new Promise((r) => setTimeout(r, RETRY_AFTER_MS));
        continue;
      }
      throw friendlyError(err);
    } finally {
      clearTimeout(timer);
    }
  }
}

function isTransient(err: unknown): boolean {
  const status = (err as { status?: number }).status;
  return status === 429 || status === 503 || /RESOURCE_EXHAUSTED|UNAVAILABLE/i.test(err instanceof Error ? err.message : String(err));
}

export function generateText(call: Call): Promise<string> {
  return withGemini(call.timeoutMs, async (abortSignal) => {
    const res = await genai().models.generateContent({
      model: call.model,
      contents: [{ role: "user", parts: [{ text: call.prompt }] }],
      config: { systemInstruction: call.system, temperature: call.temperature, abortSignal },
    });
    const text = res.text;
    if (!text) throw new Error("Gemini returned an empty response");
    return text;
  });
}

export type ToolTurn = {
  /** The model's turn, verbatim (keeps thought signatures for the next request). */
  content: Content;
  calls: FunctionCall[];
  text: string;
};

/** One step of a function-calling conversation. */
export function generateWithTools(input: {
  model: string;
  system: string;
  contents: Content[];
  tools: FunctionDeclaration[];
  timeoutMs: number;
  temperature?: number;
}): Promise<ToolTurn> {
  return withGemini(input.timeoutMs, async (abortSignal) => {
    const res = await genai().models.generateContent({
      model: input.model,
      contents: input.contents,
      config: {
        systemInstruction: input.system,
        temperature: input.temperature,
        tools: [{ functionDeclarations: input.tools }],
        abortSignal,
      },
    });
    const content = res.candidates?.[0]?.content;
    if (!content?.parts?.length) throw new Error("Gemini returned an empty response");
    const text = content.parts
      .filter((p) => p.text && !p.thought)
      .map((p) => p.text)
      .join("")
      .trim();
    return { content: { role: "model", parts: content.parts }, calls: res.functionCalls ?? [], text };
  });
}

/** Turns raw API errors (often a JSON blob) into one readable line. */
function friendlyError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number }).status;
  console.error("[gemini] call failed", status ?? "", raw.slice(0, 500));
  if (status === 402 || /prepayment/i.test(raw)) {
    return new Error("Gemini is out of credits for this API key. Top up in AI Studio or switch to a free-tier key.");
  }
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(raw)) {
    return new Error("Gemini rate limit hit. Wait a minute and try again.");
  }
  if (status === 503 || /UNAVAILABLE|high demand|overloaded/i.test(raw)) {
    return new Error("Gemini is overloaded right now. Try again in a minute.");
  }
  if (status === 404 || /not found|not supported/i.test(raw)) {
    return new Error(`Gemini model not available to this key (${modelHint(raw)}).`);
  }
  if (status === 401 || status === 403 || /API key/i.test(raw)) {
    return new Error("Gemini rejected the API key. Check the GEMINI_API_KEY secret.");
  }
  return err instanceof Error ? err : new Error(raw);
}

function modelHint(raw: string): string {
  return raw.match(/models\/[\w.-]+/)?.[0] ?? "check GEMINI_MODEL";
}
