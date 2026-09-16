"use client";

import { use, useCallback, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ProgressBar } from "@/components/progress-bar";
import { StatusBadge } from "@/components/status-badge";
import { jobKeys, useJob, useRun, useStartRun } from "@/lib/client/hooks";
import { useRunStream } from "@/lib/client/use-run-stream";
import type { EncodeResult } from "@/lib/types";

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const jobQuery = useJob(id);
  const startRun = useStartRun();
  const [startedRunId, setStartedRunId] = useState<string | null>(null);

  const job = jobQuery.data;
  const activeRunId = startedRunId ?? job?.latestRunId ?? null;

  const onTerminal = useCallback(() => {
    void jobQuery.refetch();
    void queryClient.invalidateQueries({ queryKey: jobKeys.all });
  }, [jobQuery, queryClient]);

  async function handleStart() {
    const { runId } = await startRun.mutateAsync(id);
    setStartedRunId(runId);
  }

  if (jobQuery.isLoading) return <p className="text-sm text-neutral-500">Loading job…</p>;
  if (jobQuery.isError || !job) {
    return (
      <div className="text-sm text-red-600">
        Job not found.{" "}
        <Link href="/jobs" className="underline">
          Back to jobs
        </Link>
      </div>
    );
  }

  const showStart = job.status === "NEW" && !activeRunId;

  return (
    <div className="space-y-6">
      <Link href="/jobs" className="text-sm text-neutral-500 hover:underline">
        ← All jobs
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">{job.title}</h1>
          <p className="truncate text-sm text-neutral-500">{job.sourceUrl}</p>
        </div>
        <StatusBadge value={job.status} />
      </div>

      {showStart && (
        <button
          type="button"
          onClick={() => void handleStart()}
          disabled={startRun.isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {startRun.isPending ? "Starting…" : "Start encode"}
        </button>
      )}

      {activeRunId && (
        <RunPanel
          key={activeRunId}
          runId={activeRunId}
          jobStatus={job.status}
          starting={startRun.isPending}
          onTerminal={onTerminal}
          onRetry={() => void handleStart()}
        />
      )}
    </div>
  );
}

function RunPanel({
  runId,
  jobStatus,
  starting,
  onTerminal,
  onRetry,
}: {
  runId: string;
  jobStatus: "NEW" | "RUNNING" | "COMPLETED" | "FAILED";
  starting: boolean;
  onTerminal: () => void;
  onRetry: () => void;
}) {
  const stream = useRunStream(runId, onTerminal);
  const snapshotReady = stream.done || jobStatus === "COMPLETED" || jobStatus === "FAILED";
  const runQuery = useRun(runId, snapshotReady);

  const liveStage = stream.stage;
  const failed = liveStage === "FAILED" || (stream.done && jobStatus === "FAILED");
  const encoding = !stream.done && liveStage !== "FAILED";
  const errorText = stream.error ?? runQuery.data?.error;
  const result = runQuery.data?.result;

  return (
    <>
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {liveStage && <StatusBadge value={liveStage} />}
            {stream.connected && !stream.done && (
              <span className="text-xs text-neutral-400">live</span>
            )}
          </div>
          <span className="text-sm tabular-nums text-neutral-600">{stream.progressPct}%</span>
        </div>
        <ProgressBar value={stream.progressPct} failed={failed} />

        {stream.log.length > 0 && (
          <pre className="max-h-56 overflow-auto rounded-md bg-neutral-950 px-3 py-2 font-mono text-xs leading-6 text-neutral-100">
            {stream.log.join("\n")}
          </pre>
        )}
      </section>

      {errorText && !encoding && (
        <div className="space-y-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{errorText}</p>
          <button
            type="button"
            onClick={onRetry}
            disabled={starting}
            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {starting ? "Retrying…" : "Retry"}
          </button>
        </div>
      )}

      {result && <Results result={result} />}
    </>
  );
}

function Results({ result }: { result: EncodeResult }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Results</h2>
      <p className="text-sm text-neutral-600">
        Duration: <span className="tabular-nums">{formatDuration(result.durationSec)}</span>
      </p>
      <div>
        <h3 className="mb-1 text-sm font-medium">Renditions</h3>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
              <th className="py-2 font-medium">Label</th>
              <th className="py-2 font-medium">Resolution</th>
              <th className="py-2 font-medium">Size</th>
            </tr>
          </thead>
          <tbody>
            {result.renditions.map((r) => (
              <tr key={r.label} className="border-b border-neutral-100">
                <td className="py-2">{r.label}</td>
                <td className="py-2 tabular-nums">
                  {r.width}×{r.height}
                </td>
                <td className="py-2 tabular-nums">{r.sizeMb.toFixed(1)} MB</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <h3 className="mb-1 text-sm font-medium">Warnings</h3>
        {result.warnings.length === 0 ? (
          <p className="text-sm text-neutral-500">None</p>
        ) : (
          <ul className="list-disc pl-5 text-sm text-amber-700">
            {result.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
