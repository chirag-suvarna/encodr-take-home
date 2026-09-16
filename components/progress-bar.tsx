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
          "h-full w-full origin-left rounded-full",
          failed
            ? "bg-[linear-gradient(90deg,#fb7185,#ef4444)]"
            : "bg-[linear-gradient(90deg,var(--accent),var(--accent-2))]",
        )}
        style={{ transform: `scaleX(${pct / 100})` }}
      />
    </div>
  );
}
