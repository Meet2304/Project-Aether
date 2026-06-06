"use client";

import { useCallback, useRef, useState } from "react";
import type { Clip } from "@/lib/types";
import { formatTime, formatTimePrecise } from "@/lib/clipUtils";

interface TimelineProps {
  duration: number;
  currentTime: number;
  /** Confirmed clips to render as regions. */
  clips: Clip[];
  /** A pending IN point (marked but not yet OUT). */
  pendingIn: number | null;
  /** Called continuously while dragging/seeking with the target time. */
  onSeek: (time: number) => void;
  /** Fired when the user grabs the scrubber (pause playback, etc.). */
  onScrubStart?: () => void;
  /** Fired when the user releases the scrubber. */
  onScrubEnd?: () => void;
}

/**
 * Horizontal timeline scrubber (monochrome).
 *  - Drag anywhere to live-seek the video (frame updates follow the cursor).
 *  - A floating time bubble tracks the handle while scrubbing.
 *  - Confirmed clips render as hatched regions with solid IN/OUT edges and a
 *    numbered tag — distinguished by number, never color.
 */
export default function Timeline({
  duration,
  currentTime,
  clips,
  pendingIn,
  onSeek,
  onScrubStart,
  onScrubEnd,
}: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [scrubbing, setScrubbing] = useState(false);

  const safeDuration = duration > 0 && isFinite(duration) ? duration : 0;
  const pct = (t: number) =>
    safeDuration > 0 ? Math.min(100, Math.max(0, (t / safeDuration) * 100)) : 0;

  const playheadPct = pct(currentTime);

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || safeDuration <= 0) return;
      const rect = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      onSeek(ratio * safeDuration);
    },
    [onSeek, safeDuration]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (safeDuration <= 0) return;
    draggingRef.current = true;
    setScrubbing(true);
    onScrubStart?.();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    seekFromClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    seekFromClientX(e.clientX);
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setScrubbing(false);
    onScrubEnd?.();
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  return (
    <div className="select-none">
      <div className="mb-2 flex items-end justify-between">
        <span className="font-mono text-lg font-bold tabular-nums leading-none">
          {formatTimePrecise(currentTime)}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {formatTime(safeDuration)}
        </span>
      </div>

      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`no-select relative flex h-14 w-full touch-none items-center overflow-hidden rounded-md border bg-secondary transition-colors ${
          scrubbing ? "border-foreground" : "border-border"
        }`}
        role="slider"
        aria-label="Video timeline"
        aria-valuemin={0}
        aria-valuemax={Math.round(safeDuration)}
        aria-valuenow={Math.round(currentTime)}
      >
        {/* Tick marks for a measured, instrument feel. */}
        <div className="pointer-events-none absolute inset-0 flex justify-between px-0">
          {Array.from({ length: 21 }).map((_, i) => (
            <span
              key={i}
              className="w-px bg-foreground/10"
              style={{ height: i % 5 === 0 ? "100%" : "40%", alignSelf: "center" }}
            />
          ))}
        </div>

        {/* Confirmed clip regions: hatched fill + solid IN/OUT edges + index. */}
        {clips.map((clip, i) => {
          const left = pct(clip.inPoint);
          const width = Math.max(0.5, pct(clip.outPoint) - left);
          return (
            <div
              key={clip.id}
              className="pointer-events-none absolute top-1/2 h-10 -translate-y-1/2"
              style={{ left: `${left}%`, width: `${width}%` }}
            >
              <div className="hatch absolute inset-0 opacity-[0.18]" />
              <div className="absolute inset-y-0 left-0 w-[2px] bg-foreground" />
              <div className="absolute inset-y-0 right-0 w-[2px] bg-foreground" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[9px] font-bold text-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
          );
        })}

        {/* Pending IN marker. */}
        {pendingIn !== null && (
          <div
            className="pointer-events-none absolute top-1/2 h-full -translate-y-1/2"
            style={{ left: `${pct(pendingIn)}%` }}
          >
            <div className="absolute left-0 top-0 h-full w-[2px] -translate-x-1/2 bg-foreground" />
            <span className="absolute left-0 top-0.5 -translate-x-1/2 rounded-[2px] bg-foreground px-1 font-mono text-[8px] font-bold leading-tight text-background">
              IN
            </span>
          </div>
        )}

        {/* Playhead + grab handle. */}
        <div
          className="pointer-events-none absolute top-0 h-full"
          style={{ left: `${playheadPct}%` }}
        >
          <div className="absolute left-0 top-0 h-full w-[2px] -translate-x-1/2 bg-foreground" />
          <div
            className={`absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow-[0_0_0_1px_hsl(var(--foreground))] transition-[width,height] ${
              scrubbing ? "size-6" : "size-4"
            }`}
          />
          {/* Floating time bubble while scrubbing. */}
          {scrubbing && (
            <div className="absolute -top-9 left-0 -translate-x-1/2 whitespace-nowrap rounded-sm border border-foreground bg-foreground px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums text-background shadow-[2px_2px_0_0_hsl(var(--foreground))]">
              {formatTimePrecise(currentTime)}
            </div>
          )}
        </div>
      </div>

      <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        Drag to scrub
      </p>
    </div>
  );
}
