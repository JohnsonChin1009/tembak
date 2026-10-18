import { notFound, redirect } from "next/navigation";
import { Workspace } from "@/components/workspace/workspace";
import { getSessionUser } from "@/lib/auth/session";
import { config } from "@/lib/config";
import { redact } from "@/lib/data/sources";
import { getStore } from "@/lib/store";
import { membership, rememberWorkspace, workspaceInfo } from "@/lib/workspaces";

export default async function ChannelPage({ params, searchParams }: PageProps<"/w/[slug]/c/[channelId]">) {
  const [{ slug, channelId }, query] = await Promise.all([params, searchParams]);
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/w/${slug}/c/${channelId}`)}`);

  const store = await getStore();
  const m = await membership(user, await store.getWorkspaceBySlug(slug));
  if (!m) notFound();
  const wid = m.workspace.id;

  const [channels, apps, sources, workspaces, me, members, mentions] = await Promise.all([
    store.listChannels(wid),
    store.listApps(wid),
    store.listSources(wid),
    store.listWorkspacesForUser(user.uid),
    store.getMember(wid, user.uid),
    // The open demo can have many members and has no checklist, so skip the list there.
    m.workspace.open ? Promise.resolve([]) : store.listMembers(wid),
    store.getMentions(wid, user.uid),
    rememberWorkspace(user, m.workspace),
  ]);
  if (!channels.some((c) => c.id === channelId)) notFound();

  const appId = typeof query.app === "string" ? query.app : null;
  const v = typeof query.v === "string" ? Number(query.v) : undefined;

  return (
    <Workspace
      user={user}
      workspace={workspaceInfo(m)}
      workspaces={workspaces.map((w) => ({ slug: w.slug, name: w.name }))}
      channels={channels}
      // Onboarding progress is private to each member.
      members={members.map((member) => ({ ...member, onboarding: undefined }))}
      apps={apps}
      sources={sources.map(redact)}
      serviceAccountEmail={config().serviceAccountEmail}
      channelId={channelId}
      mentions={mentions}
      appsUrl={config().appsUrl}
      agentMode={config().agentMode}
      initialOpen={appId ? { appId, version: v && v > 0 ? v : undefined } : null}
      onboarding={{
        // Partial merge writes can leave either field missing in Firestore.
        state: { ...me?.onboarding, steps: me?.onboarding?.steps ?? {}, hints: me?.onboarding?.hints ?? [] },
        checklist: !m.workspace.open,
        teamJoined: members.length > 1,
      }}
    />
  );
}
