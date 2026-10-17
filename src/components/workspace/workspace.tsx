"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppWindow } from "lucide-react";
import { PublishControls } from "@/components/builder/publish-controls";
import type { App, Channel, User } from "@/lib/types";
import { ChannelScope, type OpenApp } from "./channel-scope";
import { Section, Sidebar } from "./sidebar";

export function Workspace({
  user,
  channels: initialChannels,
  apps: initialApps,
  channelId,
  appsUrl,
  initialOpen,
}: {
  user: User;
  channels: Channel[];
  apps: App[];
  channelId: string;
  appsUrl: string;
  agentMode: "mock" | "gemini";
  initialOpen: OpenApp | null;
}) {
  const router = useRouter();
  const [channels, setChannels] = useState(initialChannels);
  const [apps, setApps] = useState(initialApps);
  const [openRequest, setOpenRequest] = useState<{ appId: string; nonce: number } | null>(null);
  const channel = channels.find((c) => c.id === channelId);

  const refreshApps = useCallback(async () => {
    const res = await fetch("/api/apps");
    if (res.ok) setApps((await res.json()) as App[]);
  }, []);

  async function createChannel(name: string) {
    const res = await fetch("/api/channels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    const created = (await res.json()) as Channel;
    setChannels((cs) => [...cs.filter((c) => c.id !== created.id), created]);
    router.push(`/c/${created.id}`);
  }

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar user={user} channels={channels} channelId={channelId} onCreateChannel={createChannel}>
        <Section title="Apps">
          {apps.length === 0 ? <p className="px-2 py-1 text-xs text-faint">Nothing built yet</p> : null}
          {apps.slice(0, 12).map((a) => (
            <Link
              key={a.id}
              href={`/c/${a.channelId}?app=${a.id}`}
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
      </Sidebar>
      {channel ? (
        <ChannelScope
          key={channel.id}
          channel={channel}
          user={user}
          apps={apps}
          appsUrl={appsUrl}
          initialOpen={initialOpen}
          openRequest={openRequest}
          onAppsStale={refreshApps}
          renderPanelActions={(app, version) => (
            <PublishControls app={app} version={version} appsUrl={appsUrl} onChanged={refreshApps} />
          )}
        />
      ) : null}
    </div>
  );
}
