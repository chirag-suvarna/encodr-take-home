"use client";

import { useRef, useState } from "react";

function parseSource(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    const fileName = decodeURIComponent(parts.at(-1) ?? "media");
    const extension = fileName.includes(".") ? fileName.split(".").at(-1)?.toUpperCase() : "MEDIA";
    return { host: url.hostname, fileName, extension: extension ?? "MEDIA", secure: url.protocol === "https:" };
  } catch {
    return { host: "Unknown source", fileName: "Media source", extension: "MEDIA", secure: false };
  }
}

export function MediaPreview({
  sourceUrl,
  compact = false,
}: {
  sourceUrl: string;
  compact?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hovered, setHovered] = useState(false);
  const [failed, setFailed] = useState(false);
  const meta = parseSource(sourceUrl);

  async function handleEnter() {
    setHovered(true);
    const video = videoRef.current;
    if (!video || failed) return;
    video.preload = "metadata";
    video.load();
    try {
      await video.play();
    } catch {
      // Autoplay can be unavailable for a remote source; the preview still remains useful.
    }
  }

  function handleLeave() {
    setHovered(false);
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    try {
      video.currentTime = 0;
    } catch {
      // Ignore sources that don't expose seek state yet.
    }
  }

  return (
    <div
      tabIndex={0}
      className={`group relative overflow-hidden border border-[var(--line)] bg-[var(--bg-elevated)] ${
        compact ? "h-[78px] w-[132px] rounded-xl" : "aspect-video w-full rounded-2xl"
      }`}
      onMouseEnter={() => void handleEnter()}
      onMouseLeave={handleLeave}
      onFocus={() => void handleEnter()}
      onBlur={handleLeave}
    >
      {!failed && (
        <video
          ref={videoRef}
          src={sourceUrl}
          muted
          playsInline
          loop
          preload="none"
          onError={() => setFailed(true)}
          className={`absolute inset-0 h-full w-full object-cover transition duration-500 ${
            hovered ? "scale-105 opacity-95" : "scale-100 opacity-72"
          }`}
          aria-label={`Preview of ${meta.fileName}`}
        />
      )}

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(124,108,255,.35),transparent_38%),linear-gradient(135deg,rgba(9,9,12,.25),rgba(9,9,12,.92))]" />

      {failed && (
        <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_30%_20%,rgba(124,108,255,.25),transparent_44%),#0b0b0f]">
          <div className="grid size-11 place-items-center rounded-2xl border border-white/10 bg-white/7 shadow-lg">
            <svg viewBox="0 0 24 24" className="size-5 text-white/80" fill="none" aria-hidden="true">
              <path d="M8 5.8 18 12 8 18.2V5.8Z" fill="currentColor" />
            </svg>
          </div>
        </div>
      )}

      <div className={`absolute inset-x-0 bottom-0 p-3 ${compact ? "p-2.5" : "p-4"}`}>
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-medium text-white/95">{meta.fileName}</p>
            <p className="mt-0.5 truncate text-[10px] text-white/55">{meta.host}</p>
          </div>
          <span className="shrink-0 rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/65 backdrop-blur-sm">
            {meta.extension}
          </span>
        </div>
      </div>

      {!compact && (
        <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/25 px-2.5 py-1.5 text-[10px] text-white/70 backdrop-blur-md">
          <span className="size-1.5 rounded-full bg-white/70" />
          {meta.secure ? "Secure source" : "External source"}
        </div>
      )}
    </div>
  );
}
