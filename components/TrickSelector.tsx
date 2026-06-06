"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { addTrick, getTricks } from "@/lib/tricks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

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
export default function TrickSelector({
  value,
  onChange,
  id,
}: TrickSelectorProps) {
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
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder="Select a trick" />
        </SelectTrigger>
        <SelectContent>
          {tricks.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-10 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border text-xs font-medium text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          <Plus className="size-3.5" />
          Add new trick
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
            className="h-11 flex-1 rounded-md border border-input bg-card px-3 text-base outline-none focus:border-foreground"
          />
          <Button type="button" onClick={commitNewTrick} size="default">
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
