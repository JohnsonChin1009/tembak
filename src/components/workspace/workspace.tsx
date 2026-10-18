"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppWindow } from "lucide-react";
import { PublishControls } from "@/components/builder/publish-controls";
import { DataSection } from "@/components/data/data-section";
import { Hint } from "@/components/onboarding/hint";
import { OnboardingProvider, useOnboarding, type OnboardingInit } from "@/components/onboarding/onboarding-context";
import { PeopleProvider, usePeople } from "@/components/people/people-context";
import { PersonSheet } from "@/components/people/person-sheet";
import type { App, Channel, Member, Source, UnreadMentions, User, WorkspaceInfo } from "@/lib/types";
import { ChannelScope, type OpenApp } from "./channel-scope";
import { Section, Sidebar } from "./sidebar";
import { useMentions } from "./use-mentions";
import { WorkspaceProvider } from "./workspace-context";
import { InviteDialog, type WorkspaceLink } from "./workspace-menu";

type Props = {
  user: User;
  workspace: WorkspaceInfo;
  workspaces: WorkspaceLink[];
  channels: Channel[];
  /** Empty in the open demo; profiles there load on demand. */
  members: Member[];
  apps: App[];
  sources: Source[];
  channelId: string;
  /** The signed-in member's unread tags, by channel. */
  mentions: UnreadMentions;
  appsUrl: string;
  serviceAccountEmail?: string;
  agentMode: "mock" | "gemini";
  initialOpen: OpenApp | null;
  onboarding: OnboardingInit;
};

export function Workspace(props: Props) {
  return (
    <WorkspaceProvider workspace={props.workspace}>
      <OnboardingProvider init={props.onboarding}>
        <PeopleProvider
          api={`/api/w/${encodeURIComponent(props.workspace.slug)}`}
          me={props.user}
          members={props.members}
        >
          <WorkspaceShell {...props} />
        </PeopleProvider>
      </OnboardingProvider>
    </WorkspaceProvider>
  );
}

function WorkspaceShell({
  user,
  workspace,
  workspaces,
  channels: initialChannels,
  apps: initialApps,
  sources: initialSources,
  channelId,
  mentions: initialMentions,
  appsUrl,
  serviceAccountEmail,
  initialOpen,
}: Props) {
  const router = useRouter();
  const onboarding = useOnboarding();
  const people = usePeople();
  const base = `/w/${encodeURIComponent(workspace.slug)}`;
  const api = `/api${base}`;
  const [channels, setChannels] = useState(initialChannels);
  const [apps, setApps] = useState(initialApps);
  const [sources, setSources] = useState(initialSources);
  const [navOpen, setNavOpen] = useState(false);
  const [openRequest, setOpenRequest] = useState<{ appId: string; nonce: number } | null>(null);
  const channel = channels.find((c) => c.id === channelId);
  const mentions = useMentions(api, channelId, initialMentions);

  const refreshApps = useCallback(async () => {
    const res = await fetch(`${api}/apps`);
    if (res.ok) setApps((await res.json()) as App[]);
  }, [api]);

  async function createChannel(name: string) {
    const res = await fetch(`${api}/channels`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    const created = (await res.json()) as Channel;
    setChannels((cs) => [...cs.filter((c) => c.id !== created.id), created]);
    router.push(`${base}/c/${created.id}`);
  }

  return (
    <div className="flex h-full overflow-hidden">
      {navOpen ? <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setNavOpen(false)} /> : null}
      <div
        className={navOpen ? "fixed inset-y-0 left-0 z-50 flex md:static md:z-auto" : "hidden md:flex"}
        onClickCapture={(e) => {
          if ((e.target as HTMLElement).closest("a, [data-closes-nav]")) setNavOpen(false);
        }}
      >
        <Sidebar
          user={user}
          workspaces={workspaces}
          channels={channels}
          channelId={channelId}
          mentions={mentions}
          onCreateChannel={createChannel}
        >
          <Section title="Apps">
            {apps.length === 0 ? (
              <p className="px-2 py-1 text-xs text-faint">Apps built in this workspace show up here.</p>
            ) : null}
            {apps.slice(0, 12).map((a) => (
              <Link
                key={a.id}
                href={`${base}/c/${a.channelId}?app=${a.id}`}
                onClick={(e) => {
                  if (a.channelId !== channelId) return;
                  e.preventDefault();
                  setOpenRequest({ appId: a.id, nonce: Date.now() });
                }}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted transition hover:bg-hover/60 hover:text-fg"
              >
                <AppWindow className="size-3.5 shrink-0 text-faint" />
                <span className="min-w-0 flex-1 truncate">{a.title}</span>
                {a.publishedVersion ? <span className="size-1.5 shrink-0 rounded-full bg-accent" title="Live" /> : null}
              </Link>
            ))}
          </Section>
          <DataSection sources={sources} serviceAccountEmail={serviceAccountEmail} onChange={setSources} />
          <Hint id="data" show={!!onboarding?.hintSeen("builder")} className="mx-1 mt-2 text-xs">
            Connect a Google Sheet, Notion database, or Linear team, then ask @tembak to use it.
          </Hint>
        </Sidebar>
      </div>
      {channel ? (
        <ChannelScope
          key={channel.id}
          channel={channel}
          user={user}
          apps={apps}
          appsUrl={appsUrl}
          initialOpen={initialOpen}
          openRequest={openRequest}
          onOpenNav={() => setNavOpen(true)}
          onAppsStale={refreshApps}
          onChannelChanged={(c) => setChannels((cs) => cs.map((x) => (x.id === c.id ? c : x)))}
          renderPanelActions={(app, version) => (
            <PublishControls
              app={app}
              version={version}
              appsUrl={appsUrl}
              onChanged={refreshApps}
              onPublished={() => onboarding?.record("publish")}
            />
          )}
        />
      ) : null}
      {people?.sheet ? <PersonSheet key={people.sheet.uid} person={people.sheet} onClose={people.closeSheet} /> : null}
      {onboarding?.inviteOpen ? <InviteDialog onClose={() => onboarding.setInviteOpen(false)} /> : null}
    </div>
  );
}
