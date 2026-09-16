import { clsx } from "clsx";
import type { JobStatus, Stage } from "@/lib/types";

const STYLES: Record<string, string> = {
  NEW: "border-white/10 bg-white/6 text-white/65",
  RUNNING: "border-violet-400/20 bg-violet-400/10 text-violet-200",
  COMPLETED: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  FAILED: "border-rose-400/20 bg-rose-400/10 text-rose-300",
  QUEUED: "border-white/10 bg-white/6 text-white/65",
  DOWNLOADING: "border-sky-400/20 bg-sky-400/10 text-sky-200",
  PROBING: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200",
  TRANSCODING: "border-violet-400/20 bg-violet-400/10 text-violet-200",
  PACKAGING: "border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-200",
};

const DOTS: Record<string, string> = {
  NEW: "bg-white/45",
  RUNNING: "bg-violet-300",
  COMPLETED: "bg-emerald-300",
  FAILED: "bg-rose-300",
  QUEUED: "bg-white/45",
  DOWNLOADING: "bg-sky-300",
  PROBING: "bg-cyan-300",
  TRANSCODING: "bg-violet-300",
  PACKAGING: "bg-fuchsia-300",
};

export function StatusBadge({ value }: { value: JobStatus | Stage }) {
  const animated = value === "RUNNING" || value === "DOWNLOADING" || value === "PROBING" || value === "TRANSCODING" || value === "PACKAGING" || value === "QUEUED";

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.11em] backdrop-blur-sm",
        STYLES[value] ?? "border-white/10 bg-white/6 text-white/65",
      )}
    >
      <span className={clsx("size-1.5 rounded-full", DOTS[value] ?? "bg-white/45", animated && "pulse-dot")} />
      {value}
    </span>
  );
}
