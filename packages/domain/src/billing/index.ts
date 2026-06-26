import { z } from "zod";

const nonEmptyStringSchema = z.string().trim().min(1);
const optionalTimestampSchema = nonEmptyStringSchema.optional();

export const billingProviders = ["stripe"] as const;
export type BillingProvider = (typeof billingProviders)[number];

export const billingIntervals = ["month", "year"] as const;
export type BillingInterval = (typeof billingIntervals)[number];

export const billingStatuses = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "unpaid"
] as const;
export type BillingStatus = (typeof billingStatuses)[number];

export interface BillingCustomer<
  TProvider extends BillingProvider = BillingProvider,
  TSubjectId extends string = string
> {
  email?: string;
  id: string;
  provider: TProvider;
  providerCustomerId: string;
  subjectId: TSubjectId;
}

export interface BillingPlan<
  TPlanId extends string = string,
  TEntitlementPlanId extends string = string,
  TProvider extends BillingProvider = BillingProvider
> {
  entitlementPlanId: TEntitlementPlanId;
  id: TPlanId;
  name: string;
  provider: TProvider;
  providerProductId?: string;
}

export interface BillingPrice<
  TPlanId extends string = string,
  TProvider extends BillingProvider = BillingProvider
> {
  currency: string;
  id: string;
  interval: BillingInterval;
  planId: TPlanId;
  provider: TProvider;
  providerPriceId: string;
  providerProductId?: string;
  unitAmountMinor: number;
}

export interface BillingSubscription<
  TPlanId extends string = string,
  TProvider extends BillingProvider = BillingProvider
> {
  cancelAt?: string;
  canceledAt?: string;
  currentPeriodEnd?: string;
  currentPeriodStart?: string;
  customerId: string;
  id: string;
  planId: TPlanId;
  priceId: string;
  provider: TProvider;
  providerSubscriptionId: string;
  status: BillingStatus;
  trialEndsAt?: string;
}

export interface BillingCheckoutIntent<
  TPlanId extends string = string,
  TProvider extends BillingProvider = BillingProvider
> {
  billingCustomerId?: string;
  cancelUrl: string;
  planId: TPlanId;
  priceId: string;
  provider: TProvider;
  successUrl: string;
}

export interface BillingPortalIntent<
  TProvider extends BillingProvider = BillingProvider
> {
  billingCustomerId: string;
  provider: TProvider;
  returnUrl: string;
}

export interface BillingPlanEntitlementLink<
  TPlanId extends string = string,
  TEntitlementPlanId extends string = string
> {
  billingPlanId: TPlanId;
  entitlementPlanId: TEntitlementPlanId;
}

export const billingProviderSchema = z.enum(billingProviders);
export const billingIntervalSchema = z.enum(billingIntervals);
export const billingStatusSchema = z.enum(billingStatuses);

export const billingCustomerSchema = z.object({
  email: z.string().trim().email().optional(),
  id: nonEmptyStringSchema,
  provider: billingProviderSchema,
  providerCustomerId: nonEmptyStringSchema,
  subjectId: nonEmptyStringSchema
}) satisfies z.ZodType<BillingCustomer>;

export const billingPlanSchema = z.object({
  entitlementPlanId: nonEmptyStringSchema,
  id: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  provider: billingProviderSchema,
  providerProductId: nonEmptyStringSchema.optional()
}) satisfies z.ZodType<BillingPlan>;

export const billingPriceSchema = z.object({
  currency: z.string().trim().length(3),
  id: nonEmptyStringSchema,
  interval: billingIntervalSchema,
  planId: nonEmptyStringSchema,
  provider: billingProviderSchema,
  providerPriceId: nonEmptyStringSchema,
  providerProductId: nonEmptyStringSchema.optional(),
  unitAmountMinor: z.number().int().nonnegative()
}) satisfies z.ZodType<BillingPrice>;

export const billingSubscriptionSchema = z.object({
  cancelAt: optionalTimestampSchema,
  canceledAt: optionalTimestampSchema,
  currentPeriodEnd: optionalTimestampSchema,
  currentPeriodStart: optionalTimestampSchema,
  customerId: nonEmptyStringSchema,
  id: nonEmptyStringSchema,
  planId: nonEmptyStringSchema,
  priceId: nonEmptyStringSchema,
  provider: billingProviderSchema,
  providerSubscriptionId: nonEmptyStringSchema,
  status: billingStatusSchema,
  trialEndsAt: optionalTimestampSchema
}) satisfies z.ZodType<BillingSubscription>;

export const billingCheckoutIntentSchema = z.object({
  billingCustomerId: nonEmptyStringSchema.optional(),
  cancelUrl: z.url(),
  planId: nonEmptyStringSchema,
  priceId: nonEmptyStringSchema,
  provider: billingProviderSchema,
  successUrl: z.url()
}) satisfies z.ZodType<BillingCheckoutIntent>;

export const billingPortalIntentSchema = z.object({
  billingCustomerId: nonEmptyStringSchema,
  provider: billingProviderSchema,
  returnUrl: z.url()
}) satisfies z.ZodType<BillingPortalIntent>;

export const billingPlanEntitlementLinkSchema = z.object({
  billingPlanId: nonEmptyStringSchema,
  entitlementPlanId: nonEmptyStringSchema
}) satisfies z.ZodType<BillingPlanEntitlementLink>;

export function linkBillingPlanToEntitlementPlan<
  TPlanId extends string,
  TEntitlementPlanId extends string
>(
  plan: BillingPlan<TPlanId, TEntitlementPlanId>
): BillingPlanEntitlementLink<TPlanId, TEntitlementPlanId> {
  return {
    billingPlanId: plan.id,
    entitlementPlanId: plan.entitlementPlanId
  };
}
