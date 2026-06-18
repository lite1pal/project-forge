import Link from "next/link";
import { type ComponentProps } from "react";

import { cn } from "@/src/lib/ui/cn";

export function PaginationLink({
  className,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        "inline-flex min-h-10 items-center justify-center justify-self-end rounded-lg border border-[var(--border)] bg-[var(--panel)] px-4 text-sm font-bold text-[var(--foreground)] no-underline hover:bg-[var(--panel-subtle)]",
        className
      )}
      {...props}
    />
  );
}
