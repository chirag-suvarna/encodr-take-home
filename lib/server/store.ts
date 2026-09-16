import { randomUUID } from "node:crypto";
import {
  type EncodeResult,
  type EncodeRun,
  type Job,
  type JobStatus,
  type RunEvent,
  type Stage,
} from "@/lib/types";

// In-memory store. Maps live on globalThis so Next route bundles share one copy.
// Run progress is a pure function of elapsed time — no real transcoder.

interface RunRecord {
  id: string;
  jobId: string;
  sourceUrl: string;
  startedAt: number; // epoch ms
}

// Next may evaluate this module more than once (route bundles / HMR). Keep the Maps on
// globalThis so every handler shares the same in-memory store.
const globalStore = globalThis as typeof globalThis & {
  __encodrJobs?: Map<string, Job>;
  __encodrRuns?: Map<string, RunRecord>;
};
const jobs = (globalStore.__encodrJobs ??= new Map<string, Job>());
const runs = (globalStore.__encodrRuns ??= new Map<string, RunRecord>());

/** The "magic" source URL that should always fail partway, so reviewers can see error handling. */
export const FAIL_URL = "https://cdn.example.com/videos/corrupt.mp4";

export const TOTAL_MS = 30_000;
/** End of PROBING (2+6+4s). Fail URL never enters TRANSCODING. */
export const FAIL_AFTER_MS = 12_000;

interface StageWindow {
  stage: Stage;
  durationMs: number;
  startPct: number;
  endPct: number;
}

const WINDOWS: StageWindow[] = [
  { stage: "QUEUED", durationMs: 2_000, startPct: 0, endPct: 5 },
  { stage: "DOWNLOADING", durationMs: 6_000, startPct: 5, endPct: 25 },
  { stage: "PROBING", durationMs: 4_000, startPct: 25, endPct: 40 },
  { stage: "TRANSCODING", durationMs: 12_000, startPct: 40, endPct: 85 },
  { stage: "PACKAGING", durationMs: 6_000, startPct: 85, endPct: 99 },
];

const STAGE_MESSAGE: Record<Stage, string> = {
  QUEUED: "Waiting to start",
  DOWNLOADING: "Fetching source media",
  PROBING: "Inspecting streams",
  TRANSCODING: "Encoding renditions",
  PACKAGING: "Packaging outputs",
  COMPLETED: "Encode finished",
  FAILED: "Source media is corrupt or unreadable.",
};

function lerpPct(start: number, end: number, t: number): number {
  return Math.round(start + (end - start) * Math.min(1, Math.max(0, t)));
}

function progressAt(elapsedMs: number): { stage: Stage; progressPct: number } {
  let cursor = 0;
  for (const window of WINDOWS) {
    const end = cursor + window.durationMs;
    if (elapsedMs < end) {
      const t = window.durationMs === 0 ? 1 : (elapsedMs - cursor) / window.durationMs;
      return { stage: window.stage, progressPct: lerpPct(window.startPct, window.endPct, t) };
    }
    cursor = end;
  }
  return { stage: "PACKAGING", progressPct: 99 };
}

function completedResult(sourceUrl: string): EncodeResult {
  return {
    durationSec: 120 + (sourceUrl.length % 90),
    renditions: [
      { label: "1080p", width: 1920, height: 1080, sizeMb: 42.1 },
      { label: "720p", width: 1280, height: 720, sizeMb: 18.4 },
      { label: "480p", width: 854, height: 480, sizeMb: 8.2 },
    ],
    warnings: [],
  };
}

export function computeRun(record: RunRecord, now: number = Date.now()): EncodeRun {
  const elapsed = Math.max(0, now - record.startedAt);
  const base = { id: record.id, jobId: record.jobId };

  if (record.sourceUrl === FAIL_URL && elapsed >= FAIL_AFTER_MS) {
    const atFail = progressAt(FAIL_AFTER_MS - 1);
    return {
      ...base,
      stage: "FAILED",
      progressPct: atFail.progressPct,
      error: "Source media is corrupt or unreadable.",
    };
  }

  if (elapsed >= TOTAL_MS) {
    return {
      ...base,
      stage: "COMPLETED",
      progressPct: 100,
      result: completedResult(record.sourceUrl),
    };
  }

  const at = progressAt(elapsed);
  return { ...base, stage: at.stage, progressPct: at.progressPct };
}

export function toRunEvent(run: EncodeRun): RunEvent {
  return {
    stage: run.stage,
    progressPct: run.progressPct,
    message: run.error ?? STAGE_MESSAGE[run.stage],
    ...(run.error ? { error: run.error } : {}),
  };
}

function statusFromRun(run: EncodeRun): JobStatus {
  if (run.stage === "FAILED") return "FAILED";
  if (run.stage === "COMPLETED") return "COMPLETED";
  return "RUNNING";
}

function withDerivedStatus(job: Job, now: number = Date.now()): Job {
  if (!job.latestRunId) return job;
  const run = getRun(job.latestRunId, now);
  if (!run) return job;
  return { ...job, status: statusFromRun(run) };
}

// --- job/run CRUD (provided) ---

export function listJobs(): Job[] {
  return [...jobs.values()]
    .map((job) => withDerivedStatus(job))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getJob(id: string): Job | null {
  const job = jobs.get(id);
  return job ? withDerivedStatus(job) : null;
}

export function createJob(input: { sourceUrl: string; title?: string }): Job {
  const id = `j_${randomUUID().slice(0, 8)}`;
  const sourceUrl = input.sourceUrl.trim();
  const job: Job = {
    id,
    title: input.title?.trim() || deriveTitle(sourceUrl),
    sourceUrl,
    status: "NEW",
    createdAt: new Date().toISOString(),
  };
  jobs.set(id, job);
  return job;
}

function deriveTitle(sourceUrl: string): string {
  try {
    const path = new URL(sourceUrl).pathname.replace(/\/+$/, "");
    const last = path.split("/").filter(Boolean).pop();
    return last ? decodeURIComponent(last) : "Untitled encode";
  } catch {
    return "Untitled encode";
  }
}

/** Always a new record. Retry does not rewrite a FAILED run — it starts another. */
export function startRun(jobId: string): RunRecord | null {
  const job = jobs.get(jobId);
  if (!job) return null;
  const record: RunRecord = {
    id: `r_${randomUUID().slice(0, 8)}`,
    jobId,
    sourceUrl: job.sourceUrl,
    startedAt: Date.now(),
  };
  runs.set(record.id, record);
  job.latestRunId = record.id;
  return record;
}

export function getRunRecord(id: string): RunRecord | null {
  return runs.get(id) ?? null;
}

export function getRun(id: string, now: number = Date.now()): EncodeRun | null {
  const record = runs.get(id);
  return record ? computeRun(record, now) : null;
}

/** Clears in-memory jobs/runs. Used by tests so cases don't leak state. */
export function resetStore() {
  jobs.clear();
  runs.clear();
}

export type { RunRecord };
