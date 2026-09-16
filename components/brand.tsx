import Link from "next/link";

export function Brand({ href = "/jobs", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5" aria-label="Encodr home">
      <BrandMark />
      <span className={compact ? "sr-only" : "text-[15px] font-semibold tracking-[-0.02em] text-white"}>
        Encodr
      </span>
    </Link>
  );
}

export function BrandMark() {
  return (
    <span className="relative grid size-8 place-items-center overflow-hidden rounded-[10px] border border-white/12 bg-[linear-gradient(145deg,#8b7cff,#5a4bdf)] shadow-[0_8px_24px_rgba(124,108,255,.28)] transition-transform duration-200 group-hover:scale-[1.04]">
      <svg viewBox="0 0 32 32" className="size-5 text-white" fill="none" aria-hidden="true">
        <rect x="6" y="7" width="20" height="18" rx="3.5" fill="currentColor" opacity=".96" />
        <path d="M9 10.5h3v3H9zM14.5 10.5h3v3h-3zM20 10.5h3v3h-3z" fill="#6758e6" />
        <path d="M9.5 18h13" stroke="#6758e6" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 21.5h8" stroke="#6758e6" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="absolute inset-x-1.5 bottom-0.5 h-px bg-white/50" />
    </span>
  );
}
