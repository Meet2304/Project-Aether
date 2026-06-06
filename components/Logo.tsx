import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  /** Pixel size of the square icon tile. */
  size?: number;
  /** Render the "AETHER" wordmark beside the mark. */
  showWordmark?: boolean;
  className?: string;
}

/**
 * The Aether app icon (V2) — a self-contained white "A" mark on a black
 * rounded tile — optionally with the wordmark. Source: /assets/V2/Icon_v2.png.
 */
export function Logo({ size = 44, showWordmark = true, className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Image
        src="/assets/V2/Icon_v2.png"
        alt="Aether"
        width={size}
        height={size}
        priority
        className="flex-none rounded-[22%]"
      />
      {showWordmark && (
        <span className="text-2xl font-extrabold leading-none tracking-tight">
          AETHER
        </span>
      )}
    </div>
  );
}
