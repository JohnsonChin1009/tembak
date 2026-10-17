import { redirect } from "next/navigation";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const channels = await (await getStore()).listChannels();
  redirect(`/c/${channels[0]?.id ?? "general"}`);
}
