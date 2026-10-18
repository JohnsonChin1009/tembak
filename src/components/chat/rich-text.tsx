"use client";

import { useEffect } from "react";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { usePeople, usePerson } from "@/components/people/people-context";
import { PersonTrigger } from "@/components/people/person-card";

const MENTION_HREF = "#mention";
const USER_HREF = "#user:";
// Code spans and blocks stay literal; mentions are only marked up outside them.
const CODE_RE = /(```[\s\S]*?```|`[^`\n]*`)/;

function markMentions(text: string): string {
  return text
    .split(CODE_RE)
    .map((part, i) =>
      i % 2
        ? part
        : part
            .replace(/(^|\s)@tembak\b/gi, `$1[@tembak](${MENTION_HREF})`)
            .replace(/<@([A-Za-z0-9_-]+)>/g, `[@$1](${USER_HREF}$1)`),
    )
    .join("");
}

/**
 * A user's message: Slack-style markdown (bold, italics, strike, lists, quotes, code),
 * line breaks kept as typed, @tembak and tagged people highlighted, and URLs linked.
 */
export function RichText({ text }: { text: string }) {
  return (
    <div className="md break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
          a: ({ href, children }) =>
            href?.startsWith(USER_HREF) ? (
              <UserMention uid={href.slice(USER_HREF.length)} />
            ) : href === MENTION_HREF ? (
              <span className="rounded bg-accent-dim px-1 py-px font-medium text-accent">{children}</span>
            ) : (
              <a href={href} target="_blank" rel="noreferrer noopener">
                {children}
              </a>
            ),
        }}
      >
        {markMentions(text)}
      </ReactMarkdown>
    </div>
  );
}

/** A tagged person by their current name; opens their profile. Tags of you stand out, as in Slack. */
function UserMention({ uid }: { uid: string }) {
  const people = usePeople();
  const person = usePerson({ uid, name: "someone" });
  const isMe = people?.me.uid === uid;
  useEffect(() => {
    people?.load(uid);
  }, [people, uid]);
  return (
    <PersonTrigger person={person} className="inline">
      <span
        className={clsx(
          "rounded px-0.5 font-medium",
          isMe ? "bg-warn/20 text-warn" : "bg-info/15 text-info hover:bg-info/25",
        )}
      >
        @{person.name}
      </span>
    </PersonTrigger>
  );
}
