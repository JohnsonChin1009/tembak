"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { Member, User } from "@/lib/types";

/** What a message author carries, used until (or instead of) the member record. */
export type PersonFallback = { uid: string; name: string; photoUrl?: string };

type Value = {
  me: User;
  /** Current member record; undefined while unknown, null when not a member (seeded examples). */
  get: (uid: string) => Member | null | undefined;
  /** Fetches a member not yet known. Safe to call repeatedly. */
  load: (uid: string) => void;
  /** The profile open in the side panel, if any. */
  sheet: PersonFallback | null;
  /** Everyone in the workspace, for @-mentions. Empty in the open demo. */
  members: Member[];
  openSheet: (person: PersonFallback) => void;
  closeSheet: () => void;
};

const PeopleContext = createContext<Value | null>(null);

/**
 * Who's who in the workspace, so chat shows current names and photos rather than
 * the copies stored on old messages. Seeded with the member list when the page has it.
 */
export function PeopleProvider({
  api,
  me,
  members,
  children,
}: {
  api: string;
  me: User;
  members: Member[];
  children: React.ReactNode;
}) {
  const [fetched, setFetched] = useState<Record<string, Member | null>>({});
  const inflight = useRef(new Set<string>());
  const [sheet, setSheet] = useState<PersonFallback | null>(null);

  const known = useMemo(() => new Map(members.map((m) => [m.uid, m])), [members]);

  const get = useCallback(
    (uid: string) => {
      const member = known.get(uid) ?? fetched[uid];
      // The signed-in user's own edits show right away, even before the member list refreshes.
      if (uid !== me.uid) return member;
      const base: Member = member ?? { uid, role: "member", name: me.name, email: me.email, joinedAt: 0 };
      return { ...base, name: me.name, title: me.title, photoUrl: me.photoUrl };
    },
    [known, fetched, me],
  );

  const load = useCallback(
    (uid: string) => {
      if (known.has(uid) || uid in fetched || inflight.current.has(uid)) return;
      inflight.current.add(uid);
      fetch(`${api}/members/${encodeURIComponent(uid)}`)
        .then((r) => (r.ok ? (r.json() as Promise<Member>) : r.status === 404 ? null : Promise.reject()))
        .then((m) => setFetched((f) => ({ ...f, [uid]: m })))
        .catch(() => {})
        .finally(() => inflight.current.delete(uid));
    },
    [api, known, fetched],
  );

  const closeSheet = useCallback(() => setSheet(null), []);
  const value = useMemo(
    () => ({ me, get, load, sheet, members, openSheet: setSheet, closeSheet }),
    [me, get, load, sheet, members, closeSheet],
  );

  return (
    <PeopleContext.Provider value={value}>
      {children}
    </PeopleContext.Provider>
  );
}

/** Null outside a workspace (chat still renders, just without live profiles). */
export function usePeople(): Value | null {
  return useContext(PeopleContext);
}

/** The best current name and photo for a message author. */
export function usePerson(fallback: PersonFallback): PersonFallback & { title?: string } {
  const people = usePeople();
  const member = people?.get(fallback.uid);
  if (!member) return fallback;
  return { uid: fallback.uid, name: member.name, photoUrl: member.photoUrl, title: member.title };
}
