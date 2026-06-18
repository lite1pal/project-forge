import { type HTMLAttributes } from "react";

import { cn } from "@/src/lib/ui/cn";

export function PageShell({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <main
      className={cn("mx-auto grid max-w-[1180px] gap-6 px-4 py-6 md:px-6 md:py-10", className)}
      {...props}
    />
  );
}
