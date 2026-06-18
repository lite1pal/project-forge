"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { ChartPanel } from "@/src/components/ui/chart-panel";
import type { EventTimeseriesViewModel } from "@/src/features/audit-events/domain/types";

interface EventTimeseriesChartProps {
  points: EventTimeseriesViewModel["points"];
}

export function EventTimeseriesChart({ points }: EventTimeseriesChartProps) {
  return (
    <ChartPanel label="Events over time">
      <ResponsiveContainer height={220} width="100%">
        <AreaChart data={points}>
          <CartesianGrid stroke="#edf0f5" />
          <XAxis dataKey="bucketStart" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={32} />
          <Tooltip />
          <Area dataKey="count" fill="#9cc2ff" stroke="#1f6feb" type="monotone" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}
