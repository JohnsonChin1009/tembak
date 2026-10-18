import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { homeWorkspace } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const ws = await homeWorkspace(user);
  redirect(ws ? `/w/${ws.slug}` : "/new");
}
