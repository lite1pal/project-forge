import { type HTMLAttributes } from "react";

import { cn } from "@/src/lib/ui/cn";

interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
}

export function EmptyState({ className, label, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--border)] bg-[var(--panel)] p-8 text-center text-[var(--muted)]",
        className
      )}
      {...props}
    >
      {label}
    </div>
  );
}
