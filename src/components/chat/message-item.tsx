"use client";

import clsx from "clsx";
import { AlertTriangle, UserPlus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Avatar } from "@/components/avatar";
import { useOnboarding } from "@/components/onboarding/onboarding-context";
import type { AppRef } from "@/lib/types";
import { RichText } from "./rich-text";
import type { ChannelMessage } from "./use-channel";

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

export function MessageItem({
  message,
  grouped,
  renderAppRef,
}: {
  message: ChannelMessage;
  /** True when the previous message is from the same author a moment ago. */
  grouped: boolean;
  renderAppRef?: (ref: AppRef, message: ChannelMessage) => React.ReactNode;
}) {
  const isAgent = message.author.kind === "agent";
  const name = message.author.kind === "agent" ? "Tembak" : message.author.name;
  const time = timeFmt.format(message.createdAt);

  return (
    <div
      className={clsx(
        "group relative flex gap-3 px-5 hover:bg-white/[0.015]",
        grouped ? "py-0.5" : "pt-3 pb-0.5",
        message.pending && "opacity-60",
      )}
    >
      <div className="w-8 shrink-0">
        {grouped ? (
          <span className="invisible block pt-1 text-right font-mono text-[10px] text-faint group-hover:visible">
            {time}
          </span>
        ) : (
          <Avatar
            agent={isAgent}
            name={name}
            seed={message.author.kind === "user" ? message.author.uid : "agent"}
            photoUrl={message.author.kind === "user" ? message.author.photoUrl : undefined}
          />
        )}
      </div>
      <div className="min-w-0 flex-1 text-[15px]">
        {!grouped ? (
          <div className="flex items-baseline gap-2">
            <span className="font-semibold">{name}</span>
            {isAgent ? (
              <span className="rounded bg-accent-dim px-1 py-px font-mono text-[10px] uppercase tracking-wider text-accent">
                agent
              </span>
            ) : null}
            <span className="font-mono text-[11px] text-faint">{time}</span>
          </div>
        ) : null}

        {isAgent ? <AgentBody message={message} renderAppRef={renderAppRef} /> : <UserBody message={message} renderAppRef={renderAppRef} />}

        {message.failed ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-danger">
            <AlertTriangle className="size-3" /> Not sent. Check your connection and try again.
          </p>
        ) : null}
      </div>
    </div>
  );
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

function AgentBody({
  message,
  renderAppRef,
}: {
  message: ChannelMessage;
  renderAppRef?: (ref: AppRef, message: ChannelMessage) => React.ReactNode;
}) {
  if (message.status === "thinking" || message.status === "building") {
    return (
      <div className="mt-1 space-y-2">
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
      <div className="mt-1 space-y-1">
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
    <div className="md leading-relaxed text-fg/90">
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
