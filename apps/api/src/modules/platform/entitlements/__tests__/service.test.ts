import { describe, expect, it } from "vitest";

import {
  createPlatformEntitlementService,
  defaultPlatformEntitlementPlanResolver,
  OrganizationNotFoundError,
  type OrganizationEntitlementSnapshot,
  type PlatformEntitlementPlanResolver,
  type PlatformEntitlementRepo
} from "../service.js";

describe("createPlatformEntitlementService", () => {
  const planResolver: PlatformEntitlementPlanResolver<
    "exports" | "sso",
    "events" | "seats"
  > = (planId) => {
    if (planId === "growth") {
      return {
        features: ["exports", "sso"],
        usageLimits: [
          {
            includedUnits: 500,
            kind: "limited",
            meterKey: "events"
          },
          {
            kind: "unlimited",
            meterKey: "seats"
          }
        ]
      };
    }

    return {
      features: ["exports"],
      usageLimits: [
        {
          includedUnits: 100,
          kind: "limited",
          meterKey: "events"
        }
      ]
    };
  };

  it("allows an included feature", async () => {
    const service = createPlatformEntitlementService(
      createInMemoryEntitlementRepo({
        "org-1": {
          meterUsage: [],
          organizationId: "org-1",
          planId: "growth"
        }
      }),
      { resolvePlanEntitlement: planResolver }
    );

    await expect(
      service.canUseFeature({
        featureKey: "sso",
        organizationId: "org-1"
      })
    ).resolves.toEqual({
      featureKey: "sso",
      includedUnits: null,
      remainingUnits: null,
      status: "allowed"
    });
  });

  it("denies a feature that is not in the plan", async () => {
    const service = createPlatformEntitlementService(
      createInMemoryEntitlementRepo({
        "org-1": {
          meterUsage: [],
          organizationId: "org-1",
          planId: "starter"
        }
      }),
      { resolvePlanEntitlement: planResolver }
    );

    await expect(
      service.canUseFeature({
        featureKey: "sso",
        organizationId: "org-1"
      })
    ).resolves.toEqual({
      featureKey: "sso",
      status: "denied_feature_not_in_plan"
    });
  });

  it("allows meter consumption within the plan limit", async () => {
    const service = createPlatformEntitlementService(
      createInMemoryEntitlementRepo({
        "org-1": {
          meterUsage: [
            {
              meterKey: "events",
              usedUnits: 90
            }
          ],
          organizationId: "org-1",
          planId: "starter"
        }
      }),
      { resolvePlanEntitlement: planResolver }
    );

    await expect(
      service.canConsumeMeter({
        meterKey: "events",
        organizationId: "org-1",
        quantity: 10
      })
    ).resolves.toEqual({
      includedUnits: 100,
      meterKey: "events",
      remainingUnits: 10,
      requestedUnits: 10,
      status: "allowed",
      usedUnits: 90
    });
  });

  it("denies meter consumption over the plan limit", async () => {
    const service = createPlatformEntitlementService(
      createInMemoryEntitlementRepo({
        "org-1": {
          meterUsage: [
            {
              meterKey: "events",
              usedUnits: 98
            }
          ],
          organizationId: "org-1",
          planId: "starter"
        }
      }),
      { resolvePlanEntitlement: planResolver }
    );

    await expect(
      service.canConsumeMeter({
        meterKey: "events",
        organizationId: "org-1",
        quantity: 5
      })
    ).resolves.toEqual({
      includedUnits: 100,
      meterKey: "events",
      remainingUnits: 2,
      requestedUnits: 5,
      status: "denied_meter_limit_exceeded",
      usedUnits: 98
    });
  });

  it("throws when the organization is missing", async () => {
    const service = createPlatformEntitlementService(
      createInMemoryEntitlementRepo({})
    );

    await expect(
      service.getEntitlementSummary("missing-org")
    ).rejects.toBeInstanceOf(OrganizationNotFoundError);
  });

  it("falls back to the default starter plan when the organization has no plan id", async () => {
    const service = createPlatformEntitlementService(
      createInMemoryEntitlementRepo({
        "org-1": {
          meterUsage: [
            {
              meterKey: "events",
              usedUnits: 25
            }
          ],
          organizationId: "org-1"
        }
      }),
      {
        now: () => new Date("2026-06-26T12:00:00.000Z"),
        resolvePlanEntitlement: defaultPlatformEntitlementPlanResolver
      }
    );

    await expect(service.getEntitlementSummary("org-1")).resolves.toEqual({
      features: [],
      meterUsage: [
        {
          includedUnits: 100_000,
          kind: "limited",
          meterKey: "events",
          remainingUnits: 99_975,
          usedUnits: 25
        }
      ],
      organizationId: "org-1",
      periodEnd: "2026-07-01T00:00:00.000Z",
      periodStart: "2026-06-01T00:00:00.000Z",
      planId: "starter",
      usageLimits: [
        {
          includedUnits: 100_000,
          kind: "limited",
          meterKey: "events"
        }
      ],
      usedDefaultPlan: true
    });
  });
});

function createInMemoryEntitlementRepo(
  snapshots: Record<string, OrganizationEntitlementSnapshot<string>>
): PlatformEntitlementRepo<string> {
  return {
    async getOrganizationEntitlementSnapshot(input) {
      return snapshots[input.organizationId];
    }
  };
}
