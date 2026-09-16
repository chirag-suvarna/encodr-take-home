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
    return <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="shimmer h-24 rounded-2xl border border-white/8" />)}</div>;
  }

  if (jobQuery.isError || !job) {
    return (
      <div className="surface rounded-2xl px-6 py-8 text-sm text-rose-200">
        <p>Job not found or no longer available.</p>
        <Link href="/jobs" className="mt-3 inline-block text-xs font-semibold text-white underline underline-offset-4">Back to jobs</Link>
      </div>
    );
  }

  const info = sourceInfo(job.sourceUrl);
  const showStart = job.status === "NEW" && !activeRunId;

  return (
    <div className="space-y-7">
      <Link href="/jobs" className="fade-up inline-flex items-center gap-2 text-xs font-medium text-white/35 hover:text-white/75">
        <span className="transition-transform group-hover:-translate-x-0.5">←</span> All jobs
      </Link>

      <section className="surface overflow-hidden rounded-[30px] fade-up fade-up-delay-1">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(300px,44%)]">
          <div className="order-2 p-5 sm:p-7 lg:order-1">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300/65">Encode job</p>
                <h1 className="break-words text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">{job.title}</h1>
                <p className="mt-2 break-all text-xs leading-5 text-white/30">{job.sourceUrl}</p>
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
                <div key={label} className="rounded-2xl border border-white/8 bg-white/[.025] px-3 py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-white/25">{label}</p>
                  <p className="mt-1 truncate text-[11px] font-medium text-white/65" title={value}>{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <CopyUrlButton sourceUrl={job.sourceUrl} />
              <a href={job.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[.03] px-3 text-[11px] font-semibold text-white/55 hover:bg-white/7 hover:text-white">
                Open source
                <span aria-hidden="true">↗</span>
              </a>
            </div>

            {showStart && (
              <button type="button" onClick={() => void handleStart()} disabled={startRun.isPending} className="group relative mt-7 inline-flex h-11 items-center gap-2 overflow-hidden rounded-2xl bg-[linear-gradient(100deg,#6656ff,#7c69ff_50%,#2fcfff)] px-5 text-xs font-semibold text-white shadow-[0_12px_30px_rgba(103,89,255,.25)] hover:shadow-[0_16px_40px_rgba(103,89,255,.34)] disabled:cursor-not-allowed disabled:opacity-60">
                {startRun.isPending && <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
                {startRun.isPending ? "Starting encode…" : "Start encode"}
                <span className="text-white/55 transition-transform group-hover:translate-x-0.5">→</span>
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
      className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[.03] px-3 text-[11px] font-semibold text-white/55 hover:bg-white/7 hover:text-white"
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
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">Run</span>
              <span className="font-mono text-[10px] text-white/25">{runId}</span>
              {stream.connected && !stream.done && <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-400/7 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-200"><span className="size-1.5 rounded-full bg-emerald-300" />Live</span>}
            </div>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-white">Processing pipeline</h2>
          </div>
          <span className="text-2xl font-semibold tabular-nums tracking-[-0.04em] text-white">{stream.progressPct}<span className="text-sm text-white/30">%</span></span>
        </div>

        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.13em] text-white/25">
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
                <div className={`rounded-2xl border px-2 py-3 text-center transition ${failed ? "border-rose-400/20 bg-rose-400/7" : isCurrent ? "border-violet-400/25 bg-violet-400/9" : complete ? "border-emerald-400/15 bg-emerald-400/6" : "border-white/7 bg-white/[.018]"}`}>
                  <div className={`mx-auto mb-2 grid size-6 place-items-center rounded-full text-[10px] font-bold ${failed ? "bg-rose-400/15 text-rose-200" : isCurrent ? "bg-violet-400/15 text-violet-200" : complete ? "bg-emerald-400/12 text-emerald-200" : "bg-white/6 text-white/25"}`}>
                    {failed ? "!" : complete ? "✓" : index + 1}
                  </div>
                  <p className="truncate text-[9px] font-semibold uppercase tracking-[0.08em] text-white/45">{stage}</p>
                </div>
              </div>
            );
          })}
        </div>

        {stream.log.length > 0 && (
          <div className="mt-5 overflow-hidden rounded-2xl border border-white/8 bg-black/25">
            <div className="flex items-center justify-between border-b border-white/7 px-4 py-2.5">
              <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/30">Live log</span>
              <span className="font-mono text-[9px] text-white/20">{stream.log.length} events</span>
            </div>
            <pre className="max-h-56 overflow-auto px-4 py-3 font-mono text-[11px] leading-6 text-white/55">{stream.log.join("\n")}</pre>
          </div>
        )}
      </div>

      {stream.connectionError && (
        <div className="surface rounded-2xl border-amber-300/10 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-amber-400/10 text-amber-200">!</span>
            <div className="flex-1"><p className="text-sm font-semibold text-white">{stream.connectionError}</p><p className="mt-1 text-xs leading-5 text-white/35">Reconnects the same run and preserves its progress. This is not an encode retry.</p></div>
            <button type="button" onClick={stream.reconnect} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-semibold text-white/70 hover:bg-white/8 hover:text-white">Reconnect</button>
          </div>
        </div>
      )}

      {errorText && encodeFailed && !encoding && (
        <div className="rounded-[24px] border border-rose-400/15 bg-[linear-gradient(135deg,rgba(244,63,94,.1),rgba(244,63,94,.035))] px-5 py-5 shadow-[0_20px_70px_rgba(244,63,94,.05)]">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-rose-400/12 text-rose-200">×</span>
            <div className="flex-1"><h3 className="text-sm font-semibold text-rose-100">Encode failed</h3><p className="mt-1 text-sm leading-6 text-rose-100/60">{errorText}</p><p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-rose-200/35">The failed run stays unchanged</p></div>
          </div>
          <button type="button" onClick={onRetry} disabled={starting} className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-rose-500 px-4 text-[11px] font-semibold text-white shadow-[0_10px_24px_rgba(244,63,94,.18)] hover:bg-rose-400 disabled:opacity-60">{starting && <span className="size-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />}{starting ? "Starting new run…" : "Retry encode"} →</button>
        </div>
      )}

      {result && <Results result={result} />}
    </section>
  );
}

function Results({ result }: { result: EncodeResult }) {
  return (
    <section className="surface rounded-[28px] p-5 sm:p-6 fade-up">
      <div className="flex flex-col gap-2 border-b border-white/8 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300/65">Output ready</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-white">Results</h2></div>
        <div className="rounded-xl border border-emerald-400/12 bg-emerald-400/6 px-3 py-2 text-xs text-emerald-200">Duration {formatDuration(result.durationSec)}</div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-white/8">
        <div className="grid grid-cols-[.8fr_1.2fr_1fr] border-b border-white/8 bg-white/[.025] px-4 py-2.5 text-[9px] font-semibold uppercase tracking-[0.13em] text-white/25"><span>Label</span><span>Resolution</span><span>Size</span></div>
        {result.renditions.map((r) => <div key={r.label} className="grid grid-cols-[.8fr_1.2fr_1fr] border-b border-white/7 px-4 py-3.5 text-xs last:border-b-0"><span className="font-semibold text-white">{r.label}</span><span className="tabular-nums text-white/55">{r.width}×{r.height}</span><span className="tabular-nums text-white/55">{r.sizeMb.toFixed(1)} MB</span></div>)}
      </div>

      <div className="mt-5 rounded-2xl border border-white/8 bg-white/[.018] px-4 py-4"><div className="flex items-center gap-2"><span className="text-[9px] font-semibold uppercase tracking-[0.13em] text-white/25">Warnings</span><span className="h-px flex-1 bg-white/7" /></div>{result.warnings.length === 0 ? <p className="mt-2 text-xs text-white/35">No warnings reported.</p> : <ul className="mt-2 space-y-1 text-xs text-amber-200/75">{result.warnings.map((w) => <li key={w}>• {w}</li>)}</ul>}</div>
    </section>
  );
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
