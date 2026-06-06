"use client";

import type { Clip } from "@/lib/types";
import { formatTimePrecise } from "@/lib/clipUtils";

interface ClipCardProps {
  clip: Clip;
  index: number;
  onDelete: (id: string) => void;
}

/** A single marked clip row on the review screen. */
export default function ClipCard({ clip, index, onDelete }: ClipCardProps) {
  const duration = Math.max(0, clip.outPoint - clip.inPoint);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-surface p-3 animate-slideUp">
      <span
        className="h-9 w-1.5 flex-none rounded-full"
        style={{ backgroundColor: clip.color }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-neutral-100">
            {clip.trickName}
          </span>
          <span className="flex-none rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-400">
            #{index + 1}
          </span>
        </div>
        <div className="mt-0.5 truncate text-xs text-neutral-500">
          {clip.filename}
        </div>
        <div className="mt-1 flex gap-3 text-xs tabular-nums text-neutral-400">
          <span className="text-marker-in">IN {formatTimePrecise(clip.inPoint)}</span>
          <span className="text-marker-out">OUT {formatTimePrecise(clip.outPoint)}</span>
          <span className="text-neutral-300">{duration.toFixed(1)}s</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onDelete(clip.id)}
        aria-label={`Delete clip ${index + 1}`}
        className="flex h-11 w-11 flex-none items-center justify-center rounded-lg border border-neutral-800 text-neutral-500 transition-colors hover:border-red-500/50 hover:text-red-400"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
          <path d="M10 11v6M14 11v6" />
        </svg>
      </button>
    </div>
  );
}
