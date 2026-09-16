"use client";

import { use, useCallback, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { MediaPreview } from "@/components/media-preview";
import { ProgressBar } from "@/components/progress-bar";
import { StatusBadge } from "@/components/status-badge";
import { jobKeys, useJob, useRun, useStartRun } from "@/lib/client/hooks";
import { useRunStream } from "@/lib/client/use-run-stream";
import type { EncodeResult, Stage } from "@/lib/types";

const PIPELINE: Stage[] = ["QUEUED", "DOWNLOADING", "PROBING", "TRANSCODING", "PACKAGING", "COMPLETED"];

function sourceInfo(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    const pieces = url.pathname.split("/").filter(Boolean);
    const fileName = pieces.at(-1) ? decodeURIComponent(pieces.at(-1)!) : "media";
    const extension = fileName.includes(".") ? fileName.split(".").at(-1)?.toUpperCase() : "MEDIA";
    return { protocol: url.protocol.replace(":", "").toUpperCase(), host: url.hostname, path: url.pathname || "/", fileName, extension: extension ?? "MEDIA" };
  } catch {
    return { protocol: "URL", host: "Unknown source", path: sourceUrl, fileName: "Media source", extension: "MEDIA" };
  }
}

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

  if (jobQuery.isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="shimmer h-24 rounded-2xl border border-[var(--line)]" />)}</div>;
  }

  if (jobQuery.isError || !job) {
    return (
      <div className="surface rounded-2xl px-6 py-8 text-sm text-rose-700 dark:text-rose-200">
        <p>Job not found or no longer available.</p>
        <Link href="/jobs" className="mt-3 inline-block text-xs font-semibold ink underline underline-offset-4">Back to jobs</Link>
      </div>
    );
  }

  const info = sourceInfo(job.sourceUrl);
  const showStart = job.status === "NEW" && !activeRunId;

  return (
    <div className="space-y-7">
      <Link href="/jobs" className="fade-up inline-flex items-center gap-2 text-xs font-medium faint hover:text-[var(--ink)]">
        ← All jobs
      </Link>

      <section className="surface overflow-hidden rounded-[30px] fade-up fade-up-delay-1">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(300px,44%)]">
          <div className="order-2 p-5 sm:p-7 lg:order-1">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">Encode job</p>
                <h1 className="break-words text-2xl font-semibold tracking-[-0.035em] ink sm:text-3xl">{job.title}</h1>
                <p className="mt-2 break-all text-xs leading-5 faint">{job.sourceUrl}</p>
              </div>
              <StatusBadge value={job.status} />
            </div>

            <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["Format", info.extension],
                ["Protocol", info.protocol],
                ["Source", info.host],
                ["Path", info.path],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-[var(--line)] bg-[var(--fill)] px-3 py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.13em] faint">{label}</p>
                  <p className="mt-1 truncate text-[11px] font-medium muted" title={value}>{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <CopyUrlButton sourceUrl={job.sourceUrl} />
              <a href={job.sourceUrl} target="_blank" rel="noreferrer" className="btn-ghost">
                Open source
                <span aria-hidden="true">↗</span>
              </a>
            </div>

            {showStart && (
              <button type="button" onClick={() => void handleStart()} disabled={startRun.isPending} className="btn-primary mt-7">
                {startRun.isPending && <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
                {startRun.isPending ? "Starting encode…" : "Start encode"}
              </button>
            )}
          </div>

          <div className="order-1 p-2 lg:order-2 lg:p-3">
            <MediaPreview sourceUrl={job.sourceUrl} />
          </div>
        </div>
      </section>

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

function CopyUrlButton({ sourceUrl }: { sourceUrl: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(sourceUrl).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        });
      }}
      className="btn-ghost"
    >
      {copied ? "Copied" : "Copy source"}
      <span aria-hidden="true">{copied ? "✓" : "⧉"}</span>
    </button>
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
  const encodeFailed = liveStage === "FAILED" || (stream.done && jobStatus === "FAILED");
  const encoding = !stream.done && liveStage !== "FAILED" && !stream.connectionError;
  const errorText = stream.error ?? runQuery.data?.error;
  const result = runQuery.data?.result;
  const activeIndex = liveStage ? PIPELINE.indexOf(liveStage) : -1;

  return (
    <section className="space-y-4 fade-up fade-up-delay-2">
      <div className="surface rounded-[28px] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] faint">Run</span>
              <span className="font-mono text-[10px] faint">{runId}</span>
              {stream.connected && !stream.done && <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-800 dark:text-emerald-200"><span className="size-1.5 rounded-full bg-emerald-500" />Live</span>}
            </div>
            <h2 className="mt-2 text-lg font-semibold tracking-tight ink">Processing pipeline</h2>
          </div>
          <span className="text-2xl font-semibold tabular-nums tracking-[-0.04em] ink">{stream.progressPct}<span className="text-sm faint">%</span></span>
        </div>

        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.13em] faint">
            <span>{liveStage ?? "Waiting for run"}</span>
            <span>{stream.connected ? "Streaming" : stream.done ? "Terminal" : "Connecting"}</span>
          </div>
          <ProgressBar value={stream.progressPct} failed={encodeFailed} />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {PIPELINE.map((stage, index) => {
            const isCurrent = stage === liveStage;
            const complete = activeIndex > index || liveStage === "COMPLETED";
            const failed = stage === "FAILED" || (encodeFailed && isCurrent);
            return (
              <div key={stage} className="relative">
                <div className={`rounded-2xl border px-2 py-3 text-center transition ${failed ? "border-rose-400/25 bg-rose-500/10" : isCurrent ? "border-indigo-400/30 bg-indigo-500/10" : complete ? "border-emerald-400/25 bg-emerald-500/10" : "border-[var(--line)] bg-[var(--fill)]"}`}>
                  <div className={`mx-auto mb-2 grid size-6 place-items-center rounded-full text-[10px] font-bold ${failed ? "bg-rose-500/15 text-rose-700 dark:text-rose-200" : isCurrent ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-200" : complete ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200" : "bg-[var(--fill-strong)] faint"}`}>
                    {failed ? "!" : complete ? "✓" : index + 1}
                  </div>
                  <p className="truncate text-[9px] font-semibold uppercase tracking-[0.08em] muted">{stage}</p>
                </div>
              </div>
            );
          })}
        </div>

        {stream.log.length > 0 && (
          <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--line)]" style={{ background: "var(--log-bg)", color: "var(--log-ink)" }}>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
              <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/40">Live log</span>
              <span className="font-mono text-[9px] text-white/30">{stream.log.length} events</span>
            </div>
            <pre className="max-h-56 overflow-auto px-4 py-3 font-mono text-[11px] leading-6 text-[var(--log-ink)]">{stream.log.join("\n")}</pre>
          </div>
        )}
      </div>

      {stream.connectionError && (
        <div className="surface rounded-2xl px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-200">!</span>
            <div className="flex-1"><p className="text-sm font-semibold ink">{stream.connectionError}</p><p className="mt-1 text-xs leading-5 muted">Reconnects the same run and preserves its progress. This is not an encode retry.</p></div>
            <button type="button" onClick={stream.reconnect} className="btn-ghost">Reconnect</button>
          </div>
        </div>
      )}

      {errorText && encodeFailed && !encoding && (
        <div className="rounded-[24px] border border-rose-400/25 bg-rose-500/10 px-5 py-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-rose-500/15 text-rose-700 dark:text-rose-200">×</span>
            <div className="flex-1"><h3 className="text-sm font-semibold text-rose-800 dark:text-rose-100">Encode failed</h3><p className="mt-1 text-sm leading-6 text-rose-700/80 dark:text-rose-100/70">{errorText}</p><p className="mt-2 text-[10px] uppercase tracking-[0.12em] faint">The failed run stays unchanged</p></div>
          </div>
          <button type="button" onClick={onRetry} disabled={starting} className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-rose-600 px-4 text-[11px] font-semibold text-white hover:bg-rose-500 disabled:opacity-60">{starting && <span className="size-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />}{starting ? "Starting new run…" : "Retry encode"}</button>
        </div>
      )}

      {result && <Results result={result} />}
    </section>
  );
}

function Results({ result }: { result: EncodeResult }) {
  return (
    <section className="surface rounded-[28px] p-5 sm:p-6 fade-up">
      <div className="flex flex-col gap-2 border-b border-[var(--line)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Output ready</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] ink">Results</h2></div>
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200">Duration {formatDuration(result.durationSec)}</div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--line)]">
        <div className="grid grid-cols-[.8fr_1.2fr_1fr] border-b border-[var(--line)] bg-[var(--fill)] px-4 py-2.5 text-[9px] font-semibold uppercase tracking-[0.13em] faint"><span>Label</span><span>Resolution</span><span>Size</span></div>
        {result.renditions.map((r) => <div key={r.label} className="grid grid-cols-[.8fr_1.2fr_1fr] border-b border-[var(--line)] px-4 py-3.5 text-xs last:border-b-0"><span className="font-semibold ink">{r.label}</span><span className="tabular-nums muted">{r.width}×{r.height}</span><span className="tabular-nums muted">{r.sizeMb.toFixed(1)} MB</span></div>)}
      </div>

      <div className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--fill)] px-4 py-4"><div className="flex items-center gap-2"><span className="text-[9px] font-semibold uppercase tracking-[0.13em] faint">Warnings</span><span className="h-px flex-1 bg-[var(--line)]" /></div>{result.warnings.length === 0 ? <p className="mt-2 text-xs muted">None</p> : <ul className="mt-2 space-y-1 text-xs text-amber-800 dark:text-amber-200/80">{result.warnings.map((w) => <li key={w}>• {w}</li>)}</ul>}</div>
    </section>
  );
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
