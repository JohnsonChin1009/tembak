import { Fragment } from "react";

const TOKEN_RE = /(@tembak\b|https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/gi;

/** Plain user text with @tembak highlighted and URLs linked. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(TOKEN_RE);
  return (
    <p className="whitespace-pre-wrap break-words leading-relaxed">
      {parts.map((part, i) => {
        if (/^@tembak$/i.test(part)) {
          return (
            <span key={i} className="rounded bg-accent-dim px-1 py-px font-medium text-accent">
              {part}
            </span>
          );
        }
        if (/^https?:\/\//i.test(part)) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noreferrer noopener"
              className="text-info underline decoration-info/40 underline-offset-2 hover:decoration-info"
            >
              {part}
            </a>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </p>
  );
}
