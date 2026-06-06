"use client";

import { useEffect, useState } from "react";
import { addTrick, getTricks } from "@/lib/tricks";

interface TrickSelectorProps {
  value: string;
  onChange: (trick: string) => void;
  /** Optional id for label association. */
  id?: string;
}

/**
 * Dropdown of trick names with an inline "add new trick" affordance.
 * New tricks are persisted to localStorage (see lib/tricks).
 */
export default function TrickSelector({ value, onChange, id }: TrickSelectorProps) {
  const [tricks, setTricks] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [newTrick, setNewTrick] = useState("");

  useEffect(() => {
    setTricks(getTricks());
  }, []);

  const commitNewTrick = () => {
    const name = newTrick.trim();
    if (!name) {
      setAdding(false);
      return;
    }
    const updated = addTrick(name);
    setTricks(updated);
    onChange(name);
    setNewTrick("");
    setAdding(false);
  };

  return (
    <div className="space-y-2">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-base text-neutral-100 outline-none focus:border-accent"
      >
        {tricks.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="h-10 w-full rounded-lg border border-dashed border-neutral-700 text-sm text-neutral-400 transition-colors hover:border-accent hover:text-accent"
        >
          + Add new trick
        </button>
      ) : (
        <div className="flex gap-2">
          <input
            autoFocus
            value={newTrick}
            onChange={(e) => setNewTrick(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitNewTrick();
              if (e.key === "Escape") {
                setAdding(false);
                setNewTrick("");
              }
            }}
            placeholder="New trick name"
            className="h-11 flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-base outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={commitNewTrick}
            className="h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-white"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
