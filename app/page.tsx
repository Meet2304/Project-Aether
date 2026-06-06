"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Video, Play } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { ClipRecord } from "@/lib/types";
import { formatTimePrecise } from "@/lib/clipUtils";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/Logo";
import ClipPlayer from "@/components/ClipPlayer";
import TrickBreakdown from "@/components/TrickBreakdown";
import { ImportVideoButton } from "@/components/ImportVideo";

export default function HomePage() {
  const [clips, setClips] = useState<ClipRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeClip, setActiveClip] = useState<ClipRecord | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("clips")
          .select("*")
          .order("recorded_at", { ascending: false })
          .limit(60);
        if (!active) return;
        if (error) {
          setError(error.message);
        } else {
          setClips((data as ClipRecord[]) ?? []);
        }
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "Failed to load clips");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Group clips by trick name, preserving recency order of first appearance.
  const groups = clips.reduce<Record<string, ClipRecord[]>>((acc, c) => {
    (acc[c.trick_name] ??= []).push(c);
    return acc;
  }, {});

  return (
    <main className="screen-enter relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-10">
      {/* Masthead */}
      <header className="flex items-center justify-between border-b border-foreground py-4">
        <div className="flex items-center gap-3">
          <Logo showWordmark={false} size={44} />
          <div>
            <h1 className="text-2xl font-extrabold leading-none tracking-tight">
              AETHER
            </h1>
            <p className="label-mono mt-1">Trick Recorder</p>
          </div>
        </div>
        <span className="label-mono text-foreground">
          {String(clips.length).padStart(2, "0")}&nbsp;clips
        </span>
      </header>

      {/* Record action — framed like a viewfinder */}
      <div className="flex flex-col items-center py-10">
        <div className="frame-ticks relative p-4">
          <Link
            href="/record"
            aria-label="Record a new trick"
            className="group flex size-40 flex-col items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
          >
            <Video className="size-9" strokeWidth={1.75} />
            <span className="label-mono mt-2 text-primary-foreground">
              ● Record
            </span>
          </Link>
        </div>
        <p className="mt-5 max-w-[15rem] text-center text-sm text-muted-foreground">
          Capture a run, scrub the footage, and clip each trick.
        </p>

        <div className="mt-6 flex w-full max-w-[16rem] items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="label-mono">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <ImportVideoButton className="mt-6 w-full max-w-[16rem]" />
      </div>

      {/* Per-trick counts */}
      {!loading && !error && clips.length > 0 && (
        <TrickBreakdown groups={groups} />
      )}

      {/* Recent clips */}
      <section className="flex-1">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-2">
          <h2 className="label-mono text-foreground">
            {clips.length > 0 ? "02" : "01"} — Recent
          </h2>
        </div>

        {loading && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-md border border-border bg-secondary"
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-md border border-foreground bg-card p-4 text-sm">
            <p className="label-mono mb-1.5 text-foreground">Error</p>
            <p className="text-foreground">Couldn&apos;t load clips: {error}</p>
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
              Make sure the clips table and skateboard-data bucket exist in
              Supabase.
            </p>
          </div>
        )}

        {!loading && !error && clips.length === 0 && (
          <div className="rounded-md border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No clips yet. Tap{" "}
            <span className="font-semibold text-foreground">Record</span> to
            capture your first trick.
          </div>
        )}

        <div className="scroll-area space-y-6 overflow-y-auto">
          {Object.entries(groups).map(([trick, items]) => (
            <div key={trick}>
              <div className="mb-2 flex items-baseline gap-2">
                <h3 className="text-sm font-bold tracking-tight">{trick}</h3>
                <span className="label-mono">
                  ×{String(items.length).padStart(2, "0")}
                </span>
                <span className="ml-2 h-px flex-1 bg-border" />
              </div>
              <div className="space-y-2">
                {items.map((clip) => (
                  <RecentClipRow
                    key={clip.id}
                    clip={clip}
                    onSelect={() => setActiveClip(clip)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <ClipPlayer clip={activeClip} onClose={() => setActiveClip(null)} />
    </main>
  );
}

function RecentClipRow({
  clip,
  onSelect,
}: {
  clip: ClipRecord;
  onSelect: () => void;
}) {
  const ts = new Date(clip.recorded_at);
  const when = isNaN(ts.getTime())
    ? "—"
    : ts.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Review ${clip.filename}`}
      className="group flex w-full items-center gap-3 rounded-md border border-border bg-card p-3 text-left transition-colors hover:border-foreground/40"
    >
      <span className="flex size-9 flex-none items-center justify-center rounded-sm border border-border bg-secondary transition-colors group-hover:bg-foreground group-hover:text-background">
        <Play className="size-3.5 translate-x-px" fill="currentColor" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-xs text-foreground">
          {clip.filename}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-[11px] tabular-nums text-muted-foreground">
          <span>{when}</span>
          {clip.duration_seconds != null && (
            <span>{clip.duration_seconds.toFixed(1)}s</span>
          )}
          {clip.in_point != null && clip.out_point != null && (
            <span>
              {formatTimePrecise(clip.in_point)}–
              {formatTimePrecise(clip.out_point)}
            </span>
          )}
        </div>
      </div>
      <Badge
        variant={clip.processed ? "solid" : "outline"}
        className="flex-none"
      >
        {clip.processed ? "Processed" : "Raw"}
      </Badge>
    </button>
  );
}
