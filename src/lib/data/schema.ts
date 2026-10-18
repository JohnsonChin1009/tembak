import { z } from "zod";

/** What a client may send as a source config (sample sources are built in). */
export const sourceConfigSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("sheet"), url: z.string().url(), range: z.string().max(100).optional() }),
  z.object({ kind: z.literal("csv"), text: z.string().min(1).max(1_000_000) }),
  z.object({
    kind: z.literal("json"),
    url: z.string().url(),
    headerName: z.string().max(100).optional(),
    headerValue: z.string().max(2000).optional(),
  }),
  z.object({ kind: z.literal("notion"), dataSourceId: z.string().min(1).max(100), title: z.string().max(200).optional() }),
  z.object({
    kind: z.literal("linear"),
    resource: z.enum(["issues", "projects"]),
    teamKey: z.string().max(20).optional(),
  }),
]);
