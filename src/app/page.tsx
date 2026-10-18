import { redirect } from "next/navigation";
import { Landing } from "@/components/landing/landing";
import { getSessionUser } from "@/lib/auth/session";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await getSessionUser())) return <Landing />;
  const channels = await (await getStore()).listChannels();
  redirect(`/c/${channels[0]?.id ?? "general"}`);
}
