import { clsx } from "clsx";
import type { JobStatus, Stage } from "@/lib/types";

const STYLES: Record<string, string> = {
  NEW: "border-[var(--line)] bg-[var(--fill)] text-[var(--muted)]",
  RUNNING: "border-indigo-400/25 bg-indigo-500/10 text-indigo-700 dark:text-indigo-200",
  COMPLETED: "border-emerald-400/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  FAILED: "border-rose-400/25 bg-rose-500/10 text-rose-800 dark:text-rose-300",
  QUEUED: "border-[var(--line)] bg-[var(--fill)] text-[var(--muted)]",
  DOWNLOADING: "border-sky-400/25 bg-sky-500/10 text-sky-800 dark:text-sky-200",
  PROBING: "border-cyan-400/25 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200",
  TRANSCODING: "border-indigo-400/25 bg-indigo-500/10 text-indigo-700 dark:text-indigo-200",
  PACKAGING: "border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-800 dark:text-fuchsia-200",
};

const DOTS: Record<string, string> = {
  NEW: "bg-[var(--faint)]",
  RUNNING: "bg-indigo-500",
  COMPLETED: "bg-emerald-500",
  FAILED: "bg-rose-500",
  QUEUED: "bg-[var(--faint)]",
  DOWNLOADING: "bg-sky-500",
  PROBING: "bg-cyan-500",
  TRANSCODING: "bg-indigo-500",
  PACKAGING: "bg-fuchsia-500",
};

export function StatusBadge({ value }: { value: JobStatus | Stage }) {
  const animated = value === "RUNNING" || value === "DOWNLOADING" || value === "PROBING" || value === "TRANSCODING" || value === "PACKAGING" || value === "QUEUED";

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.11em] backdrop-blur-sm",
        STYLES[value] ?? "border-[var(--line)] bg-[var(--fill)] text-[var(--muted)]",
      )}
    >
      <span className={clsx("size-1.5 rounded-full", DOTS[value] ?? "bg-[var(--faint)]", animated && "pulse-dot")} />
      {value}
    </span>
  );
}
