"use client";

/** Default trick list pre-populated in the dropdown. */
export const DEFAULT_TRICKS = [
  "Ollie",
  "Kickflip",
  "Heelflip",
  "Pop Shove-it",
  "50-50",
  "Fly-Out",
  "Unknown",
] as const;

const STORAGE_KEY = "aether:custom-tricks";

/**
 * Returns the full trick list: the defaults plus any user-added tricks that
 * were persisted in localStorage. De-duplicated, defaults first.
 */
export function getTricks(): string[] {
  const custom = getCustomTricks();
  const merged: string[] = [...DEFAULT_TRICKS];
  for (const t of custom) {
    if (!merged.some((m) => m.toLowerCase() === t.toLowerCase())) {
      merged.push(t);
    }
  }
  return merged;
}

/** Reads only the user-added tricks from localStorage. */
export function getCustomTricks(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x) => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

/**
 * Persists a new trick to localStorage if it isn't already a default or
 * existing custom trick. Returns the updated full list.
 */
export function addTrick(name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return getTricks();

  const isDefault = DEFAULT_TRICKS.some(
    (d) => d.toLowerCase() === trimmed.toLowerCase(),
  );
  const custom = getCustomTricks();
  const alreadyCustom = custom.some(
    (c) => c.toLowerCase() === trimmed.toLowerCase(),
  );

  if (!isDefault && !alreadyCustom) {
    const updated = [...custom, trimmed];
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore quota / private-mode errors — the trick still works for the
      // current session via the returned list.
    }
  }

  return getTricks();
}
