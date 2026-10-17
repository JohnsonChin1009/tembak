"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Hash } from "lucide-react";
import { ChannelView } from "@/components/chat/channel-view";
import type { App, Channel, User } from "@/lib/types";
import { Sidebar } from "./sidebar";

export function Workspace({
  user,
  channels: initialChannels,
  channelId,
}: {
  user: User;
  channels: Channel[];
  apps: App[];
  channelId: string;
  appsUrl: string;
  agentMode: "mock" | "gemini";
}) {
  const router = useRouter();
  const [channels, setChannels] = useState(initialChannels);
  const channel = channels.find((c) => c.id === channelId);

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
      <Sidebar user={user} channels={channels} channelId={channelId} onCreateChannel={createChannel} />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 border-b border-line px-5">
          <Hash className="size-4 text-faint" />
          <h1 className="font-semibold">{channel?.name}</h1>
          {channel?.topic ? <p className="ml-2 truncate text-sm text-faint">{channel.topic}</p> : null}
        </header>
        {channel ? <ChannelView key={channel.id} channel={channel} user={user} /> : null}
      </main>
    </div>
  );
}
