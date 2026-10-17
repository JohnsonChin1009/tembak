"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, Sparkles } from "lucide-react";
import type { AppRef, Channel } from "@/lib/types";
import { Composer, type ComposerHandle } from "./composer";
import { MessageItem } from "./message-item";
import type { ChannelMessage } from "./use-channel";

const GROUP_WINDOW_MS = 5 * 60_000;

const STARTERS = [
  "@tembak make a dashboard from what we just discussed",
  "@tembak build a tracker for this",
  "@tembak what could you build for us here?",
];

export function ChannelView({
  channel,
  messages,
  loaded,
  send,
  renderAppRef,
}: {
  channel: Channel;
  messages: ChannelMessage[];
  loaded: boolean;
  send: (text: string) => Promise<void>;
  renderAppRef?: (ref: AppRef, message: ChannelMessage) => React.ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const [unseen, setUnseen] = useState(false);
  const composer = useRef<ComposerHandle>(null);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    // Your own just-sent message always scrolls into view.
    if (messages.at(-1)?.pending) atBottom.current = true;
    if (atBottom.current) {
      el.scrollTop = el.scrollHeight;
    } else if (messages.length) {
      requestAnimationFrame(() => setUnseen(true));
    }
  }, [messages]);

  // Stay pinned to the bottom when layout changes (panel opens, text reflows).
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (!el || !content.current) return;
    const ro = new ResizeObserver(() => {
      if (atBottom.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    ro.observe(content.current);
    return () => ro.disconnect();
  }, []);

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottom.current) setUnseen(false);
  }

  function jumpToBottom() {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }

  const hasAgent = messages.some((m) => m.author.kind === "agent" || m.mentionsAgent);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={scroller} onScroll={onScroll} className="flex-1 overflow-y-auto pb-4">
        {loaded && messages.length === 0 ? <EmptyChannel channel={channel} /> : null}
        {!loaded ? <LoadingRows /> : null}
        <div ref={content} className="pt-4">
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const grouped =
              prev?.author.kind === "user" &&
              m.author.kind === "user" &&
              prev.author.uid === m.author.uid &&
              m.createdAt - prev.createdAt < GROUP_WINDOW_MS &&
              !m.appRef;
            return <MessageItem key={m.id} message={m} grouped={grouped} renderAppRef={renderAppRef} />;
          })}
        </div>
      </div>

      {unseen ? (
        <button
          onClick={jumpToBottom}
          className="absolute bottom-28 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-line-strong bg-raised px-3 py-1.5 text-xs font-medium shadow-lg"
        >
          <ArrowDown className="size-3.5" /> New messages
        </button>
      ) : null}

      <div className="px-5 pb-5">
        {loaded && !hasAgent && messages.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {STARTERS.map((s) => (
              <button
                key={s}
                onClick={() => composer.current?.insert(s)}
                className="flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1 text-xs text-muted transition hover:border-accent/40 hover:text-fg"
              >
                <Sparkles className="size-3 text-accent" />
                {s.replace("@tembak ", "")}
              </button>
            ))}
          </div>
        ) : null}
        <Composer
          ref={composer}
          autoFocus
          placeholder={`Message #${channel.name}. Tag @tembak to build something`}
          onSend={(text) => {
            atBottom.current = true;
            setUnseen(false);
            return send(text);
          }}
        />
        <p className="mt-1.5 px-1 text-[11px] text-faint">
          <kbd className="font-mono">Enter</kbd> to send · <kbd className="font-mono">Shift+Enter</kbd> for a new line
        </p>
      </div>
    </div>
  );
}

function EmptyChannel({ channel }: { channel: Channel }) {
  return (
    <div className="mx-5 mt-10 max-w-lg">
      <p className="text-2xl font-semibold tracking-tight">Welcome to #{channel.name}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Talk it through here. When there&apos;s enough context, tag <span className="text-accent">@tembak</span> and
        ask for a dashboard, a tracker, a calculator, anything small your team needs today.
      </p>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-5 px-5 pt-6" aria-hidden>
      {[0.7, 0.45, 0.6].map((w, i) => (
        <div key={i} className="flex gap-3">
          <div className="size-8 animate-pulse rounded-lg bg-raised" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-raised" />
            <div className="h-3 animate-pulse rounded bg-raised" style={{ width: `${w * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
