import { notFound, redirect } from "next/navigation";
import { Workspace } from "@/components/workspace/workspace";
import { getSessionUser } from "@/lib/auth/session";
import { config } from "@/lib/config";
import { getStore } from "@/lib/store";

export default async function ChannelPage({ params, searchParams }: PageProps<"/c/[channelId]">) {
  const [{ channelId }, query] = await Promise.all([params, searchParams]);
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/c/${channelId}`);

  const store = await getStore();
  const [channels, apps] = await Promise.all([store.listChannels(), store.listApps()]);
  if (!channels.some((c) => c.id === channelId)) notFound();

  const appId = typeof query.app === "string" ? query.app : null;
  const v = typeof query.v === "string" ? Number(query.v) : undefined;

  return (
    <Workspace
      user={user}
      channels={channels}
      apps={apps}
      channelId={channelId}
      appsUrl={config().appsUrl}
      agentMode={config().agentMode}
      initialOpen={appId ? { appId, version: v && v > 0 ? v : undefined } : null}
    />
  );
}
