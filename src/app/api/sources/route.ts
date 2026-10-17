import { z } from "zod";
import { handle, HttpError, json, parseBody, requireUser } from "@/lib/api";
import { SourceFetchError } from "@/lib/data/fetch";
import { createSource, redact } from "@/lib/data/sources";
import { getStore } from "@/lib/store";

export const GET = handle(async () => {
  await requireUser();
  return json((await (await getStore()).listSources()).map(redact));
});

const body = z.object({
  name: z.string().trim().min(1).max(80),
  config: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("sheet"), url: z.string().url(), range: z.string().max(100).optional() }),
    z.object({ kind: z.literal("csv"), text: z.string().min(1).max(1_000_000) }),
    z.object({
      kind: z.literal("json"),
      url: z.string().url(),
      headerName: z.string().max(100).optional(),
      headerValue: z.string().max(2000).optional(),
    }),
  ]),
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const input = await parseBody(req, body);
  try {
    const source = await createSource({ ...input, createdBy: user.uid });
    return json(redact(source), { status: 201 });
  } catch (err) {
    if (err instanceof SourceFetchError) throw new HttpError(422, err.message);
    throw err;
  }
});
