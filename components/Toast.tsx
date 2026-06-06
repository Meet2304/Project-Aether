"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Check, X, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Hook to fire toast notifications from anywhere in the tree. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Safe no-op fallback so components don't crash outside the provider.
    return { showToast: () => {} };
  }
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-3">
        {toasts.map((t) => (
          <ToastBubble key={t.id} item={t} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastBubble({ item }: { item: ToastItem }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setLeaving(true), 3200);
    return () => window.clearTimeout(t);
  }, []);

  // Monochrome: the icon glyph carries the meaning, not color.
  const Icon =
    item.kind === "success" ? Check : item.kind === "error" ? X : Info;
  const label =
    item.kind === "success" ? "OK" : item.kind === "error" ? "ERR" : "INFO";

  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full max-w-sm animate-toastIn items-center gap-3 border border-foreground bg-card px-3.5 py-2.5 text-sm shadow-[3px_3px_0_0_hsl(var(--foreground))] transition-opacity duration-300",
        leaving ? "opacity-0" : "opacity-100",
      )}
      role="status"
      aria-live="polite"
    >
      <span className="flex size-6 flex-none items-center justify-center rounded-sm bg-foreground text-background">
        <Icon className="size-3.5" strokeWidth={2.5} />
      </span>
      <span className="label-mono flex-none text-foreground">{label}</span>
      <span className="leading-snug text-foreground">{item.message}</span>
    </div>
  );
}
