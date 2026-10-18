"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Calendar, Mail, Pencil, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { usePeople, usePerson, type PersonFallback } from "./people-context";

const dateFmt = new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" });

/** Slide-over with who someone is: picture, name, title, contact, and role here. */
export function PersonSheet({ person, onClose }: { person: PersonFallback; onClose: () => void }) {
  const people = usePeople();
  const current = usePerson(person);
  const member = people?.get(person.uid);
  const isMe = people?.me.uid === person.uid;

  useEffect(() => {
    people?.load(person.uid);
  }, [people, person.uid]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onMouseDown={onClose}>
      <aside
        role="dialog"
        aria-modal
        aria-label={`${current.name}'s profile`}
        onMouseDown={(e) => e.stopPropagation()}
        className="sheet-in flex h-full w-full max-w-sm flex-col border-l border-line-strong bg-panel shadow-2xl shadow-black/60"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-5">
          <h2 className="text-sm font-semibold">Profile</h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-faint hover:bg-hover hover:text-fg" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <Avatar
            name={current.name}
            seed={person.uid}
            photoUrl={current.photoUrl}
            className="size-40 rounded-2xl! text-5xl!"
          />
          <h3 className="mt-5 text-xl font-semibold tracking-tight">{current.name}</h3>
          {current.title ? <p className="mt-0.5 text-muted">{current.title}</p> : null}
          {member?.role === "owner" ? (
            <span className="mt-2 inline-block rounded bg-accent-dim px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
              Owner
            </span>
          ) : null}

          {isMe ? (
            <Link
              href={`/profile?back=${encodeURIComponent(window.location.pathname)}`}
              className="mt-5 flex w-fit items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-sm font-medium transition hover:bg-hover"
            >
              <Pencil className="size-3.5" /> Edit profile
            </Link>
          ) : null}

          <dl className="mt-6 space-y-4 border-t border-line pt-5 text-sm">
            {member?.email ? (
              <Detail icon={Mail} label="Email">
                <a href={`mailto:${member.email}`} className="break-all text-fg hover:text-accent">
                  {member.email}
                </a>
              </Detail>
            ) : null}
            {member?.joinedAt ? (
              <Detail icon={Calendar} label="Joined">
                {dateFmt.format(member.joinedAt)}
              </Detail>
            ) : null}
            {member === null ? <p className="text-muted">Not a member of this workspace.</p> : null}
            {member === undefined ? <div className="h-10 animate-pulse rounded-lg bg-raised" /> : null}
          </dl>
        </div>
      </aside>
    </div>
  );
}

function Detail({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-faint" />
      <div className="min-w-0">
        <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-faint">{label}</dt>
        <dd className="mt-0.5">{children}</dd>
      </div>
    </div>
  );
}
