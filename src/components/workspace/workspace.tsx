"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppWindow } from "lucide-react";
import { PublishControls } from "@/components/builder/publish-controls";
import { DataSection } from "@/components/data/data-section";
import type { App, Channel, Source, User, WorkspaceInfo } from "@/lib/types";
import { ChannelScope, type OpenApp } from "./channel-scope";
import { Section, Sidebar } from "./sidebar";
import { WorkspaceProvider } from "./workspace-context";
import type { WorkspaceLink } from "./workspace-menu";

type Props = {
  user: User;
  workspace: WorkspaceInfo;
  workspaces: WorkspaceLink[];
  channels: Channel[];
  apps: App[];
  sources: Source[];
  channelId: string;
  appsUrl: string;
  serviceAccountEmail?: string;
  agentMode: "mock" | "gemini";
  initialOpen: OpenApp | null;
};

export function Workspace(props: Props) {
  return (
    <WorkspaceProvider workspace={props.workspace}>
      <WorkspaceShell {...props} />
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
  appsUrl,
  serviceAccountEmail,
  initialOpen,
}: Props) {
  const router = useRouter();
  const base = `/w/${encodeURIComponent(workspace.slug)}`;
  const api = `/api${base}`;
  const [channels, setChannels] = useState(initialChannels);
  const [apps, setApps] = useState(initialApps);
  const [sources, setSources] = useState(initialSources);
  const [navOpen, setNavOpen] = useState(false);
  const [openRequest, setOpenRequest] = useState<{ appId: string; nonce: number } | null>(null);
  const channel = channels.find((c) => c.id === channelId);

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
          if ((e.target as HTMLElement).closest("a")) setNavOpen(false);
        }}
      >
        <Sidebar
          user={user}
          workspaces={workspaces}
          channels={channels}
          channelId={channelId}
          onCreateChannel={createChannel}
        >
          <Section title="Apps">
            {apps.length === 0 ? <p className="px-2 py-1 text-xs text-faint">Nothing built yet</p> : null}
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
          renderPanelActions={(app, version) => (
            <PublishControls app={app} version={version} appsUrl={appsUrl} onChanged={refreshApps} />
          )}
        />
      ) : null}
    </div>
  );
}
