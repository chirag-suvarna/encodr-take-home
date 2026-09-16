import { beforeEach, describe, expect, it } from "vitest";
import { GET as getJobById } from "@/app/api/jobs/[id]/route";
import { POST as createJobRoute } from "@/app/api/jobs/route";
import { GET as getRunRoute } from "@/app/api/runs/[id]/route";
import { POST as startRunRoute } from "@/app/api/runs/route";
import { issueAccessToken } from "@/lib/server/auth";
import { ACTIVE_STAGES, type Stage } from "@/lib/types";
import {
  computeRun,
  createJob,
  FAIL_AFTER_MS,
  FAIL_URL,
  getJob,
  resetStore,
  startRun,
  toRunEvent,
  TOTAL_MS,
  type RunRecord,
} from "@/lib/server/store";

beforeEach(() => {
  resetStore();
});

function authHeaders() {
  return { authorization: `Bearer ${issueAccessToken("u_demo")}` };
}

function record(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: "r_test",
    jobId: "j_test",
    sourceUrl: "https://cdn.example.com/videos/movie.mp4",
    startedAt: 1_000_000,
    ...overrides,
  };
}

describe("computeRun", () => {
  it("starts QUEUED near 0%", () => {
    const run = computeRun(record(), 1_000_000);
    expect(run.stage).toBe("QUEUED");
    expect(run.progressPct).toBe(0);
    expect(run.result).toBeUndefined();
    expect(run.error).toBeUndefined();
  });

  it("is TRANSCODING around 15s", () => {
    const run = computeRun(record(), 1_000_000 + 15_000);
    expect(run.stage).toBe("TRANSCODING");
    expect(run.progressPct).toBeGreaterThan(40);
    expect(run.progressPct).toBeLessThan(85);
  });

  it("completes after 30s with a result", () => {
    const run = computeRun(record(), 1_000_000 + TOTAL_MS);
    expect(run.stage).toBe("COMPLETED");
    expect(run.progressPct).toBe(100);
    expect(run.result?.renditions).toHaveLength(3);
    expect(run.error).toBeUndefined();
  });

  it("walks every active stage in order, then COMPLETED", () => {
    const order: Stage[] = [];
    for (let t = 0; t <= TOTAL_MS + 1_000; t += 1_000) {
      const run = computeRun(record(), 1_000_000 + t);
      const event = toRunEvent(run);
      expect(event.message.length).toBeGreaterThan(0);
      expect(event.stage).toBe(run.stage);
      if (order[order.length - 1] !== run.stage) order.push(run.stage);
    }
    expect(order).toEqual([...ACTIVE_STAGES, "COMPLETED"]);
  });

  it("never goes backwards", () => {
    const rank = new Map<Stage, number>([
      ...ACTIVE_STAGES.map((s, i) => [s, i] as const),
      ["COMPLETED", ACTIVE_STAGES.length],
      ["FAILED", -1],
    ]);
    let prev = 0;
    for (let t = 0; t <= TOTAL_MS; t += 500) {
      const run = computeRun(record(), 1_000_000 + t);
      const r = rank.get(run.stage) ?? 0;
      expect(r).toBeGreaterThanOrEqual(prev);
      prev = r;
    }
  });

  it("fails the corrupt URL partway, not immediately", () => {
    const fail = record({ sourceUrl: FAIL_URL });
    const early = computeRun(fail, 1_000_000 + 10_000);
    expect(early.stage).toBe("PROBING");
    expect(early.error).toBeUndefined();

    const late = computeRun(fail, 1_000_000 + FAIL_AFTER_MS);
    expect(late.stage).toBe("FAILED");
    expect(late.error).toMatch(/corrupt/i);
    expect(late.result).toBeUndefined();
    expect(toRunEvent(late).message).toMatch(/corrupt/i);

    const order: Stage[] = [];
    for (let t = 0; t <= TOTAL_MS + 1_000; t += 1_000) {
      const stage = computeRun(fail, 1_000_000 + t).stage;
      if (order[order.length - 1] !== stage) order.push(stage);
    }
    expect(order).toEqual(["QUEUED", "DOWNLOADING", "PROBING", "FAILED"]);
  });
});

describe("run APIs", () => {
  async function createAndStart() {
    const created = await createJobRoute(
      new Request("http://localhost/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ sourceUrl: "https://cdn.example.com/videos/movie.mp4" }),
      }),
    );
    const job = await created.json();
    const started = await startRunRoute(
      new Request("http://localhost/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ jobId: job.id }),
      }),
    );
    return { job, started };
  }

  it("requires auth", async () => {
    const post = await startRunRoute(
      new Request("http://localhost/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId: "j_x" }),
      }),
    );
    expect(post.status).toBe(401);

    const get = await getRunRoute(new Request("http://localhost/api/runs/r_x"), {
      params: Promise.resolve({ id: "r_x" }),
    });
    expect(get.status).toBe(401);
  });

  it("returns 404 for an unknown job or run", async () => {
    const post = await startRunRoute(
      new Request("http://localhost/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ jobId: "j_missing" }),
      }),
    );
    expect(post.status).toBe(404);

    const get = await getRunRoute(
      new Request("http://localhost/api/runs/r_missing", { headers: authHeaders() }),
      { params: Promise.resolve({ id: "r_missing" }) },
    );
    expect(get.status).toBe(404);
  });

  it("starts a run and returns it; job status becomes RUNNING", async () => {
    const { job, started } = await createAndStart();
    expect(started.status).toBe(201);
    const { runId } = await started.json();
    expect(runId).toMatch(/^r_/);

    const got = await getRunRoute(
      new Request(`http://localhost/api/runs/${runId}`, { headers: authHeaders() }),
      { params: Promise.resolve({ id: runId }) },
    );
    expect(got.status).toBe(200);
    const run = await got.json();
    expect(run.jobId).toBe(job.id);
    expect(run.stage).toBe("QUEUED");

    const jobRes = await getJobById(
      new Request(`http://localhost/api/jobs/${job.id}`, { headers: authHeaders() }),
      { params: Promise.resolve({ id: job.id }) },
    );
    expect((await jobRes.json()).status).toBe("RUNNING");
  });
});

describe("job status from latest run", () => {
  it("is FAILED once the corrupt run has elapsed past the fail point", () => {
    const job = createJob({ sourceUrl: FAIL_URL });
    const rec = startRun(job.id)!;
    rec.startedAt = Date.now() - FAIL_AFTER_MS;
    expect(getJob(job.id)?.status).toBe("FAILED");
  });
});
