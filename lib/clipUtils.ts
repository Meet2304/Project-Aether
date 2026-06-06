/** Utilities for clip filenames, formatting, and timeline colors. */

/** Distinct, semi-transparent-friendly colors for clip regions on the timeline. */
export const CLIP_COLORS = [
  "#3B82F6", // blue (accent)
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#F59E0B", // amber
  "#10B981", // emerald
  "#06B6D4", // cyan
  "#F43F5E", // rose
  "#A3E635", // lime
];

/** Picks a color for the clip at the given index, cycling through the palette. */
export function colorForIndex(index: number): string {
  return CLIP_COLORS[index % CLIP_COLORS.length];
}

/**
 * Slugifies a trick name for use in storage paths and filenames.
 * e.g. "Pop Shove-it" -> "pop-shove-it", "50-50" -> "50-50".
 */
export function slugifyTrick(trick: string): string {
  return (
    trick
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "unknown"
  );
}

/** Pads a number to two digits. */
const p2 = (n: number) => String(n).padStart(2, "0");

/** Returns a { date: YYYYMMDD, time: HHmmss } stamp for a given Date. */
export function dateStamp(d = new Date()): { date: string; time: string } {
  const date = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}`;
  const time = `${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
  return { date, time };
}

/**
 * Builds the clip filename:
 *   {trick-slug}_{YYYYMMDD}_{HHmmss}_{index}.webm
 */
export function buildFilename(
  trick: string,
  index: number,
  when = new Date()
): string {
  const { date, time } = dateStamp(when);
  return `${slugifyTrick(trick)}_${date}_${time}_${index}.webm`;
}

/**
 * Fallback filename when client-side trimming is unavailable. Embeds the
 * IN/OUT points so the post-processor can trim server-side:
 *   {base}_IN-{in}_OUT-{out}.webm
 */
export function withTimestamps(
  baseFilename: string,
  inPoint: number,
  outPoint: number
): string {
  const stem = baseFilename.replace(/\.webm$/i, "");
  return `${stem}_IN-${inPoint.toFixed(2)}_OUT-${outPoint.toFixed(2)}.webm`;
}

/** Formats seconds as MM:SS. */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${p2(m)}:${p2(s)}`;
}

/** Formats seconds as MM:SS.mmm-ish (MM:SS.d) for fine timestamps. */
export function formatTimePrecise(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ds = Math.floor((seconds - Math.floor(seconds)) * 10);
  return `${p2(m)}:${p2(s)}.${ds}`;
}
