import type { Message, ThreadSummary } from "@/lib/types";

const MAX_REPLIERS = 3;

/** The parent's thread summary after one more reply. */
export function nextThread(thread: ThreadSummary | undefined, reply: Message): ThreadSummary {
  const uid = reply.author.kind === "user" ? reply.author.uid : "agent";
  return {
    count: (thread?.count ?? 0) + 1,
    lastAt: reply.createdAt,
    uids: [uid, ...(thread?.uids ?? []).filter((u) => u !== uid)].slice(0, MAX_REPLIERS),
  };
}
