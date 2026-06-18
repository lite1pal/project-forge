import { type ReactNode } from "react";

import { Card } from "@/src/components/ui/card";

interface MetricCardProps {
  children?: ReactNode;
  label: string;
  value?: string;
}

export function MetricCard({ children, label, value }: MetricCardProps) {
  return (
    <Card className="grid gap-3">
      <span className="text-xs font-bold uppercase text-[var(--muted)]">{label}</span>
      {value ? <strong className="text-4xl">{value}</strong> : children}
    </Card>
  );
}
