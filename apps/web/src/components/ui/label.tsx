import { type LabelHTMLAttributes } from "react";

import { cn } from "@/src/lib/ui/cn";

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("grid gap-1 text-xs font-medium text-[var(--muted)]", className)}
      {...props}
    />
  );
}
