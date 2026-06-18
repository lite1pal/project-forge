import { type HTMLAttributes } from "react";

import { cn } from "@/src/lib/ui/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <article
      className={cn(
        "rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4",
        className
      )}
      {...props}
    />
  );
}
