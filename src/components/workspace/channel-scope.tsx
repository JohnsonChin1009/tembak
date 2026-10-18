"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Hash, Menu, Pencil } from "lucide-react";
import { AppCard, AppChip } from "@/components/builder/app-card";
import { BuilderPanel } from "@/components/builder/builder-panel";
import { ChannelView } from "@/components/chat/channel-view";
import { useChannel, type ChannelMessage } from "@/components/chat/use-channel";
import { Checklist } from "@/components/onboarding/checklist";
import { Hint } from "@/components/onboarding/hint";
import { JoinBanner } from "@/components/onboarding/join-banner";
import { useOnboarding } from "@/components/onboarding/onboarding-context";
import { GETTING_STARTED_CHANNEL, GETTING_STARTED_PROMPT } from "@/lib/onboarding";
import type { App, AppRef, Channel, Message, User } from "@/lib/types";
import { ChannelSettingsDialog } from "./manage-dialogs";
import { usePanelWidth } from "./use-panel-width";
import { useWorkspace } from "./workspace-context";

export type OpenApp = { appId: string; version?: number };

function setUrl(base: string, channelId: string, open: OpenApp | null) {
  const params = new URLSearchParams();
  if (open) {
    params.set("app", open.appId);
    if (open.version) params.set("v", String(open.version));
  }
  const qs = params.toString();
  window.history.replaceState(null, "", `${base}/c/${channelId}${qs ? `?${qs}` : ""}`);
}

/** One channel: chat on the left, builder panel on the right. Keyed by channel id. */
export function ChannelScope({
  channel,
  user,
  apps,
  appsUrl,
  initialOpen,
  openRequest,
  onOpenNav,
  onAppsStale,
  onChannelChanged,
  renderPanelActions,
}: {
  channel: Channel;
  user: User;
  apps: App[];
  appsUrl: string;
  initialOpen: OpenApp | null;
  /** Ask to open an app from outside (sidebar); a new nonce re-opens it. */
  openRequest?: { appId: string; nonce: number } | null;
  onOpenNav?: () => void;
  onAppsStale: () => void;
  onChannelChanged?: (channel: Channel) => void;
  renderPanelActions?: (app: App, version: number) => React.ReactNode;
}) {
  const { base, workspace } = useWorkspace();
  const [editing, setEditing] = useState(false);
  // In the shared demo only maintainers can rename; in team workspaces anyone can.
  const canEdit = !!onChannelChanged && (!workspace.open || workspace.role === "owner");
  const onboarding = useOnboarding();
  const [open, setOpenState] = useState<OpenApp | null>(initialOpen);
  const [handledRequest, setHandledRequest] = useState(openRequest?.nonce);
  if (openRequest && openRequest.nonce !== handledRequest) {
    // Adjusting state during render in response to a prop change.
    setHandledRequest(openRequest.nonce);
    setOpenState({ appId: openRequest.appId });
  }
  const appsById = new Map(apps.map((a) => [a.id, a]));
  const guided = channel.id === GETTING_STARTED_CHANNEL && !!onboarding?.checklist;
  const setOpen = setOpenState;
  useEffect(() => {
    setUrl(base, channel.id, open);
  }, [base, channel.id, open]);

  // Live updates: refresh app metadata when the agent ships a version, and
  // auto-open the panel for the person who asked. Refs give the SSE callback
  // the latest values without resubscribing.
  const appsRef = useRef(appsById);
  const messagesRef = useRef<ChannelMessage[]>([]);
  const recordRef = useRef(onboarding?.record);
  const onUpdate = useCallback(
    (m: Message, prev: Message | undefined) => {
      if (m.author.kind !== "agent" || m.status !== "done" || !m.appRef) return;
      if (prev?.status === "done" && prev.appRef?.version === m.appRef.version) return;
      const known = appsRef.current.get(m.appRef.appId);
      // New versions and publishes both change app metadata.
      if (!prev || !known || known.latestVersion < m.appRef.version) onAppsStale();
      const trigger = messagesRef.current.find((x) => x.id === m.replyTo);
      if (trigger?.author.kind === "user" && trigger.author.uid === user.uid) {
        setOpen({ appId: m.appRef.appId, version: m.appRef.version });
        // A new version of an existing app means they asked for a change in chat.
        if (m.appRef.version > 1) recordRef.current?.("revise");
      }
    },
    [onAppsStale, setOpen, user.uid],
  );
  const { messages, loaded, send } = useChannel(channel.id, user, onUpdate);
  useEffect(() => {
    appsRef.current = appsById;
    messagesRef.current = messages;
    recordRef.current = onboarding?.record;
  });

  const { width, containerRef, handleProps } = usePanelWidth();

  const openApp = open ? appsById.get(open.appId) : undefined;
  const openVersion = open && openApp ? (open.version ?? openApp.latestVersion) : 0;
  const building = openApp ? buildingLine(messages, openApp) : null;

  const record = onboarding?.record;
  useEffect(() => {
    if (openApp) record?.("preview");
  }, [openApp, record]);

  function sendMessage(text: string, appRef?: AppRef) {
    if (/(^|\s)@tembak\b/i.test(text)) record?.("mention");
    return send(text, appRef);
  }

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
          <button onClick={onOpenNav} className="-ml-2 rounded-md p-1.5 text-muted hover:bg-hover md:hidden" aria-label="Open menu">
            <Menu className="size-4" />
          </button>
          <Hash className="size-4 text-faint" />
          <h1 className="truncate font-semibold">{channel.name}</h1>
          {channel.topic ? <p className="ml-2 hidden truncate text-sm text-faint sm:block">{channel.topic}</p> : null}
          {canEdit ? (
            <button
              onClick={() => setEditing(true)}
              className="shrink-0 rounded-md p-1.5 text-faint hover:bg-hover hover:text-fg"
              aria-label="Channel settings"
              title="Rename channel"
            >
              <Pencil className="size-3.5" />
            </button>
          ) : null}
        </header>
        {editing && onChannelChanged ? (
          <ChannelSettingsDialog channel={channel} onSaved={onChannelChanged} onClose={() => setEditing(false)} />
        ) : null}
        <ChannelView
          channel={channel}
          messages={messages}
          loaded={loaded}
          send={(text) => sendMessage(text)}
          renderAppRef={renderAppRef}
          starters={guided ? [GETTING_STARTED_PROMPT] : undefined}
          top={
            <>
              <JoinBanner apps={apps} onOpenApp={(a) => setOpen({ appId: a.id })} />
              <Checklist defaultOpen={guided} />
            </>
          }
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
            <div className="relative h-full">
              <BuilderPanel
                app={openApp}
                version={openVersion}
                appsUrl={appsUrl}
                building={building}
                actions={renderPanelActions?.(openApp, openVersion)}
                onSelectVersion={(n) => setOpen({ appId: openApp.id, version: n })}
                onClose={() => setOpen(null)}
                onRequestChanges={(text) => {
                  record?.("revise");
                  return sendMessage(text, { appId: openApp.id, version: openVersion });
                }}
              />
              <Hint id="builder" className="absolute inset-x-4 bottom-32 z-10">
                This is a live preview. Ask for changes below, or switch to Code.
              </Hint>
              <Hint
                id="publish"
                show={!!onboarding?.hintSeen("builder") && !openApp.publishedVersion}
                className="absolute top-16 right-4 z-10 max-w-xs"
              >
                Publishing gives anyone a link. You can unpublish anytime.
              </Hint>
            </div>
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
