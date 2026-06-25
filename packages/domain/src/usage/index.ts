import { getUtcMonthWindow } from "../time/index.js";

import type { UtcMonthWindow } from "../time/index.js";

export interface UsageMeterDefinition<TMeterId extends string = string> {
  id: TMeterId;
  includedUnits: number;
  name: string;
}

export interface UsageMeterSummary<TMeterId extends string = string>
  extends UtcMonthWindow {
  id: TMeterId;
  includedUnits: number;
  name: string;
  remainingUnits: number;
  usedUnits: number;
}

export function summarizeUsageMeter<TMeterId extends string>(input: {
  meter: UsageMeterDefinition<TMeterId>;
  now: Date;
  usedUnits: number;
}): UsageMeterSummary<TMeterId> {
  const window = getUtcMonthWindow(input.now);

  return {
    id: input.meter.id,
    includedUnits: input.meter.includedUnits,
    name: input.meter.name,
    periodEnd: window.periodEnd,
    periodStart: window.periodStart,
    remainingUnits: Math.max(input.meter.includedUnits - input.usedUnits, 0),
    usedUnits: input.usedUnits
  };
}
