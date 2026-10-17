import "server-only";
import { randomId } from "@/lib/ids";
import { getStore } from "@/lib/store";
import type { Message } from "@/lib/types";

/** Placeholder until the agent module lands (docs/prd/03-agent.md). */
export async function startAgentRun(trigger: Message): Promise<void> {
  const store = await getStore();
  await store.addMessage({
    id: randomId(),
    channelId: trigger.channelId,
    createdAt: Date.now(),
    author: { kind: "agent" },
    text: "I heard you! The agent isn't wired up yet.",
    mentionsAgent: false,
    status: "done",
    replyTo: trigger.id,
  });
}
