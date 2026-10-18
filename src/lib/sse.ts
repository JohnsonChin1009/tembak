import "server-only";
import type { MessageListener } from "@/lib/store/types";
import type { Message } from "@/lib/types";

const HEARTBEAT_MS = 20_000;

/**
 * Server-sent events for a live message list: one "snapshot" with the history,
 * then a "message" per added or changed message, until the client disconnects.
 */
export function messageStream(req: Request, subscribe: (listener: MessageListener) => () => void): Response {
  const encoder = new TextEncoder();

  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup();
        }
      };

      const unsubscribe = subscribe((messages: Message[], initial: boolean) => {
        if (initial) send("snapshot", messages);
        else for (const m of messages) send("message", m);
      });
      const heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(`: ping\n\n`));
      }, HEARTBEAT_MS);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
