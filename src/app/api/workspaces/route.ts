import { z } from "zod";
import { handle, json, parseBody, requireUser } from "@/lib/api";
import { getStore } from "@/lib/store";
import { createWorkspace } from "@/lib/workspaces";

export const GET = handle(async () => {
  const user = await requireUser();
  return json(await (await getStore()).listWorkspacesForUser(user.uid));
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const { name } = await parseBody(req, z.object({ name: z.string().trim().min(1, "Give it a name").max(40) }));
  const ws = await createWorkspace(name, user);
  return json({ id: ws.id, slug: ws.slug, name: ws.name }, { status: 201 });
});
