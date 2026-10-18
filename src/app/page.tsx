import { redirect } from "next/navigation";
import { Landing } from "@/components/landing/landing";
import { getSessionUser } from "@/lib/auth/session";
import { homeWorkspace } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) return <Landing />;
  const ws = await homeWorkspace(user);
  redirect(ws ? `/w/${ws.slug}` : "/new");
}
