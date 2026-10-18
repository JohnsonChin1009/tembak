"use client";

import { useEffect, useState } from "react";
import type { UnreadMentions } from "@/lib/types";

const POLL_MS = 15_000;

function without(mentions: UnreadMentions, channelId: string): UnreadMentions {
  if (!mentions[channelId]) return mentions;
  const { [channelId]: _read, ...rest } = mentions;
  return rest;
}

/**
 * Unread tags of the signed-in member, by channel, for the sidebar. Polls while the
 * tab is visible. The open channel counts as read: on entry, while you're in it, and as you leave.
 */
export function useMentions(api: string, channelId: string, initial: UnreadMentions): UnreadMentions {
  const [mentions, setMentions] = useState(() => without(initial, channelId));
  const [openChannel, setOpenChannel] = useState(channelId);
  if (openChannel !== channelId) {
    // Adjusting state during render in response to a prop change.
    setOpenChannel(channelId);
    setMentions((m) => without(m, channelId));
  }

  useEffect(() => {
    const markRead = () =>
      fetch(`${api}/me/mentions`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channelId }),
      }).catch(() => null);

    async function refresh() {
      if (document.hidden) return;
      const res = await fetch(`${api}/me/mentions`).catch(() => null);
      if (!res?.ok) return;
      const next = (await res.json()) as UnreadMentions;
      if (next[channelId]) void markRead();
      setMentions(without(next, channelId));
    }

    void markRead();
    const timer = setInterval(refresh, POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      void markRead();
    };
  }, [api, channelId]);

  return mentions;
}
