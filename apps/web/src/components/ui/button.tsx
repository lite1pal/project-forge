import { Slot } from "@radix-ui/react-slot";
import { type ButtonHTMLAttributes } from "react";

import { cn } from "@/src/lib/ui/cn";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
}

export function Button({
  asChild,
  className,
  size = "md",
  variant = "primary",
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        size === "sm" ? "min-h-9 px-3 text-sm" : "min-h-10 px-4 text-sm",
        variant === "primary" &&
          "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-blue-700",
        variant === "secondary" &&
          "border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)] hover:bg-[var(--panel-subtle)]",
        variant === "ghost" &&
          "border-transparent bg-transparent text-[var(--foreground)] hover:bg-[var(--panel-subtle)]",
        className
      )}
      {...props}
    />
  );
}
