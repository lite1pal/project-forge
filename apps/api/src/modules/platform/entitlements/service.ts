import {
  canConsumeMeter as evaluateMeterConsumption,
  canUseFeature as evaluateFeatureUsage,
  featureKeySchema,
  meterKeySchema,
  summarizeEntitlements,
  type EntitlementDecision,
  type PlanEntitlement,
  type UsageLimit
} from "@auditrail/domain/entitlements";
import {
  getPricingPlan,
  getUtcMonthWindow,
  type PricingPlanId
} from "@auditrail/domain/pricing";
import { z } from "zod";

const organizationIdSchema = z.string().trim().min(1);
const quantitySchema = z.number().int().positive();

export const defaultPlatformEntitlementPlanId: PricingPlanId = "starter";
export const defaultPlatformMeterKey = "events";

export interface OrganizationMeterUsage<TMeterKey extends string = string> {
  meterKey: TMeterKey;
  usedUnits: number;
}

export interface OrganizationEntitlementSnapshot<
  TMeterKey extends string = string
> {
  meterUsage: readonly OrganizationMeterUsage<TMeterKey>[];
  organizationId: string;
  planId?: PricingPlanId;
}

export interface PlatformEntitlementRepo<
  TMeterKey extends string = string
> {
  getOrganizationEntitlementSnapshot(input: {
    organizationId: string;
    periodStart: string;
  }): Promise<OrganizationEntitlementSnapshot<TMeterKey> | undefined>;
}

export type PlatformEntitlementPlanResolver<
  TFeatureKey extends string = string,
  TMeterKey extends string = string
> = (planId: PricingPlanId) => PlanEntitlement<TFeatureKey, TMeterKey>;

export interface PlatformEntitlementSummary<
  TFeatureKey extends string = string,
  TMeterKey extends string = string
> {
  features: readonly TFeatureKey[];
  meterUsage: ReadonlyArray<{
    includedUnits: number | null;
    kind: UsageLimit<TMeterKey>["kind"];
    meterKey: TMeterKey;
    remainingUnits: number | null;
    usedUnits: number;
  }>;
  organizationId: string;
  periodEnd: string;
  periodStart: string;
  planId: PricingPlanId;
  usedDefaultPlan: boolean;
  usageLimits: readonly UsageLimit<TMeterKey>[];
}

export interface PlatformEntitlementService<
  TFeatureKey extends string = string,
  TMeterKey extends string = string
> {
  canConsumeMeter(input: {
    meterKey: TMeterKey;
    organizationId: string;
    quantity: number;
  }): Promise<EntitlementDecision<TFeatureKey, TMeterKey>>;
  canUseFeature(input: {
    featureKey: TFeatureKey;
    organizationId: string;
  }): Promise<EntitlementDecision<TFeatureKey, TMeterKey>>;
  getEntitlementSummary(
    organizationId: string
  ): Promise<PlatformEntitlementSummary<TFeatureKey, TMeterKey>>;
}

export class OrganizationNotFoundError extends Error {
  constructor(organizationId: string) {
    super(`organization_not_found:${organizationId}`);
    this.name = "OrganizationNotFoundError";
  }
}

export function defaultPlatformEntitlementPlanResolver(
  planId: PricingPlanId
): PlanEntitlement<string, string> {
  const plan = getPricingPlan(planId);

  return {
    features: [],
    usageLimits: [
      {
        includedUnits: plan.includedEvents,
        kind: "limited",
        meterKey: defaultPlatformMeterKey
      }
    ]
  };
}

export function createPlatformEntitlementService<
  TFeatureKey extends string = string,
  TMeterKey extends string = string
>(
  repo: PlatformEntitlementRepo<TMeterKey>,
  options: {
    defaultPlanId?: PricingPlanId;
    now?: () => Date;
    resolvePlanEntitlement?: PlatformEntitlementPlanResolver<
      TFeatureKey,
      TMeterKey
    >;
  } = {}
): PlatformEntitlementService<TFeatureKey, TMeterKey> {
  const now = options.now ?? (() => new Date());
  const defaultPlanId =
    options.defaultPlanId ?? defaultPlatformEntitlementPlanId;
  const resolvePlanEntitlement =
    options.resolvePlanEntitlement ??
    (defaultPlatformEntitlementPlanResolver as PlatformEntitlementPlanResolver<
      TFeatureKey,
      TMeterKey
    >);

  return {
    async canConsumeMeter(input) {
      const quantity = quantitySchema.parse(input.quantity);
      const meterKey = meterKeySchema.parse(input.meterKey) as TMeterKey;
      const state = await loadEntitlementState(
        repo,
        resolvePlanEntitlement,
        defaultPlanId,
        organizationIdSchema.parse(input.organizationId),
        now
      );

      return evaluateMeterConsumption({
        entitlement: state.entitlement,
        meterKey,
        requestedUnits: quantity,
        usedUnits: state.meterUsageByMeterKey.get(meterKey) ?? 0
      });
    },
    async canUseFeature(input) {
      const featureKey = featureKeySchema.parse(input.featureKey) as TFeatureKey;
      const state = await loadEntitlementState(
        repo,
        resolvePlanEntitlement,
        defaultPlanId,
        organizationIdSchema.parse(input.organizationId),
        now
      );

      return evaluateFeatureUsage({
        entitlement: state.entitlement,
        featureKey
      });
    },
    async getEntitlementSummary(organizationId) {
      const state = await loadEntitlementState(
        repo,
        resolvePlanEntitlement,
        defaultPlanId,
        organizationIdSchema.parse(organizationId),
        now
      );
      const summarized = summarizeEntitlements(state.entitlement);

      return {
        features: summarized.features,
        meterUsage: summarized.usageLimits.map((usageLimit) => {
          const usedUnits = state.meterUsageByMeterKey.get(usageLimit.meterKey) ?? 0;

          if (usageLimit.kind === "unlimited") {
            return {
              includedUnits: null,
              kind: usageLimit.kind,
              meterKey: usageLimit.meterKey,
              remainingUnits: null,
              usedUnits
            };
          }

          return {
            includedUnits: usageLimit.includedUnits,
            kind: usageLimit.kind,
            meterKey: usageLimit.meterKey,
            remainingUnits: Math.max(usageLimit.includedUnits - usedUnits, 0),
            usedUnits
          };
        }),
        organizationId: state.organizationId,
        periodEnd: state.periodEnd,
        periodStart: state.periodStart,
        planId: state.planId,
        usageLimits: summarized.usageLimits,
        usedDefaultPlan: state.usedDefaultPlan
      };
    }
  };
}

async function loadEntitlementState<
  TFeatureKey extends string,
  TMeterKey extends string
>(
  repo: PlatformEntitlementRepo<TMeterKey>,
  resolvePlanEntitlement: PlatformEntitlementPlanResolver<TFeatureKey, TMeterKey>,
  defaultPlanId: PricingPlanId,
  organizationId: string,
  now: () => Date
) {
  const currentWindow = getUtcMonthWindow(now());
  const snapshot = await repo.getOrganizationEntitlementSnapshot({
    organizationId,
    periodStart: currentWindow.periodStart
  });

  if (!snapshot) {
    throw new OrganizationNotFoundError(organizationId);
  }

  const planId = snapshot.planId ?? defaultPlanId;

  return {
    entitlement: resolvePlanEntitlement(planId),
    meterUsageByMeterKey: new Map(
      snapshot.meterUsage.map((meterUsage) => [
        meterUsage.meterKey,
        meterUsage.usedUnits
      ])
    ),
    organizationId: snapshot.organizationId,
    periodEnd: currentWindow.periodEnd,
    periodStart: currentWindow.periodStart,
    planId,
    usedDefaultPlan: snapshot.planId === undefined
  };
}
