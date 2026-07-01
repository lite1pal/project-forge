import { describe, expect, it, vi } from "vitest";

import {
  createAuditEventService,
  EventQuotaExceededError
} from "../service.js";

describe("createAuditEventService", () => {
  it("appends directly when no entitlement service is configured", async () => {
    const repo = {
      append: vi.fn(async () => ({
        createdAt: "2026-06-16T12:00:00.000Z",
        eventType: "user.deleted",
        id: "event-1",
        metadata: {}
      })),
      list: vi.fn(),
      summarize: vi.fn(),
      timeseries: vi.fn()
    };
    const service = createAuditEventService(repo);

    await service.ingest(
      {
        organizationId: "org-1",
        projectId: "project-1"
      },
      {
        event: "user.deleted",
        metadata: {}
      }
    );

    expect(repo.append).toHaveBeenCalledWith(
      {
        organizationId: "org-1",
        projectId: "project-1"
      },
      {
        event: "user.deleted",
        metadata: {}
      }
    );
  });

  it("checks the events meter through the entitlement service before append", async () => {
    const repo = {
      append: vi.fn(async () => ({
        createdAt: "2026-06-16T12:00:00.000Z",
        eventType: "user.deleted",
        id: "event-1",
        metadata: {}
      })),
      list: vi.fn(),
      summarize: vi.fn(),
      timeseries: vi.fn()
    };
    const entitlementService = {
      canConsumeMeter: vi.fn(),
      canUseFeature: vi.fn(),
      evaluateMeterEntitlement: vi.fn(async () => ({
        decision: {
          includedUnits: 100_000,
          meterKey: "events",
          remainingUnits: 1,
          requestedUnits: 1,
          status: "allowed" as const,
          usedUnits: 99_999
        },
        summary: {
          features: [],
          meterUsage: [
            {
              includedUnits: 100_000,
              kind: "limited" as const,
              meterKey: "events",
              productId: "audit-events",
              remainingUnits: 1,
              usedUnits: 99_999
            }
          ],
          organizationId: "org-1",
          periodEnd: "2026-07-01T00:00:00.000Z",
          periodStart: "2026-06-01T00:00:00.000Z",
          planId: "starter" as const,
          productId: "audit-events",
          usageLimits: [
            {
              includedUnits: 100_000,
              kind: "limited" as const,
              meterKey: "events"
            }
          ],
          usedDefaultPlan: false
        }
      })),
      getEntitlementSummary: vi.fn()
    };
    const service = createAuditEventService(repo, {
      entitlementService
    });

    await service.ingest(
      {
        organizationId: "org-1",
        projectId: "project-1"
      },
      {
        event: "user.deleted",
        metadata: {}
      }
    );

    expect(entitlementService.evaluateMeterEntitlement).toHaveBeenCalledWith({
      meterKey: "events",
      organizationId: "org-1",
      productId: "audit-events",
      quantity: 1
    });
    expect(entitlementService.canConsumeMeter).not.toHaveBeenCalled();
    expect(entitlementService.getEntitlementSummary).not.toHaveBeenCalled();
    expect(repo.append).toHaveBeenCalledWith(
      {
        organizationId: "org-1",
        projectId: "project-1"
      },
      {
        event: "user.deleted",
        metadata: {}
      },
      {
        quota: {
          id: "starter",
          includedEvents: 100_000,
          name: "Starter",
          periodEnd: "2026-07-01T00:00:00.000Z",
          periodStart: "2026-06-01T00:00:00.000Z",
          remainingEvents: 1,
          usedEvents: 99_999
        }
      }
    );
  });

  it("maps denied entitlement decisions to the existing quota error", async () => {
    const service = createAuditEventService(
      {
        append: vi.fn(),
        list: vi.fn(),
        summarize: vi.fn(),
        timeseries: vi.fn()
      },
      {
        entitlementService: {
          canConsumeMeter: vi.fn(),
          canUseFeature: vi.fn(),
          evaluateMeterEntitlement: vi.fn(async () => ({
            decision: {
              includedUnits: 100_000,
              meterKey: "events",
              remainingUnits: 0,
              requestedUnits: 1,
              status: "denied_meter_limit_exceeded" as const,
              usedUnits: 100_000
            },
            summary: {
              features: [],
              meterUsage: [
                {
                  includedUnits: 100_000,
                  kind: "limited" as const,
                  meterKey: "events",
                  productId: "audit-events",
                  remainingUnits: 0,
                  usedUnits: 100_000
                }
              ],
              organizationId: "org-1",
              periodEnd: "2026-07-01T00:00:00.000Z",
              periodStart: "2026-06-01T00:00:00.000Z",
              planId: "starter" as const,
              productId: "audit-events",
              usageLimits: [
                {
                  includedUnits: 100_000,
                  kind: "limited" as const,
                  meterKey: "events"
                }
              ],
              usedDefaultPlan: false
            }
          })),
          getEntitlementSummary: vi.fn()
        }
      }
    );

    await expect(
      service.ingest(
        {
          organizationId: "org-1",
          projectId: "project-1"
        },
        {
          event: "user.deleted",
          metadata: {}
        }
      )
    ).rejects.toMatchObject({
      message: "event_quota_exceeded",
      plan: {
        id: "starter",
        includedEvents: 100_000,
        remainingEvents: 0,
        usedEvents: 100_000
      }
    });
  });

  it("passes through repo quota failures after an allowed entitlement check", async () => {
    const repoError = new EventQuotaExceededError({
      id: "starter",
      includedEvents: 100_000,
      name: "Starter",
      periodEnd: "2026-07-01T00:00:00.000Z",
      periodStart: "2026-06-01T00:00:00.000Z",
      remainingEvents: 0,
      usedEvents: 100_000
    });
    const service = createAuditEventService(
      {
        append: vi.fn(async () => {
          throw repoError;
        }),
        list: vi.fn(),
        summarize: vi.fn(),
        timeseries: vi.fn()
      },
      {
        entitlementService: {
          canConsumeMeter: vi.fn(),
          canUseFeature: vi.fn(),
          evaluateMeterEntitlement: vi.fn(async () => ({
            decision: {
              includedUnits: 100_000,
              meterKey: "events",
              remainingUnits: 1,
              requestedUnits: 1,
              status: "allowed" as const,
              usedUnits: 99_999
            },
            summary: {
              features: [],
              meterUsage: [
                {
                  includedUnits: 100_000,
                  kind: "limited" as const,
                  meterKey: "events",
                  productId: "audit-events",
                  remainingUnits: 1,
                  usedUnits: 99_999
                }
              ],
              organizationId: "org-1",
              periodEnd: "2026-07-01T00:00:00.000Z",
              periodStart: "2026-06-01T00:00:00.000Z",
              planId: "starter" as const,
              productId: "audit-events",
              usageLimits: [
                {
                  includedUnits: 100_000,
                  kind: "limited" as const,
                  meterKey: "events"
                }
              ],
              usedDefaultPlan: false
            }
          })),
          getEntitlementSummary: vi.fn()
        }
      }
    );

    await expect(
      service.ingest(
        {
          organizationId: "org-1",
          projectId: "project-1"
        },
        {
          event: "user.deleted",
          metadata: {}
        }
      )
    ).rejects.toBe(repoError);
  });

  it("falls back to the pricing plan shape when the entitlement summary omits the events meter", async () => {
    const repo = {
      append: vi.fn(async () => ({
        createdAt: "2026-06-16T12:00:00.000Z",
        eventType: "user.deleted",
        id: "event-1",
        metadata: {}
      })),
      list: vi.fn(),
      summarize: vi.fn(),
      timeseries: vi.fn()
    };
    const service = createAuditEventService(repo, {
      entitlementService: {
        canConsumeMeter: vi.fn(),
        canUseFeature: vi.fn(),
        evaluateMeterEntitlement: vi.fn(async () => ({
          decision: {
            includedUnits: 100_000,
            meterKey: "events",
            remainingUnits: 1,
            requestedUnits: 1,
            status: "allowed" as const,
            usedUnits: 99_999
          },
          summary: {
            features: [],
            meterUsage: [],
            organizationId: "org-1",
            periodEnd: "2026-07-01T00:00:00.000Z",
            periodStart: "2026-06-01T00:00:00.000Z",
            planId: "starter" as const,
            productId: "audit-events",
            usageLimits: [],
            usedDefaultPlan: false
          }
        })),
        getEntitlementSummary: vi.fn()
      }
    });

    await service.ingest(
      {
        organizationId: "org-1",
        projectId: "project-1"
      },
      {
        event: "user.deleted",
        metadata: {}
      }
    );

    expect(repo.append).toHaveBeenCalledWith(
      {
        organizationId: "org-1",
        projectId: "project-1"
      },
      {
        event: "user.deleted",
        metadata: {}
      },
      {
        quota: expect.objectContaining({
          includedEvents: 100_000,
          remainingEvents: 0,
          usedEvents: 0
        })
      }
    );
  });
});
