"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { AlertTriangle, AppWindow, ChevronRight, Copy, MessageSquareText, UserPlus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Avatar } from "@/components/avatar";
import { useOnboarding } from "@/components/onboarding/onboarding-context";
import { usePeople, usePerson } from "@/components/people/people-context";
import { PersonTrigger } from "@/components/people/person-card";
import type { AppRef, ThreadSummary } from "@/lib/types";
import { MessageMenu, type MenuItem } from "./message-menu";
import { RichText } from "./rich-text";
import type { ChannelMessage } from "./use-channel";

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
/** Gutter time on grouped rows: the header time without AM/PM, as Slack does. */
const shortTime = (at: number) => timeFmt.format(at).replace(/\s*[AP]\.?M\.?$/i, "");

/*
 * Slack's message grid: a 36px avatar gutter, then name and text on a shared 22px
 * line, so the avatar's top, the name, and a grouped row's hover time all line up.
 */
export function MessageItem({
  message,
  grouped,
  renderAppRef,
  onOpenThread,
}: {
  message: ChannelMessage;
  /** True when the previous message is from the same author a moment ago. */
  grouped: boolean;
  renderAppRef?: (ref: AppRef, message: ChannelMessage) => React.ReactNode;
  /** Shows "Reply in thread" and the replies row. Omitted inside a thread. */
  onOpenThread?: (message: ChannelMessage) => void;
}) {
  const isAgent = message.author.kind === "agent";
  const author = message.author.kind === "user" ? message.author : null;
  const app = message.author.kind === "app" ? message.author : null;
  // Live profile when known; old messages otherwise keep the name they were sent with.
  const person = usePerson(author ?? (app ? { uid: app.uid, name: app.name } : { uid: "agent", name: "Tembak" }));
  const name = isAgent ? "Tembak" : app ? app.appTitle : person.name;
  const time = timeFmt.format(message.createdAt);
  const canReply = !!onOpenThread && !message.pending && !message.failed;
  const people = usePeople();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const menuItems: MenuItem[] = [
    ...(canReply ? [{ label: "Reply in thread", icon: MessageSquareText, run: () => onOpenThread(message) }] : []),
    ...(message.text
      ? [
          {
            label: "Copy text",
            icon: Copy,
            // Tags copy as names, the way they read on screen.
            run: () =>
              navigator.clipboard.writeText(
                message.text.replace(/<@([A-Za-z0-9_-]+)>/g, (_, uid: string) => `@${people?.get(uid)?.name ?? "someone"}`),
              ),
          },
        ]
      : []),
  ];

  function onContextMenu(e: React.MouseEvent) {
    // Keep the browser's menu for links and for text someone has selected to copy.
    const selected = window.getSelection();
    const hasSelection = !!selected && !selected.isCollapsed && e.currentTarget.contains(selected.anchorNode);
    if (message.pending || !menuItems.length || hasSelection || (e.target as HTMLElement).closest("a")) return;
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  }

  return (
    <div
      onContextMenu={onContextMenu}
      className={clsx(
        "group relative flex gap-2 px-5 text-[15px] leading-[22px] hover:bg-hover/40",
        menu && "bg-hover/40",
        grouped ? "py-0.5" : "pt-2 pb-1",
        message.pending && "opacity-60",
      )}
    >
      <div className="w-9 shrink-0">
        {grouped ? (
          <time
            dateTime={new Date(message.createdAt).toISOString()}
            title={time}
            className="invisible block text-right text-[11px] leading-[22px] text-faint tabular-nums group-hover:visible"
          >
            {shortTime(message.createdAt)}
          </time>
        ) : author ? (
          <PersonTrigger person={author} className="block">
            <Avatar name={name} seed={author.uid} photoUrl={person.photoUrl} className="size-9" />
          </PersonTrigger>
        ) : app ? (
          <span className="flex size-9 items-center justify-center rounded-lg border border-line bg-panel" aria-hidden>
            <AppWindow className="size-4 text-accent" />
          </span>
        ) : (
          <Avatar agent className="size-9" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        {!grouped ? (
          <div className="flex items-baseline gap-2">
            {author ? (
              <PersonTrigger person={author}>
                <span className="font-bold hover:underline">{name}</span>
              </PersonTrigger>
            ) : (
              <span className="font-bold">{name}</span>
            )}
            {isAgent ? (
              <span className="self-center rounded bg-accent-dim px-1 font-mono text-[10px] uppercase leading-4 tracking-wider text-accent">
                agent
              </span>
            ) : null}
            {app ? (
              <span className="text-xs text-muted">
                app · via{" "}
                <PersonTrigger person={{ uid: app.uid, name: app.name }}>
                  <span className="hover:underline">{person.name}</span>
                </PersonTrigger>
              </span>
            ) : null}
            <time dateTime={new Date(message.createdAt).toISOString()} className="text-xs text-faint">
              {time}
            </time>
          </div>
        ) : null}

        {isAgent ? (
          <AgentBody message={message} renderAppRef={renderAppRef} />
        ) : app ? (
          <AppBody message={message} renderAppRef={renderAppRef} />
        ) : (
          <UserBody message={message} renderAppRef={renderAppRef} />
        )}

        {message.failed ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-danger">
            <AlertTriangle className="size-3" /> Not sent. Check your connection and try again.
          </p>
        ) : null}

        {canReply && message.thread?.count ? (
          <ThreadRow thread={message.thread} onOpen={() => onOpenThread(message)} />
        ) : null}
      </div>

      {canReply ? (
        <div className="absolute -top-4 right-5 z-10 hidden rounded-lg border border-line-strong bg-panel p-0.5 shadow-lg shadow-black/30 group-hover:flex">
          <button
            type="button"
            onClick={() => onOpenThread(message)}
            title="Reply in thread"
            aria-label="Reply in thread"
            className="rounded-md p-1.5 text-muted transition hover:bg-hover hover:text-fg"
          >
            <MessageSquareText className="size-4" />
          </button>
        </div>
      ) : null}
      {menu ? <MessageMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} /> : null}
    </div>
  );
}

/** "3 replies · Last reply 5m ago" with the latest repliers' faces, as in Slack. */
function ThreadRow({ thread, onOpen }: { thread: ThreadSummary; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group/thread -ml-1 mt-1 flex w-full max-w-md items-center gap-2 rounded-md border border-transparent p-1 text-left text-[13px] leading-5 transition hover:border-line hover:bg-panel"
    >
      <span className="flex gap-1">
        {thread.uids.map((uid) => (
          <Replier key={uid} uid={uid} />
        ))}
      </span>
      <span className="font-bold text-info hover:underline">
        {thread.count} {thread.count === 1 ? "reply" : "replies"}
      </span>
      <span className="text-faint group-hover/thread:hidden">Last reply {ago(thread.lastAt)}</span>
      <span className="hidden text-faint group-hover/thread:inline">View thread</span>
      <ChevronRight className="ml-auto hidden size-4 text-faint group-hover/thread:block" />
    </button>
  );
}

function Replier({ uid }: { uid: string }) {
  const people = usePeople();
  useEffect(() => {
    if (uid !== "agent") people?.load(uid);
  }, [people, uid]);
  if (uid === "agent") return <Avatar agent className="size-6 rounded-md" />;
  const member = people?.get(uid);
  return <Avatar name={member?.name ?? "?"} seed={uid} photoUrl={member?.photoUrl} className="size-6 rounded-md text-[11px]" />;
}

function ago(at: number): string {
  const s = Math.max(0, (Date.now() - at) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const days = Math.floor(s / 86400);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

function UserBody({
  message,
  renderAppRef,
}: {
  message: ChannelMessage;
  renderAppRef?: (ref: AppRef, message: ChannelMessage) => React.ReactNode;
}) {
  return (
    <div className="text-fg/90">
      {message.appRef && renderAppRef ? (
        <div className="mb-1">{renderAppRef(message.appRef, message)}</div>
      ) : null}
      <RichText text={message.text} />
    </div>
  );
}

/** A post from an app (tembak.post): the text, then a link back to the app. */
function AppBody({
  message,
  renderAppRef,
}: {
  message: ChannelMessage;
  renderAppRef?: (ref: AppRef, message: ChannelMessage) => React.ReactNode;
}) {
  return (
    <div className="text-fg/90">
      <RichText text={message.text} />
      {message.appRef && renderAppRef ? <div className="mt-1">{renderAppRef(message.appRef, message)}</div> : null}
    </div>
  );
}

function AgentBody({
  message,
  renderAppRef,
}: {
  message: ChannelMessage;
  renderAppRef?: (ref: AppRef, message: ChannelMessage) => React.ReactNode;
}) {
  if (message.status === "thinking" || message.status === "building") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="dot-pulse flex gap-0.5" aria-hidden>
            <span className="size-1.5 rounded-full bg-accent" />
            <span className="size-1.5 rounded-full bg-accent" />
            <span className="size-1.5 rounded-full bg-accent" />
          </span>
          <span className="sheen">
            {message.statusLine ?? (message.status === "thinking" ? "Reading the conversation..." : "Building...")}
          </span>
        </div>
        {message.text ? <AgentMarkdown text={message.text} /> : null}
        {message.status === "building" ? (
          <div className="h-20 max-w-md animate-pulse rounded-xl border border-line bg-raised" />
        ) : null}
      </div>
    );
  }
  if (message.status === "error") {
    return (
      <div className="space-y-1">
        {message.text ? <AgentMarkdown text={message.text} /> : null}
        <p className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {message.error ?? "Something went wrong."}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {message.text ? <AgentMarkdown text={message.text} /> : null}
      {message.appRef && renderAppRef ? renderAppRef(message.appRef, message) : null}
      {message.action === "invite" ? <InviteAction /> : null}
    </div>
  );
}

function InviteAction() {
  const onboarding = useOnboarding();
  if (!onboarding) return null;
  return (
    <button
      onClick={() => onboarding.setInviteOpen(true)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-dim px-3 py-1.5 text-sm font-medium text-accent transition hover:bg-accent/20"
    >
      <UserPlus className="size-3.5" /> Invite people
    </button>
  );
}

function AgentMarkdown({ text }: { text: string }) {
  return (
    <div className="md text-fg/90">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
