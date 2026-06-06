"use client";

import { useCallback, useRef } from "react";
import type { Clip } from "@/lib/types";
import { formatTime } from "@/lib/clipUtils";

interface TimelineProps {
  duration: number;
  currentTime: number;
  /** Confirmed clips to render as colored regions. */
  clips: Clip[];
  /** A pending IN point (marked but not yet OUT) shown as a green marker. */
  pendingIn: number | null;
  /** Called continuously while dragging/seeking with the target time. */
  onSeek: (time: number) => void;
}

/**
 * Horizontal timeline scrubber.
 *  - Draggable (pointer events → works for mouse and touch).
 *  - Renders each confirmed clip as a semi-transparent colored region.
 *  - Renders IN markers (green), OUT markers (red), and a pending IN marker.
 *  - Tall 44px+ tap target.
 */
export default function Timeline({
  duration,
  currentTime,
  clips,
  pendingIn,
  onSeek,
}: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const safeDuration = duration > 0 && isFinite(duration) ? duration : 0;
  const pct = (t: number) =>
    safeDuration > 0 ? Math.min(100, Math.max(0, (t / safeDuration) * 100)) : 0;

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
    draggingRef.current = true;
    // Capture the pointer so we keep getting move events even if the finger
    // drifts off the track element.
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    seekFromClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    seekFromClientX(e.clientX);
  };

  const endDrag = (e: React.PointerEvent) => {
    draggingRef.current = false;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  return (
    <div className="select-none">
      <div className="mb-1 flex justify-between text-xs tabular-nums text-neutral-500">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(safeDuration)}</span>
      </div>

      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="no-select relative flex h-11 w-full cursor-pointer items-center rounded-lg bg-neutral-800"
        role="slider"
        aria-label="Video timeline"
        aria-valuemin={0}
        aria-valuemax={Math.round(safeDuration)}
        aria-valuenow={Math.round(currentTime)}
      >
        {/* Base track line */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-neutral-700" />

        {/* Confirmed clip regions */}
        {clips.map((clip) => {
          const left = pct(clip.inPoint);
          const width = pct(clip.outPoint) - left;
          return (
            <div
              key={clip.id}
              className="pointer-events-none absolute top-1/2 h-7 -translate-y-1/2 rounded"
              style={{
                left: `${left}%`,
                width: `${Math.max(0.5, width)}%`,
                backgroundColor: clip.color,
                opacity: 0.35,
                border: `1px solid ${clip.color}`,
              }}
            />
          );
        })}

        {/* IN/OUT edge markers for each confirmed clip */}
        {clips.map((clip) => (
          <div key={`m-${clip.id}`} className="pointer-events-none">
            <div
              className="absolute top-1/2 h-7 w-0.5 -translate-y-1/2 bg-marker-in"
              style={{ left: `${pct(clip.inPoint)}%` }}
            />
            <div
              className="absolute top-1/2 h-7 w-0.5 -translate-y-1/2 bg-marker-out"
              style={{ left: `${pct(clip.outPoint)}%` }}
            />
          </div>
        ))}

        {/* Pending IN marker (green) */}
        {pendingIn !== null && (
          <div
            className="pointer-events-none absolute top-1/2 h-9 -translate-y-1/2"
            style={{ left: `${pct(pendingIn)}%` }}
          >
            <div className="absolute left-0 top-0 h-full w-0.5 -translate-x-1/2 bg-marker-in" />
            <div className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full border border-black bg-marker-in" />
          </div>
        )}

        {/* Playhead */}
        <div
          className="pointer-events-none absolute top-1/2 -translate-y-1/2"
          style={{ left: `${pct(currentTime)}%` }}
        >
          <div className="absolute left-0 top-1/2 h-9 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-white" />
          <div className="absolute left-0 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent shadow" />
        </div>
      </div>
    </div>
  );
}
