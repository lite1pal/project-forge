import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/src/lib/ui/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        className={cn(
          "min-h-10 w-full rounded-lg border border-slate-300 bg-[var(--panel)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-blue-100",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
