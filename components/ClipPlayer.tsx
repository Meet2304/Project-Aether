"use client";

import { useMemo } from "react";
import { ExternalLink, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { ClipRecord } from "@/lib/types";
import { STORAGE_BUCKET } from "@/lib/types";
import { formatTimePrecise } from "@/lib/clipUtils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

/** Resolve the public URL for a stored clip from its storage_path. */
function publicUrlFor(clip: ClipRecord): string {
  const prefix = `${STORAGE_BUCKET}/`;
  const path = clip.storage_path.startsWith(prefix)
    ? clip.storage_path.slice(prefix.length)
    : clip.storage_path;
  const supabase = createClient();
  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

interface ClipPlayerProps {
  clip: ClipRecord | null;
  onClose: () => void;
}

/** Modal video player for reviewing a previously uploaded clip. */
export default function ClipPlayer({ clip, onClose }: ClipPlayerProps) {
  const url = useMemo(() => (clip ? publicUrlFor(clip) : ""), [clip]);

  const open = clip !== null;

  const when =
    clip && !isNaN(new Date(clip.recorded_at).getTime())
      ? new Date(clip.recorded_at).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        hideClose
        className="gap-0 overflow-hidden p-0 max-w-md"
      >
        {/* Player */}
        <div className="relative bg-black">
          {clip && (
            <video
              key={clip.id}
              src={url}
              controls
              autoPlay
              playsInline
              className="aspect-video w-full bg-black"
            />
          )}
          <DialogClose className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full border border-white/40 bg-black/50 text-white backdrop-blur transition-colors hover:bg-black/70 focus:outline-none">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>

        {/* Metadata */}
        {clip && (
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="truncate text-lg font-bold tracking-tight">
                  {clip.trick_name}
                </DialogTitle>
                <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                  {clip.filename}
                </p>
              </div>
              <Badge
                variant={clip.processed ? "solid" : "outline"}
                className="flex-none"
              >
                {clip.processed ? "Processed" : "Raw"}
              </Badge>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 font-mono text-[11px] tabular-nums text-muted-foreground">
              <span>{when}</span>
              {clip.duration_seconds != null && (
                <span>{clip.duration_seconds.toFixed(1)}s</span>
              )}
              {clip.in_point != null && clip.out_point != null && (
                <span>
                  <span className="text-foreground/60">IN</span>{" "}
                  {formatTimePrecise(clip.in_point)}{" "}
                  <span className="text-foreground/60">OUT</span>{" "}
                  {formatTimePrecise(clip.out_point)}
                </span>
              )}
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-foreground transition-opacity hover:opacity-60"
              >
                <ExternalLink className="size-3" />
                Open
              </a>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
