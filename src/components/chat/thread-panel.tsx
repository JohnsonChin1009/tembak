"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { X } from "lucide-react";
import type { AppRef, Channel, User } from "@/lib/types";
import { Composer } from "./composer";
import { MessageItem } from "./message-item";
import { useChannel, type ChannelMessage, type MessageUpdateHandler } from "./use-channel";

const GROUP_WINDOW_MS = 5 * 60_000;

/**
 * Slack-style thread pane beside the channel (full screen on phones): the parent
 * message, its replies live, and a reply box. Key it by the parent's id.
 */
export function ThreadPanel({
  channel,
  parent,
  user,
  renderAppRef,
  onUpdate,
  onSent,
  onClose,
}: {
  channel: Channel;
  /** The live copy from the channel list, so the reply count stays current. */
  parent: ChannelMessage;
  user: User;
  renderAppRef?: (ref: AppRef, message: ChannelMessage) => React.ReactNode;
  onUpdate?: MessageUpdateHandler;
  onSent?: (text: string) => void;
  onClose: () => void;
}) {
  const { messages, loaded, send } = useChannel(channel.id, user, onUpdate, parent.id);
  const scroller = useRef<HTMLDivElement>(null);
  const count = parent.thread?.count ?? messages.length;

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !e.defaultPrevented && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside
      aria-label="Thread"
      className="sheet-in fixed inset-0 z-40 flex flex-col bg-bg md:static md:z-auto md:w-[420px] md:shrink-0 md:border-l md:border-line"
    >
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-5">
        <h2 className="font-bold">Thread</h2>
        <span className="truncate text-sm text-faint"># {channel.name}</span>
        <button
          onClick={onClose}
          className="ml-auto rounded-md p-1.5 text-faint hover:bg-hover hover:text-fg"
          aria-label="Close thread"
        >
          <X className="size-4" />
        </button>
      </header>

      <div ref={scroller} className="flex-1 overflow-y-auto pb-4">
        <div className="pt-3">
          <MessageItem message={parent} grouped={false} renderAppRef={renderAppRef} />
        </div>
        <div className="flex items-center gap-3 px-5 py-2 text-[13px] text-faint">
          <span>{count === 1 ? "1 reply" : `${count} replies`}</span>
          <span className="h-px flex-1 bg-line" />
        </div>
        {!loaded ? <div className="mx-5 h-10 animate-pulse rounded-lg bg-raised" /> : null}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const grouped =
            prev?.author.kind === "user" &&
            m.author.kind === "user" &&
            prev.author.uid === m.author.uid &&
            m.createdAt - prev.createdAt < GROUP_WINDOW_MS;
          return <MessageItem key={m.id} message={m} grouped={grouped} renderAppRef={renderAppRef} />;
        })}
      </div>

      <div className="px-5 pb-5">
        <Composer
          autoFocus
          placeholder="Reply..."
          onSend={(text) => {
            onSent?.(text);
            return send(text);
          }}
        />
      </div>
    </aside>
  );
}
