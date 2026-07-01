import { auditTrailProduct } from "@auditrail/domain/audit-events";
import {
  canConsumeMeter as evaluateMeterConsumption,
  canUseFeature as evaluateFeatureUsage,
  featureKeySchema,
  meterKeySchema,
  summarizeEntitlements,
  type EntitlementDecision,
  type PlanEntitlement,
  type ProductPlanEntitlement,
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
export const defaultPlatformProductId = auditTrailProduct.id;

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
> = (input: {
  planId: PricingPlanId;
  productId: string;
}) => ProductPlanEntitlement<TFeatureKey, TMeterKey>;

export interface PlatformEntitlementSummary<
  TFeatureKey extends string = string,
  TMeterKey extends string = string
> {
  features: readonly TFeatureKey[];
  meterUsage: ReadonlyArray<{
    includedUnits: number | null;
    kind: UsageLimit<TMeterKey>["kind"];
    meterKey: TMeterKey;
    productId: string;
    remainingUnits: number | null;
    usedUnits: number;
  }>;
  organizationId: string;
  periodEnd: string;
  periodStart: string;
  planId: PricingPlanId;
  productId: string;
  usedDefaultPlan: boolean;
  usageLimits: readonly UsageLimit<TMeterKey>[];
}

export interface PlatformMeterEntitlementEvaluation<
  TFeatureKey extends string = string,
  TMeterKey extends string = string
> {
  decision: EntitlementDecision<TFeatureKey, TMeterKey>;
  summary: PlatformEntitlementSummary<TFeatureKey, TMeterKey>;
}

export interface PlatformEntitlementService<
  TFeatureKey extends string = string,
  TMeterKey extends string = string
> {
  canConsumeMeter(input: {
    meterKey: TMeterKey;
    organizationId: string;
    productId?: string;
    quantity: number;
  }): Promise<EntitlementDecision<TFeatureKey, TMeterKey>>;
  canUseFeature(input: {
    featureKey: TFeatureKey;
    organizationId: string;
    productId?: string;
  }): Promise<EntitlementDecision<TFeatureKey, TMeterKey>>;
  evaluateMeterEntitlement(input: {
    meterKey: TMeterKey;
    organizationId: string;
    productId?: string;
    quantity: number;
  }): Promise<PlatformMeterEntitlementEvaluation<TFeatureKey, TMeterKey>>;
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

export function defaultPlatformEntitlementPlanResolver(input: {
  planId: PricingPlanId;
  productId: string;
}): ProductPlanEntitlement<string, string> {
  const plan = getPricingPlan(input.planId);

  return {
    entitlement: {
      features: [],
      usageLimits: [
        {
          includedUnits: plan.includedEvents,
          kind: "limited",
          meterKey: defaultPlatformMeterKey
        }
      ]
    },
    productId: input.productId
  };
}

export function createPlatformEntitlementService<
  TFeatureKey extends string = string,
  TMeterKey extends string = string
>(
  repo: PlatformEntitlementRepo<TMeterKey>,
  options: {
    defaultPlanId?: PricingPlanId;
    defaultProductId?: string;
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
  const defaultProductId = options.defaultProductId ?? defaultPlatformProductId;
  const resolvePlanEntitlement =
    options.resolvePlanEntitlement ??
    (defaultPlatformEntitlementPlanResolver as PlatformEntitlementPlanResolver<
      TFeatureKey,
      TMeterKey
    >);
  const evaluateMeterEntitlement = async (input: {
    meterKey: TMeterKey;
    organizationId: string;
    productId?: string;
    quantity: number;
  }) => {
    const quantity = quantitySchema.parse(input.quantity);
    const meterKey = meterKeySchema.parse(input.meterKey) as TMeterKey;
    const state = await loadEntitlementState(
      repo,
      resolvePlanEntitlement,
      defaultPlanId,
      input.productId ?? defaultProductId,
      organizationIdSchema.parse(input.organizationId),
      now
    );

    return {
      decision: evaluateMeterConsumption({
        entitlement: state.entitlement.entitlement,
        meterKey,
        requestedUnits: quantity,
        usedUnits: state.meterUsageByMeterKey.get(meterKey) ?? 0
      }),
      summary: summarizeLoadedEntitlements(state)
    };
  };

  return {
    async canConsumeMeter(input) {
      const evaluation = await evaluateMeterEntitlement(input);

      return evaluation.decision;
    },
    async canUseFeature(input) {
      const featureKey = featureKeySchema.parse(input.featureKey) as TFeatureKey;
      const state = await loadEntitlementState(
        repo,
        resolvePlanEntitlement,
        defaultPlanId,
        input.productId ?? defaultProductId,
        organizationIdSchema.parse(input.organizationId),
        now
      );

      return evaluateFeatureUsage({
        entitlement: state.entitlement.entitlement,
        featureKey
      });
    },
    async evaluateMeterEntitlement(input) {
      return evaluateMeterEntitlement(input);
    },
    async getEntitlementSummary(organizationId) {
      const state = await loadEntitlementState(
        repo,
        resolvePlanEntitlement,
        defaultPlanId,
        defaultProductId,
        organizationIdSchema.parse(organizationId),
        now
      );
      return summarizeLoadedEntitlements(state);
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
  productId: string,
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
    entitlement: resolvePlanEntitlement({
      planId,
      productId
    }),
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
    productId,
    usedDefaultPlan: snapshot.planId === undefined
  };
}

function summarizeLoadedEntitlements<
  TFeatureKey extends string,
  TMeterKey extends string
>(
  state: Awaited<
    ReturnType<typeof loadEntitlementState<TFeatureKey, TMeterKey>>
  >
): PlatformEntitlementSummary<TFeatureKey, TMeterKey> {
  const summarized = summarizeEntitlements(state.entitlement.entitlement);

  return {
    features: summarized.features,
    meterUsage: summarized.usageLimits.map((usageLimit) => {
      const usedUnits = state.meterUsageByMeterKey.get(usageLimit.meterKey) ?? 0;

      if (usageLimit.kind === "unlimited") {
        return {
          includedUnits: null,
          kind: usageLimit.kind,
          meterKey: usageLimit.meterKey,
          productId: state.productId,
          remainingUnits: null,
          usedUnits
        };
      }

      return {
        includedUnits: usageLimit.includedUnits,
        kind: usageLimit.kind,
        meterKey: usageLimit.meterKey,
        productId: state.productId,
        remainingUnits: Math.max(usageLimit.includedUnits - usedUnits, 0),
        usedUnits
      };
    }),
    organizationId: state.organizationId,
    periodEnd: state.periodEnd,
    periodStart: state.periodStart,
    planId: state.planId,
    productId: state.productId,
    usageLimits: summarized.usageLimits,
    usedDefaultPlan: state.usedDefaultPlan
  };
}
