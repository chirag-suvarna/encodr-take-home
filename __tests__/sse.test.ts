import { beforeEach, describe, expect, it } from "vitest";
import { GET as streamRun } from "@/app/api/runs/[id]/events/route";
import { issueAccessToken } from "@/lib/server/auth";
import { createJob, FAIL_AFTER_MS, FAIL_URL, resetStore, startRun, TOTAL_MS } from "@/lib/server/store";

beforeEach(() => {
  resetStore();
});

function authHeaders() {
  return { authorization: `Bearer ${issueAccessToken("u_demo")}` };
}

function eventsReq(id: string, init: RequestInit = {}) {
  return streamRun(new Request(`http://localhost/api/runs/${id}/events`, { ...init }), {
    params: Promise.resolve({ id }),
  });
}

async function readSse(res: Response) {
  const text = await res.text();
  const events = [...text.matchAll(/^data: (.+)$/gm)].map((m) => JSON.parse(m[1]) as {
    stage: string;
    progressPct: number;
    message: string;
    error?: string;
  });
  return events;
}

describe("GET /api/runs/:id/events", () => {
  it("returns 401 without a token", async () => {
    const res = await eventsReq("r_x");
    expect(res.status).toBe(401);
  });

  it("returns 404 for an unknown run", async () => {
    const res = await eventsReq("r_missing", { headers: authHeaders() });
    expect(res.status).toBe(404);
  });

  it("streams COMPLETED then closes for a finished run", async () => {
    const job = createJob({ sourceUrl: "https://cdn.example.com/videos/movie.mp4" });
    const rec = startRun(job.id)!;
    rec.startedAt = Date.now() - TOTAL_MS;

    const res = await eventsReq(rec.id, { headers: authHeaders() });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);

    const events = await readSse(res);
    expect(events.length).toBeGreaterThan(0);
    expect(events[events.length - 1]?.stage).toBe("COMPLETED");
    expect(events[events.length - 1]?.message).toBeTruthy();
  });

  it("streams FAILED for the corrupt URL after probing", async () => {
    const job = createJob({ sourceUrl: FAIL_URL });
    const rec = startRun(job.id)!;
    rec.startedAt = Date.now() - FAIL_AFTER_MS;

    const res = await eventsReq(rec.id, { headers: authHeaders() });
    const events = await readSse(res);
    expect(events.at(-1)?.stage).toBe("FAILED");
    expect(events.at(-1)?.error).toMatch(/corrupt/i);
  });

  it("tags events with ids and resumes from Last-Event-ID with the current snapshot", async () => {
    const job = createJob({ sourceUrl: "https://cdn.example.com/videos/movie.mp4" });
    const rec = startRun(job.id)!;
    rec.startedAt = Date.now() - TOTAL_MS;

    const res = await eventsReq(rec.id, {
      headers: { ...authHeaders(), "last-event-id": "5" },
    });
    const text = await res.text();
    expect(text).toMatch(/^id: 6$/m);
    expect(text).toMatch(/"stage":"COMPLETED"/);
  });

  it("stops the timer when the client aborts", async () => {
    const job = createJob({ sourceUrl: "https://cdn.example.com/videos/movie.mp4" });
    const rec = startRun(job.id)!;
    const ac = new AbortController();
    const res = await eventsReq(rec.id, { headers: authHeaders(), signal: ac.signal });
    expect(res.status).toBe(200);
    const reader = res.body!.getReader();
    ac.abort();
    await reader.cancel().catch(() => undefined);
  });
});
