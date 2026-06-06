"use client";

import type { ClipRecord } from "@/lib/types";

/**
 * Per-trick clip counts rendered as a monochrome ledger: ranked rows with
 * proportional bars that grow in on load. Distinguished by rank + length only.
 */
export default function TrickBreakdown({
  groups,
}: {
  groups: Record<string, ClipRecord[]>;
}) {
  const entries = Object.entries(groups)
    .map(([trick, items]) => ({ trick, count: items.length }))
    .sort((a, b) => b.count - a.count);

  if (entries.length === 0) return null;

  const max = Math.max(...entries.map((e) => e.count));
  const total = entries.reduce((sum, e) => sum + e.count, 0);

  return (
    <section className="mb-7">
      <div className="mb-3 flex items-baseline justify-between border-b border-border pb-2">
        <h2 className="label-mono text-foreground">01 — Breakdown</h2>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {entries.length} trick{entries.length === 1 ? "" : "s"} · {total}{" "}
          total
        </span>
      </div>

      <div className="rounded-md border border-border bg-card">
        {entries.map((e, i) => (
          <div
            key={e.trick}
            className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0"
          >
            <span className="w-4 flex-none font-mono text-[11px] font-bold tabular-nums text-muted-foreground">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="w-[5.5rem] flex-none truncate text-sm font-bold tracking-tight">
              {e.trick}
            </span>
            <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
              <span
                className="absolute inset-y-0 left-0 origin-left animate-barGrow rounded-full bg-foreground"
                style={{
                  width: `${(e.count / max) * 100}%`,
                  animationDelay: `${i * 70}ms`,
                }}
              />
            </span>
            <span className="w-6 flex-none text-right font-mono text-sm font-bold tabular-nums">
              {String(e.count).padStart(2, "0")}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
