"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Avatar } from "@/components/avatar";
import { usePeople, usePerson, type PersonFallback } from "./people-context";

const OPEN_DELAY_MS = 350;
const CLOSE_DELAY_MS = 150;
const CARD_W = 256;

/**
 * Wraps a message author's avatar or name: hover shows a profile card, click opens
 * the full profile sheet. Outside a PeopleProvider it renders the children as-is.
 */
export function PersonTrigger({
  person,
  className,
  children,
}: {
  person: PersonFallback;
  className?: string;
  children: React.ReactNode;
}) {
  const people = usePeople();
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  // The card is fixed-position, so drop it when the message list scrolls underneath.
  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [pos]);

  if (!people) return <>{children}</>;

  function show() {
    clearTimeout(timer.current);
    if (pos) return;
    people!.load(person.uid);
    timer.current = setTimeout(() => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - CARD_W - 8));
      // Flip above when the trigger is in the lower part of the screen.
      setPos(r.bottom > window.innerHeight * 0.6 ? { left, bottom: window.innerHeight - r.top + 6 } : { left, top: r.bottom + 6 });
    }, OPEN_DELAY_MS);
  }

  function hide() {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPos(null), CLOSE_DELAY_MS);
  }

  return (
    <span ref={ref} className={clsx("relative", className)} onMouseEnter={show} onMouseLeave={hide}>
      <button
        type="button"
        onClick={() => {
          clearTimeout(timer.current);
          setPos(null);
          people.openSheet(person);
        }}
        className="cursor-pointer rounded-md text-left"
      >
        {children}
      </button>
      {pos ? <PersonHoverCard person={person} style={{ ...pos, width: CARD_W }} /> : null}
    </span>
  );
}

function PersonHoverCard({ person, style }: { person: PersonFallback; style: React.CSSProperties }) {
  const people = usePeople();
  const current = usePerson(person);
  const member = people?.get(person.uid);

  return (
    <div
      role="tooltip"
      style={style}
      className="fixed z-40 rounded-xl border border-line-strong bg-raised p-3 shadow-xl shadow-black/50"
    >
      <div className="flex items-center gap-3">
        <Avatar name={current.name} seed={person.uid} photoUrl={current.photoUrl} className="size-11 rounded-xl!" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{current.name}</p>
          {current.title ? <p className="truncate text-sm text-muted">{current.title}</p> : null}
          {member === null ? <p className="text-xs text-faint">Not in this workspace</p> : null}
          {member?.role === "owner" ? <p className="text-xs text-faint">Workspace owner</p> : null}
        </div>
      </div>
      <p className="mt-2.5 border-t border-line pt-2 text-[11px] text-faint">Click to view profile</p>
    </div>
  );
}
