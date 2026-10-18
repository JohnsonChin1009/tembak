import "server-only";
import { z } from "zod";
import { HttpError } from "@/lib/api";
import { PROVIDER_LABEL } from "@/lib/connectors/connections";
import { getStore } from "@/lib/store";
import type { App, ConnectionProvider, Source } from "@/lib/types";

// Shared pieces for the tembak.action providers (linear.ts, notion.ts, sheets.ts).

export type ActionProvider = "linear" | "notion" | "sheets";

/** Who is acting and what the app may touch: `sources` are the app's own sources only. */
export type ActionContext = { workspaceId: string; app: App; sources: Source[] };

export type ActionDef<S extends z.ZodType = z.ZodType> = {
  provider: ActionProvider;
  input: S;
  // Method syntax so specific actions fit the registry type.
  run(input: z.infer<S>, ctx: ActionContext): Promise<unknown>;
};

/** Keeps each action's input type tied to its schema. */
export function action<S extends z.ZodType>(def: ActionDef<S>): ActionDef<S> {
  return def;
}

/** A plain cell value an app can write. */
export const cellValue = z.union([z.string().max(5000), z.number(), z.boolean(), z.null()]);

/** name -> value maps (sheet rows, Notion properties), at most 50 entries. */
export function valueMap<V extends z.ZodType>(value: V) {
  return z
    .record(z.string().min(1).max(200), value)
    .refine((r) => Object.keys(r).length > 0, "Give at least one value")
    .refine((r) => Object.keys(r).length <= 50, "At most 50 values at a time");
}

/** 409 when the workspace hasn't connected the provider, so apps can say so. */
export async function requireConnection(workspaceId: string, provider: ConnectionProvider) {
  const conn = await (await getStore()).getConnection(workspaceId, provider);
  const label = PROVIDER_LABEL[provider];
  if (!conn) throw new HttpError(409, `Connect ${label} first: a teammate can do it from the Data panel in Tembak.`);
  return conn;
}

/** The app's source with this key; anything outside its sourceKeys is a 403. */
export function ownSource(ctx: ActionContext, key: string): Source {
  if (!ctx.app.sourceKeys.includes(key)) {
    throw new HttpError(403, `This app can only change its own data sources, and "${key}" isn't one of them.`);
  }
  const source = ctx.sources.find((s) => s.key === key);
  if (!source) throw new HttpError(404, `Data source "${key}" was removed.`);
  return source;
}
