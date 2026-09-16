import { isTerminalStage } from "@/lib/types";
import { error, withAuth } from "@/lib/server/http";
import { getRun, getRunRecord, toRunEvent } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await ctx.params;
    if (!getRunRecord(id)) return error(404, "Run not found");

    const encoder = new TextEncoder();
    let timer: ReturnType<typeof setInterval> | undefined;
    let last = "";
    let stopped = false;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const stop = () => {
          if (stopped) return;
          stopped = true;
          if (timer !== undefined) {
            clearInterval(timer);
            timer = undefined;
          }
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        };

        const tick = () => {
          if (stopped) return;
          const run = getRun(id);
          if (!run) {
            stop();
            return;
          }
          const payload = JSON.stringify(toRunEvent(run));
          if (payload !== last) {
            last = payload;
            try {
              controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
            } catch {
              stop();
              return;
            }
          }
          if (isTerminalStage(run.stage)) stop();
        };

        tick();
        if (!stopped) timer = setInterval(tick, 250);
        req.signal.addEventListener("abort", stop, { once: true });
      },
      cancel() {
        stopped = true;
        if (timer !== undefined) {
          clearInterval(timer);
          timer = undefined;
        }
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
  });
}
