"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Hash } from "lucide-react";
import { AppCard, AppChip } from "@/components/builder/app-card";
import { BuilderPanel } from "@/components/builder/builder-panel";
import { ChannelView } from "@/components/chat/channel-view";
import { useChannel, type ChannelMessage } from "@/components/chat/use-channel";
import type { App, AppRef, Channel, Message, User } from "@/lib/types";
import { usePanelWidth } from "./use-panel-width";

export type OpenApp = { appId: string; version?: number };

function setUrl(channelId: string, open: OpenApp | null) {
  const params = new URLSearchParams();
  if (open) {
    params.set("app", open.appId);
    if (open.version) params.set("v", String(open.version));
  }
  const qs = params.toString();
  window.history.replaceState(null, "", `/c/${channelId}${qs ? `?${qs}` : ""}`);
}

/** One channel: chat on the left, builder panel on the right. Keyed by channel id. */
export function ChannelScope({
  channel,
  user,
  apps,
  appsUrl,
  initialOpen,
  openRequest,
  onAppsStale,
  renderPanelActions,
}: {
  channel: Channel;
  user: User;
  apps: App[];
  appsUrl: string;
  initialOpen: OpenApp | null;
  /** Ask to open an app from outside (sidebar); a new nonce re-opens it. */
  openRequest?: { appId: string; nonce: number } | null;
  onAppsStale: () => void;
  renderPanelActions?: (app: App, version: number) => React.ReactNode;
}) {
  const [open, setOpenState] = useState<OpenApp | null>(initialOpen);
  const [handledRequest, setHandledRequest] = useState(openRequest?.nonce);
  if (openRequest && openRequest.nonce !== handledRequest) {
    // Adjusting state during render in response to a prop change.
    setHandledRequest(openRequest.nonce);
    setOpenState({ appId: openRequest.appId });
  }
  const appsById = new Map(apps.map((a) => [a.id, a]));
  const setOpen = setOpenState;
  useEffect(() => {
    setUrl(channel.id, open);
  }, [channel.id, open]);

  // Live updates: refresh app metadata when the agent ships a version, and
  // auto-open the panel for the person who asked. Refs give the SSE callback
  // the latest values without resubscribing.
  const appsRef = useRef(appsById);
  const messagesRef = useRef<ChannelMessage[]>([]);
  const onUpdate = useCallback(
    (m: Message, prev: Message | undefined) => {
      if (m.author.kind !== "agent" || m.status !== "done" || !m.appRef) return;
      if (prev?.status === "done" && prev.appRef?.version === m.appRef.version) return;
      const known = appsRef.current.get(m.appRef.appId);
      if (!known || known.latestVersion < m.appRef.version) onAppsStale();
      const trigger = messagesRef.current.find((x) => x.id === m.replyTo);
      if (trigger?.author.kind === "user" && trigger.author.uid === user.uid) {
        setOpen({ appId: m.appRef.appId, version: m.appRef.version });
      }
    },
    [onAppsStale, setOpen, user.uid],
  );
  const { messages, loaded, send } = useChannel(channel.id, user, onUpdate);
  useEffect(() => {
    appsRef.current = appsById;
    messagesRef.current = messages;
  });

  const { width, containerRef, handleProps } = usePanelWidth();

  const openApp = open ? appsById.get(open.appId) : undefined;
  const openVersion = open && openApp ? (open.version ?? openApp.latestVersion) : 0;
  const building = openApp ? buildingLine(messages, openApp) : null;

  const renderAppRef = (ref: AppRef, message: ChannelMessage) => {
    const app = appsById.get(ref.appId);
    const onOpen = () => setOpen({ appId: ref.appId, version: ref.version });
    if (message.author.kind === "user") return <AppChip app={app} version={ref.version} onOpen={onOpen} />;
    return (
      <AppCard
        app={app}
        version={ref.version}
        active={open?.appId === ref.appId && openVersion === ref.version}
        onOpen={onOpen}
      />
    );
  };

  return (
    <div ref={containerRef} className="flex min-w-0 flex-1">
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-5">
          <Hash className="size-4 text-faint" />
          <h1 className="font-semibold">{channel.name}</h1>
          {channel.topic ? <p className="ml-2 truncate text-sm text-faint">{channel.topic}</p> : null}
        </header>
        <ChannelView
          channel={channel}
          messages={messages}
          loaded={loaded}
          send={(text) => send(text)}
          renderAppRef={renderAppRef}
        />
      </main>

      {openApp ? (
        <>
          <div
            {...handleProps}
            className="relative hidden w-px shrink-0 cursor-col-resize bg-line transition hover:bg-accent lg:block"
          >
            <span className="absolute inset-y-0 -left-1.5 -right-1.5" />
          </div>
          <div
            suppressHydrationWarning
            className="fixed inset-0 z-40 lg:static lg:z-auto lg:w-(--panel-w) lg:shrink-0"
            style={{ ["--panel-w" as string]: `${width}px` }}
          >
              <BuilderPanel
                app={openApp}
                version={openVersion}
                appsUrl={appsUrl}
                building={building}
                actions={renderPanelActions?.(openApp, openVersion)}
                onSelectVersion={(n) => setOpen({ appId: openApp.id, version: n })}
                onClose={() => setOpen(null)}
                onRequestChanges={(text) => send(text, { appId: openApp.id, version: openVersion })}
              />
          </div>
        </>
      ) : null}
    </div>
  );
}

function buildingLine(messages: ChannelMessage[], app: App): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.author.kind !== "agent" || (m.status !== "thinking" && m.status !== "building")) continue;
    const trigger = messages.find((x) => x.id === m.replyTo);
    if (trigger?.appRef?.appId === app.id || m.statusLine?.includes(app.title)) {
      return m.statusLine || "Working on it...";
    }
  }
  return null;
}
