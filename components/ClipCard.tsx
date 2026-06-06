"use client";

import { Trash2 } from "lucide-react";
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
    <div className="flex animate-slideUp items-stretch gap-0 overflow-hidden rounded-md border border-border bg-card">
      {/* Index plate — monochrome stand-in for the old colored bar. */}
      <div className="flex w-11 flex-none items-center justify-center border-r border-border bg-secondary font-mono text-sm font-bold tabular-nums">
        {String(index + 1).padStart(2, "0")}
      </div>

      <div className="min-w-0 flex-1 p-3">
        <div className="truncate text-sm font-bold tracking-tight">
          {clip.trickName}
        </div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
          {clip.filename}
        </div>
        <div className="mt-1.5 flex items-center gap-3 font-mono text-[11px] tabular-nums text-foreground">
          <span>
            <span className="text-muted-foreground">IN</span>{" "}
            {formatTimePrecise(clip.inPoint)}
          </span>
          <span className="text-border">/</span>
          <span>
            <span className="text-muted-foreground">OUT</span>{" "}
            {formatTimePrecise(clip.outPoint)}
          </span>
          <span className="ml-auto font-bold">{duration.toFixed(1)}s</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onDelete(clip.id)}
        aria-label={`Delete clip ${index + 1}`}
        className="flex w-12 flex-none items-center justify-center border-l border-border text-muted-foreground transition-colors hover:bg-foreground hover:text-background"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
