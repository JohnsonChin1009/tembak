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
    throw err;
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
