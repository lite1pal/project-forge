import { describe, expect, it } from "vitest";

import {
  canConsumeMeter,
  canUseFeature,
  entitlementDecisionSchema,
  planEntitlementSchema,
  summarizeEntitlements
} from "../index.js";

describe("entitlements domain", () => {
  const entitlement = {
    features: ["exports", "sso"],
    usageLimits: [
      {
        includedUnits: 100,
        meterKey: "projects",
        kind: "limited"
      },
      {
        meterKey: "users",
        kind: "unlimited"
      }
    ]
  } as const;

  it("allows access to an included feature", () => {
    expect(
      canUseFeature({
        entitlement,
        featureKey: "exports"
      })
    ).toEqual({
      featureKey: "exports",
      includedUnits: null,
      remainingUnits: null,
      status: "allowed"
    });
  });

  it("denies a feature that is not in the plan", () => {
    expect(
      canUseFeature({
        entitlement,
        featureKey: "rbac"
      })
    ).toEqual({
      featureKey: "rbac",
      status: "denied_feature_not_in_plan"
    });
  });

  it("allows meter consumption within the included limit", () => {
    expect(
      canConsumeMeter({
        entitlement,
        meterKey: "projects",
        requestedUnits: 5,
        usedUnits: 90
      })
    ).toEqual({
      includedUnits: 100,
      meterKey: "projects",
      remainingUnits: 10,
      requestedUnits: 5,
      status: "allowed",
      usedUnits: 90
    });
  });

  it("denies meter consumption once the limit is exceeded", () => {
    expect(
      canConsumeMeter({
        entitlement,
        meterKey: "projects",
        requestedUnits: 5,
        usedUnits: 98
      })
    ).toEqual({
      includedUnits: 100,
      meterKey: "projects",
      remainingUnits: 2,
      requestedUnits: 5,
      status: "denied_meter_limit_exceeded",
      usedUnits: 98
    });
  });

  it("allows unlimited meter consumption", () => {
    expect(
      canConsumeMeter({
        entitlement,
        meterKey: "users",
        requestedUnits: 1_000,
        usedUnits: 50_000
      })
    ).toEqual({
      includedUnits: null,
      meterKey: "users",
      remainingUnits: null,
      requestedUnits: 1_000,
      status: "allowed",
      usedUnits: 50_000
    });
  });

  it("summarizes entitlement content with stable ordering", () => {
    expect(
      summarizeEntitlements({
        features: ["sso", "exports", "exports"],
        usageLimits: [
          { meterKey: "users", kind: "unlimited" },
          { includedUnits: 100, meterKey: "projects", kind: "limited" }
        ]
      })
    ).toEqual({
      features: ["exports", "sso"],
      usageLimits: [
        { includedUnits: 100, meterKey: "projects", kind: "limited" },
        { meterKey: "users", kind: "unlimited" }
      ]
    });
  });

  it("rejects invalid schema input", () => {
    expect(() =>
      planEntitlementSchema.parse({
        features: [""],
        usageLimits: [
          {
            includedUnits: -1,
            meterKey: "",
            kind: "limited"
          }
        ]
      })
    ).toThrow();
  });

  it("validates decision schema for allowed meter decisions", () => {
    expect(
      entitlementDecisionSchema.parse({
        includedUnits: 100,
        meterKey: "projects",
        remainingUnits: 10,
        requestedUnits: 5,
        status: "allowed",
        usedUnits: 90
      })
    ).toEqual({
      includedUnits: 100,
      meterKey: "projects",
      remainingUnits: 10,
      requestedUnits: 5,
      status: "allowed",
      usedUnits: 90
    });
  });
});
