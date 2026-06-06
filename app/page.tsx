"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { ClipRecord } from "@/lib/types";
import { formatTimePrecise } from "@/lib/clipUtils";

export default function HomePage() {
  const [clips, setClips] = useState<ClipRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        if (active) setError(e instanceof Error ? e.message : "Failed to load clips");
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
    <main className="screen-enter mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-8">
      <header className="pt-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Project Aether</h1>
        <p className="mt-1 text-sm text-neutral-500">Trick Recorder</p>
      </header>

      {/* Record button */}
      <div className="flex flex-col items-center py-8">
        <Link
          href="/record"
          aria-label="Record a new trick"
          className="group flex h-44 w-44 flex-col items-center justify-center rounded-full bg-accent text-white shadow-[0_0_60px_-10px_rgba(59,130,246,0.7)] transition-transform active:scale-95"
        >
          <svg
            width="44"
            height="44"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M23 7l-7 5 7 5V7z" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          <span className="mt-2 text-lg font-semibold">Record</span>
        </Link>
      </div>

      {/* Recent clips */}
      <section className="flex-1">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Recent Clips
        </h2>

        {loading && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl border border-neutral-800 bg-surface"
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
            Couldn&apos;t load clips: {error}
            <p className="mt-1 text-xs text-red-300/70">
              Make sure the <code>clips</code> table and{" "}
              <code>skateboard-data</code> bucket exist in Supabase.
            </p>
          </div>
        )}

        {!loading && !error && clips.length === 0 && (
          <div className="rounded-xl border border-neutral-800 bg-surface p-6 text-center text-sm text-neutral-500">
            No clips yet. Tap{" "}
            <span className="font-semibold text-accent">Record</span> to capture
            your first trick.
          </div>
        )}

        <div className="scroll-area space-y-5 overflow-y-auto">
          {Object.entries(groups).map(([trick, items]) => (
            <div key={trick}>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-sm font-semibold text-neutral-200">{trick}</h3>
                <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-400">
                  {items.length}
                </span>
              </div>
              <div className="space-y-2">
                {items.map((clip) => (
                  <RecentClipRow key={clip.id} clip={clip} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function RecentClipRow({ clip }: { clip: ClipRecord }) {
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
    <div className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-surface p-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-neutral-100">
          {clip.filename}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-neutral-500">
          <span>{when}</span>
          {clip.duration_seconds != null && (
            <span>{clip.duration_seconds.toFixed(1)}s</span>
          )}
          {clip.in_point != null && clip.out_point != null && (
            <span className="tabular-nums">
              {formatTimePrecise(clip.in_point)}–{formatTimePrecise(clip.out_point)}
            </span>
          )}
        </div>
      </div>
      <span
        className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-semibold ${
          clip.processed
            ? "bg-emerald-500/15 text-emerald-300"
            : "bg-neutral-700/40 text-neutral-300"
        }`}
      >
        {clip.processed ? "Processed" : "Raw"}
      </span>
    </div>
  );
}
