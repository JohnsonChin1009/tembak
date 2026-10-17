import { notFound, redirect } from "next/navigation";
import { Workspace } from "@/components/workspace/workspace";
import { getSessionUser } from "@/lib/auth/session";
import { config } from "@/lib/config";
import { getStore } from "@/lib/store";

export default async function ChannelPage({ params }: PageProps<"/c/[channelId]">) {
  const { channelId } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/c/${channelId}`);

  const store = await getStore();
  const [channels, apps] = await Promise.all([store.listChannels(), store.listApps()]);
  if (!channels.some((c) => c.id === channelId)) notFound();

  return (
    <Workspace
      user={user}
      channels={channels}
      apps={apps}
      channelId={channelId}
      appsUrl={config().appsUrl}
      agentMode={config().agentMode}
    />
  );
}
