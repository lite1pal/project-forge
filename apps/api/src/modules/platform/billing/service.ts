import {
  billingCheckoutIntentSchema,
  billingPortalIntentSchema,
  type BillingProvider
} from "@auditrail/domain/billing";
import { auditTrailProduct } from "@auditrail/domain/audit-events";

import {
  BillingCustomerNotFoundError
} from "./errors.js";
import {
  createBillingProviderRegistry,
  createNoopBillingProviderAdapter,
  createPlatformBillingRuntime,
  type BillingSessionLink,
  type PlatformBillingProviderAdapter,
  type PlatformBillingRuntime
} from "./provider.js";
import { assertRole, type Membership } from "../service.js";
import type { PlatformBillingRepo } from "./repo.js";

const defaultBillingProvider: BillingProvider = "stripe";

export interface BillingStatusSummary {
  customer: {
    createdAt: string;
    id: string;
    provider: BillingProvider;
    providerCustomerId: string;
    updatedAt: string;
  } | null;
  organizationId: string;
  providerConfigurationStatus: "configured" | "not_configured";
  subscription: {
    billingCustomerId: string;
    billingPlanId: string;
    cancelAtPeriodEnd: boolean;
    createdAt: string;
    currentPeriodEnd?: string;
    currentPeriodStart?: string;
    entitlementPlanId: string;
    id: string;
    provider: BillingProvider;
    providerPriceId: string;
    providerProductId?: string;
    providerSubscriptionId: string;
    status: string;
    updatedAt: string;
  } | null;
}

export interface PlatformBillingService {
  createCheckoutIntentForUser(input: {
    cancelUrl: string;
    organizationId: string;
    planId: string;
    priceId?: string;
    userEmail: string;
    successUrl: string;
    userId: string;
  }): Promise<BillingSessionLink>;
  createPortalIntentForUser(input: {
    organizationId: string;
    returnUrl: string;
    userId: string;
  }): Promise<BillingSessionLink>;
  getBillingStatusForUser(input: {
    organizationId: string;
    userId: string;
  }): Promise<BillingStatusSummary>;
}

export interface PlatformBillingServiceRepo
  extends Pick<
    PlatformBillingRepo,
    "findBillingCustomerByOrganization" | "findCurrentSubscriptionByOrganization"
  > {
  findMembership(input: {
    organizationId: string;
    userId: string;
  }): Promise<Membership | undefined>;
}

export function createPlatformBillingService(
  repo: PlatformBillingServiceRepo,
  options: {
    adapter?: PlatformBillingProviderAdapter;
    defaultProductId?: string;
    provider?: BillingProvider;
    runtime?: PlatformBillingRuntime;
  } = {}
): PlatformBillingService {
  const defaultProductId = options.defaultProductId ?? auditTrailProduct.id;
  const runtime =
    options.runtime ??
    createPlatformBillingRuntime({
      activeProvider: options.provider ?? defaultBillingProvider,
      registry: createBillingProviderRegistry([
        options.adapter ??
          createNoopBillingProviderAdapter(options.provider ?? defaultBillingProvider)
      ])
    });

  return {
    async createCheckoutIntentForUser(input) {
      const provider = runtime.getActiveProvider();
      const membership = await repo.findMembership({
        organizationId: input.organizationId,
        userId: input.userId
      });

      assertRole(membership, ["owner", "admin"]);
      billingCheckoutIntentSchema.parse({
        cancelUrl: input.cancelUrl,
        planId: input.planId,
        priceId: input.priceId,
        provider,
        successUrl: input.successUrl
      });
      const customer = await repo.findBillingCustomerByOrganization({
        organizationId: input.organizationId,
        provider
      });

      return runtime.createCheckoutSession({
        cancelUrl: input.cancelUrl,
        customerEmail: input.userEmail,
        organizationId: input.organizationId,
        planId: input.planId,
        priceId: input.priceId,
        productId: defaultProductId,
        providerCustomerId: customer?.providerCustomerId,
        successUrl: input.successUrl
      });
    },
    async createPortalIntentForUser(input) {
      const provider = runtime.getActiveProvider();
      const membership = await repo.findMembership({
        organizationId: input.organizationId,
        userId: input.userId
      });

      assertRole(membership, ["owner", "admin"]);
      const customer = await repo.findBillingCustomerByOrganization({
        organizationId: input.organizationId,
        provider
      });

      if (!customer) {
        throw new BillingCustomerNotFoundError();
      }

      billingPortalIntentSchema.parse({
        billingCustomerId: customer.providerCustomerId,
        provider,
        returnUrl: input.returnUrl
      });

      return runtime.createPortalSession({
        providerCustomerId: customer.providerCustomerId,
        returnUrl: input.returnUrl
      });
    },
    async getBillingStatusForUser(input) {
      const provider = runtime.getActiveProvider();
      const membership = await repo.findMembership({
        organizationId: input.organizationId,
        userId: input.userId
      });

      assertRole(membership, ["owner", "admin", "member", "viewer"]);
      const [customer, subscription] = await Promise.all([
        repo.findBillingCustomerByOrganization({
          organizationId: input.organizationId,
          provider
        }),
        repo.findCurrentSubscriptionByOrganization(input.organizationId)
      ]);

      return {
        customer: customer
          ? {
              createdAt: customer.createdAt,
              id: customer.id,
              provider: customer.provider,
              providerCustomerId: customer.providerCustomerId,
              updatedAt: customer.updatedAt
            }
          : null,
        organizationId: input.organizationId,
        providerConfigurationStatus: runtime.getConfigurationStatus(),
        subscription: subscription
          ? {
              billingCustomerId: subscription.billingCustomerId,
              billingPlanId: subscription.billingPlanId,
              cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
              createdAt: subscription.createdAt,
              currentPeriodEnd: subscription.currentPeriodEnd,
              currentPeriodStart: subscription.currentPeriodStart,
              entitlementPlanId: subscription.entitlementPlanId,
              id: subscription.id,
              provider: subscription.provider,
              providerPriceId: subscription.providerPriceId,
              providerProductId: subscription.providerProductId,
              providerSubscriptionId: subscription.providerSubscriptionId,
              status: subscription.status,
              updatedAt: subscription.updatedAt
            }
          : null
      };
    }
  };
}
