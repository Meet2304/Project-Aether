import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] transition-colors",
  {
    variants: {
      variant: {
        // Filled black chip — for emphasized / processed states.
        solid: "border-foreground bg-foreground text-background",
        // Hairline outline chip — the default, neutral instrument label.
        outline: "border-foreground/30 bg-transparent text-foreground",
        // Muted chip — for low-emphasis metadata.
        muted: "border-transparent bg-secondary text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "outline",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
