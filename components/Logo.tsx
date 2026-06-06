import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  /** Pixel size of the square mark tile. */
  size?: number;
  /** Render the "AETHER" wordmark beside the mark. */
  showWordmark?: boolean;
  className?: string;
}

/**
 * The Aether "Carve" mark in a bordered tile, optionally with the wordmark.
 * Black-on-paper to match the monochrome system. Source: /assets/aether-mark.svg.
 */
export function Logo({ size = 44, showWordmark = true, className }: LogoProps) {
  const glyph = Math.round(size * 0.58);
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        className="flex flex-none items-center justify-center rounded-md border border-foreground bg-card"
        style={{ width: size, height: size }}
      >
        <Image
          src="/assets/aether-mark.svg"
          alt="Aether"
          width={glyph}
          height={glyph}
          priority
          unoptimized
        />
      </span>
      {showWordmark && (
        <span className="text-2xl font-extrabold leading-none tracking-tight">
          AETHER
        </span>
      )}
    </div>
  );
}
