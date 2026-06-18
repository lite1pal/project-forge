import { type ReactNode } from "react";

import { Card } from "@/src/components/ui/card";

interface ChartPanelProps {
  children: ReactNode;
  label: string;
}

export function ChartPanel({ children, label }: ChartPanelProps) {
  return (
    <Card className="grid gap-3">
      <span className="text-xs font-bold uppercase text-[var(--muted)]">{label}</span>
      {children}
    </Card>
  );
}
