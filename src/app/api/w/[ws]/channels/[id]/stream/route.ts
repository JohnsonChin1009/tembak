import { getSessionUser } from "@/lib/auth/session";
import { getStore } from "@/lib/store";

export const maxDuration = 300;

const HEARTBEAT_MS = 20_000;

export async function GET(req: Request, ctx: RouteContext<"/api/channels/[id]/stream">) {
  if (!(await getSessionUser())) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  const { id: channelId } = await ctx.params;
  const store = await getStore();
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

      const unsubscribe = store.subscribeMessages(channelId, (messages, initial) => {
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
