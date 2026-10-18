import { z } from "zod";
import { HttpError, parseBody } from "@/lib/api";
import { generateText } from "@/lib/agent/gemini";
import { config } from "@/lib/config";
import { preflight, publicJson } from "@/lib/public-api";
import { limit } from "@/lib/rate-limit";
import { handleRuntime, requireRuntimeCaller } from "@/lib/runtime-auth";
import { getStore } from "@/lib/store";

export const OPTIONS = preflight;

const MAX_DATA_BYTES = 60_000;

const SYSTEM = `You help a small team inside one of their workspace apps. Answer only from the data and request you're given; if the data doesn't say, say so. Be brief and use plain language. Never output HTML or markdown code fences.`;

const Body = z.object({
  prompt: z.string().trim().min(1, "Ask something").max(4000, "Keep the prompt under 4,000 characters"),
  data: z.unknown().optional(),
  json: z.boolean().optional(),
  schema: z.record(z.string(), z.unknown()).optional(),
});

/** tembak.ask(): one small, cheap model call over data the app passes in. */
export const POST = handleRuntime(async (req: Request, ctx: RouteContext<"/api/runtime/[appId]/ask">) => {
  const { app, workspaceId, uid } = await requireRuntimeCaller(req, (await ctx.params).appId);
  const { prompt, data, json, schema } = await parseBody(req, Body);

  const dataText = data === undefined ? "" : JSON.stringify(data);
  const dataBytes = Buffer.byteLength(dataText);
  if (dataBytes > MAX_DATA_BYTES) {
    throw new HttpError(413, "That's too much data for one AI call (60 KB max). Send fewer rows at a time.");
  }

  if (!limit(`ask:${workspaceId}:${uid}`, 20, 10 * 60_000)) {
    throw new HttpError(429, "You've used the AI a lot in the last few minutes. Try again in a bit.");
  }
  if (!limit(`ask-ws:${workspaceId}`, 200, 24 * 60 * 60_000)) {
    throw new HttpError(429, "This workspace has used its AI calls for today. Try again tomorrow.");
  }

  const started = Date.now();
  let answer: unknown;
  if (config().agentMode !== "gemini") {
    // Canned and deterministic so local dev never spends anything.
    answer = json ? ((schema as { type?: unknown } | undefined)?.type === "object" ? {} : []) : `(mock) ${prompt.slice(0, 80)}`;
  } else {
    const workspace = await (await getStore()).getWorkspace(workspaceId);
    const rules = workspace?.agentRules?.trim();
    let text: string;
    try {
      text = await generateText({
        model: config().gemini.fastModel,
        system: rules ? `${SYSTEM}\n\nTeam rules (always follow):\n${rules}` : SYSTEM,
        prompt: dataText ? `DATA (JSON):\n${dataText}\n\nREQUEST:\n${prompt}` : prompt,
        timeoutMs: 30_000,
        temperature: 0.2,
        maxOutputTokens: 2000,
        json,
        schema,
      });
    } catch (err) {
      throw new HttpError(502, err instanceof Error ? err.message : "The AI call failed");
    }
    if (json) {
      try {
        answer = JSON.parse(text);
      } catch {
        throw new HttpError(502, "The AI reply wasn't valid JSON");
      }
    } else {
      answer = text.trim();
    }
  }

  // Never log the prompt or data, only their size.
  console.log(
    `[ask] app=${app.id} uid=${uid} prompt=${prompt.length} data=${dataBytes}B ms=${Date.now() - started}`,
  );
  return publicJson({ answer }, { headers: { "cache-control": "no-store" } });
});
