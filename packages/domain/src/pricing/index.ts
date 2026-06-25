import { getUtcMonthWindow } from "../time/index.js";
import { summarizeUsageMeter } from "../usage/index.js";

import type { UtcMonthWindow } from "../time/index.js";

export { getUtcMonthWindow } from "../time/index.js";

export const pricingPlanIds = ["starter", "growth", "scale"] as const;

export type PricingPlanId = (typeof pricingPlanIds)[number];

export interface PricingPlan {
  id: PricingPlanId;
  name: string;
  includedEvents: number;
}

export interface PricingUsageSummary extends UtcMonthWindow {
  id: PricingPlanId;
  includedEvents: number;
  name: string;
  remainingEvents: number;
  usedEvents: number;
}

export const pricingPlans: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    includedEvents: 100_000
  },
  {
    id: "growth",
    name: "Growth",
    includedEvents: 1_000_000
  },
  {
    id: "scale",
    name: "Scale",
    includedEvents: 10_000_000
  }
];

export const pricingPlanMap: Readonly<Record<PricingPlanId, PricingPlan>> = {
  starter: pricingPlans[0],
  growth: pricingPlans[1],
  scale: pricingPlans[2]
};

export function getPricingPlan(planId: PricingPlanId): PricingPlan {
  return pricingPlanMap[planId];
}

export function summarizePricingUsage(input: {
  now: Date;
  planId: PricingPlanId;
  usedEvents: number;
}): PricingUsageSummary {
  const plan = getPricingPlan(input.planId);
  const summary = summarizeUsageMeter({
    meter: {
      id: plan.id,
      includedUnits: plan.includedEvents,
      name: plan.name
    },
    now: input.now,
    usedUnits: input.usedEvents
  });

  return {
    id: summary.id,
    includedEvents: summary.includedUnits,
    name: summary.name,
    periodEnd: summary.periodEnd,
    periodStart: summary.periodStart,
    remainingEvents: summary.remainingUnits,
    usedEvents: summary.usedUnits
  };
}
