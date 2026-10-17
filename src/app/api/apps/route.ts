import { handle, json, requireUser } from "@/lib/api";
import { getStore } from "@/lib/store";

export const GET = handle(async () => {
  await requireUser();
  return json(await (await getStore()).listApps());
});
