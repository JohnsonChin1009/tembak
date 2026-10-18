import "server-only";
import { GoogleGenAI } from "@google/genai";
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

async function generate(call: Call, extra: Record<string, unknown> = {}): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), call.timeoutMs);
  try {
    const res = await genai().models.generateContent({
      model: call.model,
      contents: [{ role: "user", parts: [{ text: call.prompt }] }],
      config: {
        systemInstruction: call.system,
        temperature: call.temperature,
        abortSignal: controller.signal,
        ...extra,
      },
    });
    const text = res.text;
    if (!text) throw new Error("Gemini returned an empty response");
    return text;
  } catch (err) {
    if (controller.signal.aborted) throw new Error(`Gemini timed out after ${call.timeoutMs / 1000}s`);
    throw friendlyError(err);
  } finally {
    clearTimeout(timer);
  }
}

export async function generateJson<T>(call: Call & { schema: object }): Promise<T> {
  const text = await generate(call, {
    responseMimeType: "application/json",
    responseJsonSchema: call.schema,
  });
  return JSON.parse(text) as T;
}

export function generateText(call: Call): Promise<string> {
  return generate(call);
}

/** Turns raw API errors (often a JSON blob) into one readable line. */
function friendlyError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number }).status;
  if (status === 402 || /prepayment|billing/i.test(raw)) {
    return new Error("Gemini is out of credits for this API key. Top up in AI Studio or switch to a free-tier key.");
  }
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(raw)) {
    return new Error("Gemini rate limit hit. Wait a minute and try again.");
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
