"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MediaPreview } from "@/components/media-preview";
import { StatusBadge } from "@/components/status-badge";
import { ApiError } from "@/lib/client/api";
import { useCreateJob, useJobs } from "@/lib/client/hooks";
import { createJobSchema, type CreateJobInput } from "@/lib/schemas";
import type { Job } from "@/lib/types";

type StatusFilter = "ALL" | Job["status"];

function sourceMeta(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    const fileName = parts.at(-1) ? decodeURIComponent(parts.at(-1)!) : url.hostname;
    const extension = fileName.includes(".") ? fileName.split(".").at(-1)?.toUpperCase() : "MEDIA";
    return { host: url.hostname, fileName, extension: extension ?? "MEDIA" };
  } catch {
    return { host: "Unknown source", fileName: "Media source", extension: "MEDIA" };
  }
}

export default function JobsPage() {
  const jobs = useJobs();
  const createJob = useCreateJob();
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("ALL");

  const { register, handleSubmit, setError, reset, control, formState: { errors, isSubmitting } } = useForm<CreateJobInput>({
    resolver: zodResolver(createJobSchema),
    defaultValues: { sourceUrl: "", title: "" },
  });
  const sourceUrl = useWatch({ control, name: "sourceUrl" });

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (jobs.data ?? []).filter((job) => {
      const textMatch = !query || `${job.title} ${job.sourceUrl}`.toLowerCase().includes(query);
      return textMatch && (filter === "ALL" || job.status === filter);
    });
  }, [jobs.data, search, filter]);

  const counts = useMemo(() => {
    const all = jobs.data ?? [];
    return {
      total: all.length,
      running: all.filter((job) => job.status === "RUNNING").length,
      completed: all.filter((job) => job.status === "COMPLETED").length,
      failed: all.filter((job) => job.status === "FAILED").length,
    };
  }, [jobs.data]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await createJob.mutateAsync(values);
      reset();
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) {
        for (const [field, messages] of Object.entries(e.fieldErrors)) {
          const message = messages[0];
          if (message && (field === "sourceUrl" || field === "title")) setError(field, { type: "server", message });
        }
      } else {
        setFormError(e instanceof Error ? e.message : "Couldn’t create job");
      }
    }
  });

  return (
    <div className="space-y-9">
      <section className="fade-up">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">Encoding workspace</p>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] ink sm:text-4xl">
              Turn a media URL into <span className="gradient-text">ready-to-ship renditions.</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 muted">Submit a source, start a run, and watch the pipeline move live from ingest to packaging.</p>
          </div>
          <div className="surface shrink-0 rounded-2xl px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] faint">Jobs</p>
            <p className="mt-1 text-xl font-semibold tracking-tight ink">{counts.total}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Total", counts.total, "ink"],
            ["Running", counts.running, "text-indigo-600 dark:text-indigo-200"],
            ["Completed", counts.completed, "text-emerald-700 dark:text-emerald-200"],
            ["Failed", counts.failed, "text-rose-700 dark:text-rose-200"],
          ].map(([label, value, tone], index) => (
            <div key={label} className={`surface rounded-2xl px-4 py-3 fade-up fade-up-delay-${Math.min(index + 1, 3)}`}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] faint">{label}</p>
              <p className={`mt-1 text-xl font-semibold ${tone}`}>{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="surface overflow-hidden rounded-[28px] fade-up fade-up-delay-1">
        <div className="flex flex-col gap-2 border-b border-[var(--line)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-sm font-semibold ink">New encode job</h2>
            <p className="mt-1 text-xs muted">Paste a public media URL. Preview becomes active on hover.</p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-200"><span className="size-1.5 rounded-full bg-emerald-500" />Ready</span>
        </div>

        <form onSubmit={onSubmit} className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_250px]" noValidate>
          <div className="space-y-5">
            <div>
              <label htmlFor="sourceUrl" className="mb-2 flex items-center justify-between text-xs font-semibold muted"><span>Source URL</span><span className="font-normal faint">Required</span></label>
              <input id="sourceUrl" {...register("sourceUrl")} type="url" inputMode="url" placeholder="https://cdn.example.com/videos/movie.mp4" className="input-field" />
              {errors.sourceUrl && <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">{errors.sourceUrl.message}</p>}
            </div>
            <div>
              <label htmlFor="title" className="mb-2 flex items-center justify-between text-xs font-semibold muted"><span>Title</span><span className="font-normal faint">Optional · 80 max</span></label>
              <input id="title" {...register("title")} type="text" maxLength={80} placeholder="e.g. Product launch master" className="input-field" />
              {errors.title && <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">{errors.title.message}</p>}
            </div>
            {formError && <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200" role="alert">{formError}</div>}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-md text-xs leading-5 faint">Retrying a failed encode reuses this job and creates a new run; your source data stays unchanged.</p>
              <button type="submit" disabled={isSubmitting} className="btn-primary">
                <span className="inline-flex items-center gap-2">{isSubmitting && <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />}{isSubmitting ? "Creating…" : "Create job"}</span>
              </button>
            </div>
          </div>
          <div className="hidden lg:block">
            {sourceUrl ? <MediaPreview sourceUrl={sourceUrl} /> : <div className="flex aspect-video flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line)] bg-[var(--fill)] px-8 text-center"><div className="grid size-11 place-items-center rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)] text-indigo-500">✦</div><p className="mt-3 text-xs font-semibold muted">Source preview</p><p className="mt-1 text-[11px] leading-5 faint">Paste a URL to see source metadata and preview behavior.</p></div>}
          </div>
        </form>
      </section>

      <section className="fade-up fade-up-delay-2">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="text-lg font-semibold tracking-tight ink">Jobs</h2><p className="mt-1 text-xs faint">Search, filter, and jump back into a run.</p></div>
          <div className="flex gap-2">
            <input aria-label="Search jobs" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search jobs…" className="input-field h-10 text-xs sm:w-56" />
            <select aria-label="Filter jobs by status" value={filter} onChange={(e) => setFilter(e.target.value as StatusFilter)} className="input-field h-10 w-auto px-3 text-xs font-medium"><option value="ALL">All</option><option value="NEW">New</option><option value="RUNNING">Running</option><option value="COMPLETED">Completed</option><option value="FAILED">Failed</option></select>
          </div>
        </div>

        {jobs.isLoading && <div className="space-y-2" aria-busy="true">{[1, 2, 3].map((item) => <div key={item} className="shimmer h-24 rounded-2xl border border-[var(--line)]" />)}</div>}
        {jobs.isError && <div className="surface rounded-2xl px-5 py-5 text-sm text-rose-700 dark:text-rose-200">Couldn’t load jobs. <button onClick={() => jobs.refetch()} className="underline underline-offset-4">Try again</button></div>}
        {!jobs.isLoading && !jobs.isError && jobs.data?.length === 0 && <div className="surface rounded-[28px] border-dashed px-6 py-14 text-center"><div className="mx-auto grid size-14 place-items-center rounded-2xl border border-[var(--line)] bg-[var(--fill)] text-2xl text-indigo-500">✦</div><h3 className="mt-5 text-sm font-semibold ink">Your encode queue is empty</h3><p className="mx-auto mt-2 max-w-sm text-xs leading-5 faint">Create a job above and your source will appear here with live status and preview details.</p></div>}
        {!jobs.isLoading && !jobs.isError && jobs.data && jobs.data.length > 0 && filtered.length === 0 && <div className="surface rounded-2xl border-dashed px-6 py-10 text-center text-xs faint">No jobs match this search or filter.</div>}

        {filtered.length > 0 && <div className="space-y-2">{filtered.map((job, index) => {
          const pending = job.id.startsWith("optimistic-");
          const meta = sourceMeta(job.sourceUrl);
          const content = <><MediaPreview sourceUrl={job.sourceUrl} compact /><div className="min-w-0 flex-1 py-0.5"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold tracking-tight ink">{job.title}</p>{pending && <span className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-indigo-700 dark:text-indigo-200">Syncing</span>}</div><p className="mt-1 truncate text-[11px] faint">{job.sourceUrl}</p><div className="mt-2 flex flex-wrap items-center gap-2.5 text-[9px] font-medium uppercase tracking-[0.1em] faint"><span>{meta.host}</span><span className="size-0.5 rounded-full bg-[var(--faint)]" /><span>{meta.extension}</span></div></div><div className="flex shrink-0 items-center gap-3"><StatusBadge value={job.status} />{!pending && <span className="hidden size-8 place-items-center rounded-full border border-[var(--line)] bg-[var(--fill)] text-[var(--faint)] transition group-hover:text-[var(--ink)] sm:grid">→</span>}</div></>;
          return <div key={job.id} className={`fade-up fade-up-delay-${Math.min(index + 1, 3)}`}>{pending ? <div className="surface flex items-center gap-3 rounded-2xl px-2.5 py-2.5 opacity-65 sm:gap-4 sm:px-3">{content}</div> : <Link href={`/jobs/${job.id}`} className="group surface surface-hover flex items-center gap-3 rounded-2xl px-2.5 py-2.5 sm:gap-4 sm:px-3">{content}</Link>}</div>;
        })}</div>}
      </section>
    </div>
  );
}
