import { describe, expect, it } from "vitest";

import { createPlatformSupportService } from "../service.js";

describe("createPlatformSupportService", () => {
  it("searches organizations with capped query limits", async () => {
    const repo = createInMemorySupportRepo({
      membersByOrganizationId: {
        "org-1": [
          {
            email: "owner@example.com",
            id: "user-1",
            role: "owner"
          },
          {
            email: "admin@example.com",
            id: "user-2",
            role: "admin"
          }
        ],
        "org-2": [
          {
            email: "viewer@example.com",
            id: "user-3",
            role: "viewer"
          }
        ]
      },
      organizations: [
        {
          createdAt: "2026-06-26T12:00:00.000Z",
          id: "org-1",
          name: "Acme"
        },
        {
          createdAt: "2026-06-26T12:10:00.000Z",
          id: "org-2",
          name: "Acme Labs"
        }
      ]
    });
    const service = createPlatformSupportService(repo, createSupportDependencies());

    await expect(
      service.searchOrganizations({
        limit: 99,
        query: "acme"
      })
    ).resolves.toEqual([
      {
        createdAt: "2026-06-26T12:00:00.000Z",
        id: "org-1",
        memberCount: 2,
        name: "Acme",
        ownerEmails: ["owner@example.com"]
      },
      {
        createdAt: "2026-06-26T12:10:00.000Z",
        id: "org-2",
        memberCount: 1,
        name: "Acme Labs",
        ownerEmails: []
      }
    ]);
    expect(repo.searchLimits).toEqual([20]);
  });

  it("searches organizations with the default query limit", async () => {
    const repo = createInMemorySupportRepo({
      organizations: [
        {
          createdAt: "2026-06-26T12:00:00.000Z",
          id: "org-1",
          name: "Acme"
        }
      ]
    });
    const service = createPlatformSupportService(repo, createSupportDependencies());

    await expect(
      service.searchOrganizations({
        query: "acme"
      })
    ).resolves.toEqual([
      {
        createdAt: "2026-06-26T12:00:00.000Z",
        id: "org-1",
        memberCount: 0,
        name: "Acme",
        ownerEmails: []
      }
    ]);
    expect(repo.searchLimits).toEqual([10]);
  });

  it("rejects short support queries", async () => {
    const service = createPlatformSupportService(
      createInMemorySupportRepo(),
      createSupportDependencies()
    );

    await expect(
      service.searchOrganizations({
        query: "ac"
      })
    ).rejects.toThrow("invalid_support_query");
  });

  it("returns a safe organization detail summary", async () => {
    const service = createPlatformSupportService(
      createInMemorySupportRepo({
        billingCustomer: {
          createdAt: "2026-06-26T12:01:00.000Z",
          id: "customer-1",
          organizationId: "org-1",
          provider: "stripe",
          providerCustomerId: "cus_123",
          updatedAt: "2026-06-26T12:02:00.000Z"
        },
        membersByOrganizationId: {
          "org-1": [
            {
              email: "owner@example.com",
              id: "user-1",
              name: "Casey Owner",
              role: "owner"
            },
            {
              email: "admin@example.com",
              id: "user-2",
              name: "Avery Admin",
              role: "admin"
            }
          ]
        },
        organization: {
          createdAt: "2026-06-26T12:00:00.000Z",
          id: "org-1",
          name: "Acme"
        },
        subscription: {
          billingCustomerId: "customer-1",
          billingPlanId: "billing-growth-monthly",
          cancelAtPeriodEnd: false,
          createdAt: "2026-06-26T12:03:00.000Z",
          entitlementPlanId: "growth",
          id: "subscription-1",
          organizationId: "org-1",
          provider: "stripe",
          providerPriceId: "price_123",
          providerSubscriptionId: "sub_123",
          status: "active",
          updatedAt: "2026-06-26T12:04:00.000Z"
        }
      }),
      createSupportDependencies({
        billingCustomer: {
          createdAt: "2026-06-26T12:01:00.000Z",
          id: "customer-1",
          organizationId: "org-1",
          provider: "stripe",
          providerCustomerId: "cus_123",
          updatedAt: "2026-06-26T12:02:00.000Z"
        },
        subscription: {
          billingCustomerId: "customer-1",
          billingPlanId: "billing-growth-monthly",
          cancelAtPeriodEnd: false,
          createdAt: "2026-06-26T12:03:00.000Z",
          entitlementPlanId: "growth",
          id: "subscription-1",
          organizationId: "org-1",
          provider: "stripe",
          providerPriceId: "price_123",
          providerSubscriptionId: "sub_123",
          status: "active",
          updatedAt: "2026-06-26T12:04:00.000Z"
        }
      })
    );

    const detail = await service.getOrganizationDetail("org-1");

    expect(detail).toMatchObject({
      adminEmails: ["admin@example.com"],
      billing: {
        customer: {
          createdAt: "2026-06-26T12:01:00.000Z",
          id: "customer-1",
          provider: "stripe",
          updatedAt: "2026-06-26T12:02:00.000Z"
        },
        subscription: {
          billingPlanId: "billing-growth-monthly",
          cancelAtPeriodEnd: false,
          createdAt: "2026-06-26T12:03:00.000Z",
          entitlementPlanId: "growth",
          id: "subscription-1",
          provider: "stripe",
          status: "active",
          updatedAt: "2026-06-26T12:04:00.000Z"
        }
      },
      createdAt: "2026-06-26T12:00:00.000Z",
      entitlement: {
        organizationId: "org-1",
        planId: "starter"
      },
      id: "org-1",
      memberCount: 2,
      name: "Acme",
      ownerEmails: ["owner@example.com"]
    });
    expect(JSON.stringify(detail)).not.toContain("providerCustomerId");
    expect(JSON.stringify(detail)).not.toContain("providerSubscriptionId");
  });

  it("returns null billing summaries when no billing records exist", async () => {
    const service = createPlatformSupportService(
      createInMemorySupportRepo({
        membersByOrganizationId: {
          "org-1": []
        },
        organization: {
          createdAt: "2026-06-26T12:00:00.000Z",
          id: "org-1",
          name: "Acme"
        }
      }),
      createSupportDependencies()
    );

    await expect(service.getOrganizationDetail("org-1")).resolves.toMatchObject({
      billing: {
        customer: null,
        subscription: null
      }
    });
  });

  it("rejects missing organizations", async () => {
    const service = createPlatformSupportService(
      createInMemorySupportRepo(),
      createSupportDependencies()
    );

    await expect(service.getOrganizationDetail("missing-org")).rejects.toThrow(
      "organization_not_found"
    );
  });
});

function createSupportDependencies(options: {
  billingCustomer?: {
    createdAt: string;
    id: string;
    organizationId: string;
    provider: "stripe";
    providerCustomerId: string;
    updatedAt: string;
  };
  subscription?: {
    billingCustomerId: string;
    billingPlanId: string;
    cancelAtPeriodEnd: boolean;
    createdAt: string;
    entitlementPlanId: string;
    id: string;
    organizationId: string;
    provider: "stripe";
    providerPriceId: string;
    providerSubscriptionId: string;
    status: "active";
    updatedAt: string;
  };
} = {}) {
  return {
    billingRepo: {
      async findBillingCustomerByOrganization() {
        return options.billingCustomer;
      },
      async findCurrentSubscriptionByOrganization() {
        return options.subscription;
      }
    },
    entitlementService: {
      async getEntitlementSummary(organizationId: string) {
        return {
          features: [],
          meterUsage: [],
          organizationId,
          periodEnd: "2026-07-01T00:00:00.000Z",
          periodStart: "2026-06-01T00:00:00.000Z",
          planId: "starter" as const,
          productId: "audit-events",
          usedDefaultPlan: true,
          usageLimits: []
        };
      }
    }
  };
}

function createInMemorySupportRepo(options: {
  billingCustomer?: {
    createdAt: string;
    id: string;
    organizationId: string;
    provider: "stripe";
    providerCustomerId: string;
    updatedAt: string;
  };
  membersByOrganizationId?: Record<
    string,
    Array<{
      email: string;
      id: string;
      name?: string;
      role: "admin" | "member" | "owner" | "viewer";
    }>
  >;
  organization?: {
    createdAt: string;
    id: string;
    name: string;
  };
  organizations?: Array<{
    createdAt: string;
    id: string;
    name: string;
  }>;
  searchResults?: Array<{
    createdAt: string;
    id: string;
    name: string;
  }>;
  subscription?: {
    billingCustomerId: string;
    billingPlanId: string;
    cancelAtPeriodEnd: boolean;
    createdAt: string;
    entitlementPlanId: string;
    id: string;
    organizationId: string;
    provider: "stripe";
    providerPriceId: string;
    providerSubscriptionId: string;
    status: "active";
    updatedAt: string;
  };
} = {}) {
  const searchLimits: number[] = [];
  const organizations = [...(options.organizations ?? options.searchResults ?? [])];

  return {
    searchLimits,
    async findOrganizationById(organizationId: string) {
      return (
        options.organization ??
        organizations.find((organization) => organization.id === organizationId)
      );
    },
    async listOrganizationMembers(organizationId: string) {
      return options.membersByOrganizationId?.[organizationId] ?? [];
    },
    async searchOrganizations(input: { limit: number; query: string }) {
      searchLimits.push(input.limit);
      return organizations.slice(0, input.limit);
    }
  };
}
