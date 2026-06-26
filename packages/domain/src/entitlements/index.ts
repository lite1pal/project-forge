import { z } from "zod";

const nonEmptyKeySchema = z.string().trim().min(1);

export const featureKeySchema = nonEmptyKeySchema;
export type FeatureKey = z.infer<typeof featureKeySchema>;

export const meterKeySchema = nonEmptyKeySchema;
export type MeterKey = z.infer<typeof meterKeySchema>;

export interface LimitedUsageLimit<TMeterKey extends string = string> {
  includedUnits: number;
  meterKey: TMeterKey;
  kind: "limited";
}

export interface UnlimitedUsageLimit<TMeterKey extends string = string> {
  meterKey: TMeterKey;
  kind: "unlimited";
}

export type UsageLimit<TMeterKey extends string = string> =
  | LimitedUsageLimit<TMeterKey>
  | UnlimitedUsageLimit<TMeterKey>;

export const usageLimitSchema = z.discriminatedUnion("kind", [
  z.object({
    includedUnits: z.number().int().nonnegative(),
    meterKey: meterKeySchema,
    kind: z.literal("limited")
  }),
  z.object({
    meterKey: meterKeySchema,
    kind: z.literal("unlimited")
  })
]) satisfies z.ZodType<UsageLimit>;

export interface PlanEntitlement<
  TFeatureKey extends string = string,
  TMeterKey extends string = string
> {
  features: readonly TFeatureKey[];
  usageLimits: readonly UsageLimit<TMeterKey>[];
}

export const planEntitlementSchema = z.object({
  features: z.array(featureKeySchema),
  usageLimits: z.array(usageLimitSchema)
}) satisfies z.ZodType<PlanEntitlement>;

export interface AllowedEntitlementDecision<
  TFeatureKey extends string = string,
  TMeterKey extends string = string
> {
  featureKey?: TFeatureKey;
  includedUnits: number | null;
  meterKey?: TMeterKey;
  remainingUnits: number | null;
  requestedUnits?: number;
  status: "allowed";
  usedUnits?: number;
}

export interface DeniedFeatureNotInPlanDecision<
  TFeatureKey extends string = string
> {
  featureKey: TFeatureKey;
  status: "denied_feature_not_in_plan";
}

export interface DeniedMeterNotInPlanDecision<TMeterKey extends string = string> {
  meterKey: TMeterKey;
  requestedUnits: number;
  status: "denied_meter_not_in_plan";
  usedUnits: number;
}

export interface DeniedMeterLimitExceededDecision<
  TMeterKey extends string = string
> {
  includedUnits: number;
  meterKey: TMeterKey;
  remainingUnits: number;
  requestedUnits: number;
  status: "denied_meter_limit_exceeded";
  usedUnits: number;
}

export type EntitlementDecision<
  TFeatureKey extends string = string,
  TMeterKey extends string = string
> =
  | AllowedEntitlementDecision<TFeatureKey, TMeterKey>
  | DeniedFeatureNotInPlanDecision<TFeatureKey>
  | DeniedMeterNotInPlanDecision<TMeterKey>
  | DeniedMeterLimitExceededDecision<TMeterKey>;

export const entitlementDecisionSchema = z.discriminatedUnion("status", [
  z.object({
    featureKey: featureKeySchema.optional(),
    includedUnits: z.number().int().nonnegative().nullable(),
    meterKey: meterKeySchema.optional(),
    remainingUnits: z.number().int().nonnegative().nullable(),
    requestedUnits: z.number().int().nonnegative().optional(),
    status: z.literal("allowed"),
    usedUnits: z.number().int().nonnegative().optional()
  }),
  z.object({
    featureKey: featureKeySchema,
    status: z.literal("denied_feature_not_in_plan")
  }),
  z.object({
    meterKey: meterKeySchema,
    requestedUnits: z.number().int().nonnegative(),
    status: z.literal("denied_meter_not_in_plan"),
    usedUnits: z.number().int().nonnegative()
  }),
  z.object({
    includedUnits: z.number().int().nonnegative(),
    meterKey: meterKeySchema,
    remainingUnits: z.number().int().nonnegative(),
    requestedUnits: z.number().int().nonnegative(),
    status: z.literal("denied_meter_limit_exceeded"),
    usedUnits: z.number().int().nonnegative()
  })
]) satisfies z.ZodType<EntitlementDecision>;

export interface EntitlementSummary<
  TFeatureKey extends string = string,
  TMeterKey extends string = string
> {
  features: readonly TFeatureKey[];
  usageLimits: readonly UsageLimit<TMeterKey>[];
}

export function canUseFeature<
  TPlanFeatureKey extends string,
  TRequestedFeatureKey extends string,
  TMeterKey extends string = string
>(input: {
  entitlement: PlanEntitlement<TPlanFeatureKey, TMeterKey>;
  featureKey: TRequestedFeatureKey;
}): EntitlementDecision<TRequestedFeatureKey, TMeterKey> {
  if (
    input.entitlement.features.some(
      (featureKey) => String(featureKey) === String(input.featureKey)
    )
  ) {
    return {
      featureKey: input.featureKey,
      includedUnits: null,
      remainingUnits: null,
      status: "allowed"
    };
  }

  return {
    featureKey: input.featureKey,
    status: "denied_feature_not_in_plan"
  };
}

export function canConsumeMeter<
  TFeatureKey extends string = string,
  TPlanMeterKey extends string = string,
  TRequestedMeterKey extends string = TPlanMeterKey
>(input: {
  entitlement: PlanEntitlement<TFeatureKey, TPlanMeterKey>;
  meterKey: TRequestedMeterKey;
  requestedUnits?: number;
  usedUnits: number;
}): EntitlementDecision<TFeatureKey, TRequestedMeterKey> {
  const requestedUnits = input.requestedUnits ?? 1;
  const usageLimit = input.entitlement.usageLimits.find(
    (limit) => String(limit.meterKey) === String(input.meterKey)
  );

  if (!usageLimit) {
    return {
      meterKey: input.meterKey,
      requestedUnits,
      status: "denied_meter_not_in_plan",
      usedUnits: input.usedUnits
    };
  }

  if (usageLimit.kind === "unlimited") {
    return {
      includedUnits: null,
      meterKey: input.meterKey,
      remainingUnits: null,
      requestedUnits,
      status: "allowed",
      usedUnits: input.usedUnits
    };
  }

  const remainingUnits = Math.max(
    usageLimit.includedUnits - input.usedUnits,
    0
  );

  if (remainingUnits < requestedUnits) {
    return {
      includedUnits: usageLimit.includedUnits,
      meterKey: input.meterKey,
      remainingUnits,
      requestedUnits,
      status: "denied_meter_limit_exceeded",
      usedUnits: input.usedUnits
    };
  }

  return {
    includedUnits: usageLimit.includedUnits,
    meterKey: input.meterKey,
    remainingUnits,
    requestedUnits,
    status: "allowed",
    usedUnits: input.usedUnits
  };
}

export function summarizeEntitlements<
  TFeatureKey extends string,
  TMeterKey extends string
>(
  entitlement: PlanEntitlement<TFeatureKey, TMeterKey>
): EntitlementSummary<TFeatureKey, TMeterKey> {
  return {
    features: [...new Set(entitlement.features)].sort(),
    usageLimits: [...entitlement.usageLimits].sort((left, right) =>
      left.meterKey.localeCompare(right.meterKey)
    )
  };
}
