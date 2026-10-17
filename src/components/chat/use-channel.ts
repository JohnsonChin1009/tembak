"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { randomId } from "@/lib/ids";
import type { AppRef, Message, User } from "@/lib/types";

type Pending = Message & { pending?: boolean; failed?: boolean };

function merge(list: Pending[], incoming: Message[]): Pending[] {
  const byId = new Map(list.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Live message list for one channel: SSE snapshot + updates, with optimistic sends.
 * Mount it under a `key` of the channel id so switching channels starts fresh.
 */
export function useChannel(
  channelId: string,
  user: User,
  /** Called for each live update (not the initial snapshot) with the previous copy, if any. */
  onUpdate?: (message: Message, previous: Message | undefined) => void,
) {
  const [messages, setMessages] = useState<Pending[]>([]);
  const latest = useRef<Pending[]>([]);
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
    latest.current = messages;
  });
  const [loaded, setLoaded] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource(`/api/channels/${channelId}/stream`);
    es.addEventListener("snapshot", (e) => {
      const snapshot = JSON.parse((e as MessageEvent).data) as Message[];
      // Keep optimistic messages that the snapshot doesn't know about yet.
      setMessages((prev) => merge(prev.filter((m) => m.pending), snapshot));
      setLoaded(true);
    });
    es.addEventListener("message", (e) => {
      const m = JSON.parse((e as MessageEvent).data) as Message;
      onUpdateRef.current?.(m, latest.current.find((x) => x.id === m.id));
      setMessages((prev) => merge(prev, [m]));
    });
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, [channelId]);

  const send = useCallback(
    async (text: string, appRef?: AppRef) => {
      const id = randomId(16);
      const optimistic: Pending = {
        id,
        channelId,
        createdAt: Date.now(),
        author: { kind: "user", uid: user.uid, name: user.name, photoUrl: user.photoUrl },
        text,
        mentionsAgent: !!appRef || /(^|\s)@tembak\b/i.test(text),
        appRef,
        pending: true,
      };
      setMessages((prev) => merge(prev, [optimistic]));
      const res = await fetch(`/api/channels/${channelId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, text, appRef }),
      }).catch(() => null);
      if (!res?.ok) {
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, pending: false, failed: true } : m)));
        return;
      }
      const saved = (await res.json()) as Message;
      setMessages((prev) => merge(prev, [saved]));
    },
    [channelId, user],
  );

  return { messages, loaded, connected, send };
}

export type ChannelMessage = Pending;
