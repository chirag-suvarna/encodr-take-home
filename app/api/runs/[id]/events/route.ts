import { isTerminalStage } from "@/lib/types";
import { error, withAuth } from "@/lib/server/http";
import { getRun, getRunRecord, toRunEvent } from "@/lib/server/store";

export const dynamic = "force-dynamic";

function resumeSeq(req: Request): number {
  const raw = req.headers.get("last-event-id");
  const n = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await ctx.params;
    if (!getRunRecord(id)) return error(404, "Run not found");

    const encoder = new TextEncoder();
    let timer: ReturnType<typeof setInterval> | undefined;
    let last = "";
    let stopped = false;
    let seq = resumeSeq(req);

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

        const enqueue = (payload: string) => {
          seq += 1;
          controller.enqueue(encoder.encode(`id: ${seq}\ndata: ${payload}\n\n`));
        };

        const tick = (force: boolean) => {
          if (stopped) return;
          const run = getRun(id);
          if (!run) {
            stop();
            return;
          }
          const payload = JSON.stringify(toRunEvent(run));
          if (force || payload !== last) {
            last = payload;
            try {
              enqueue(payload);
            } catch {
              stop();
              return;
            }
          }
          if (isTerminalStage(run.stage)) stop();
        };

        // Always emit the current snapshot first so a Last-Event-ID reconnect resumes
        // from computeRun(now), not a stored event log.
        tick(true);
        if (!stopped) timer = setInterval(() => tick(false), 250);
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
