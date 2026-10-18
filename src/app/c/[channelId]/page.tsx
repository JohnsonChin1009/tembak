import { redirect } from "next/navigation";
import { DEMO_WORKSPACE_ID } from "@/lib/workspaces";

/** Links from before workspaces existed point into the demo. */
export default async function LegacyChannelPage({ params, searchParams }: PageProps<"/c/[channelId]">) {
  const [{ channelId }, query] = await Promise.all([params, searchParams]);
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (typeof v === "string") qs.set(k, v);
  const suffix = qs.size ? `?${qs}` : "";
  redirect(`/w/${DEMO_WORKSPACE_ID}/c/${encodeURIComponent(channelId)}${suffix}`);
}
