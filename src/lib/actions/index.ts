import "server-only";
import { HttpError } from "@/lib/api";
import { SourceFetchError } from "@/lib/data/errors";
import { randomId } from "@/lib/ids";
import type { RuntimeCaller } from "@/lib/runtime-auth";
import { getStore } from "@/lib/store";
import type { ActionRecord, Source } from "@/lib/types";
import { LINEAR_ACTIONS } from "./linear";
import { NOTION_ACTIONS } from "./notion";
import { SHEETS_ACTIONS } from "./sheets";
import type { ActionDef, ActionProvider } from "./shared";

// tembak.action: the fixed allowlist of writes generated apps may make to the
// workspace's connected tools. See docs/prd/14-app-write-back.md.

export type { ActionProvider } from "./shared";

const ACTIONS: Record<string, ActionDef> = { ...LINEAR_ACTIONS, ...NOTION_ACTIONS, ...SHEETS_ACTIONS };

const MAX_AUDIT_INPUT = 2048;

function auditInput(input: unknown): string {
  try {
    return (JSON.stringify(input) ?? "null").slice(0, MAX_AUDIT_INPUT);
  } catch {
    return "(unserializable)";
  }
}

/** Errors as the status and message the app sees. Provider messages are already user-safe. */
function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  if (err instanceof SourceFetchError) return new HttpError(502, err.message);
  console.error("[action] unhandled error", err);
  return new HttpError(500, "Something went wrong making that change.");
}

/**
 * Validates and runs one action for a runtime caller, writing an audit record
 * either way. Throws HttpError with a friendly message on failure.
 */
export async function performAction(caller: RuntimeCaller, name: string, input: unknown): Promise<unknown> {
  const store = await getStore();
  const record: ActionRecord = {
    id: randomId(),
    workspaceId: caller.workspaceId,
    appId: caller.app.id,
    uid: caller.uid,
    name: name.slice(0, 64),
    input: auditInput(input),
    ok: false,
    at: Date.now(),
  };
  try {
    const def = Object.hasOwn(ACTIONS, name) ? ACTIONS[name] : undefined;
    if (!def) throw new HttpError(400, `Unknown action "${name}". Available: ${Object.keys(ACTIONS).join(", ")}.`);
    const parsed = def.input.safeParse(input);
    if (!parsed.success) {
      throw new HttpError(400, `${name}: ${parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ")}`);
    }
    // Only the app's own sources are in reach (see ownSource).
    const all = await store.listSources(caller.workspaceId);
    const sources = all.filter((s) => caller.app.sourceKeys.includes(s.key));
    const result = await def.run(parsed.data, { workspaceId: caller.workspaceId, app: caller.app, sources });
    record.ok = true;
    return result;
  } catch (err) {
    const http = toHttpError(err);
    record.error = http.message.slice(0, 500);
    throw http;
  } finally {
    await store.addActionRecord(record).catch((err) => console.error("[action] audit write failed", err));
  }
}

/** Providers whose actions an app built in this workspace could use, for the builder prompt. */
export async function availableActionProviders(workspaceId: string, sources: Source[]): Promise<ActionProvider[]> {
  const connections = await (await getStore()).listConnections(workspaceId);
  const out: ActionProvider[] = [];
  if (connections.some((c) => c.provider === "linear")) out.push("linear");
  if (connections.some((c) => c.provider === "notion") && sources.some((s) => s.kind === "notion")) out.push("notion");
  if (sources.some((s) => s.kind === "sheet")) out.push("sheets");
  return out;
}
