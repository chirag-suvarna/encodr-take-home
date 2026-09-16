import { clsx } from "clsx";

export function ProgressBar({ value, failed }: { value: number; failed?: boolean }) {
  const pct = Math.min(100, Math.max(0, value));

  return (
    <div
      className="relative h-2.5 w-full overflow-hidden rounded-full border border-[var(--line)] bg-[var(--fill)]"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <div
        className={clsx(
          "relative h-full overflow-hidden rounded-full transition-[width] duration-500 ease-out",
          failed
            ? "bg-[linear-gradient(90deg,#fb7185,#ef4444)]"
            : "bg-[linear-gradient(90deg,var(--accent),var(--accent-2))]",
        )}
        style={{ width: `${pct}%` }}
      >
        {!failed && <span className="absolute inset-0 animate-[shimmer_1.8s_linear_infinite] bg-[linear-gradient(110deg,transparent,rgba(255,255,255,.3),transparent)] bg-[length:200%_100%]" />}
      </div>
    </div>
  );
}
