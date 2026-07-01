import {
  auditTrailProduct,
  type IngestAuditEventInput
} from "@auditrail/domain/audit-events";
import { getPricingPlan, type PricingUsageSummary } from "@auditrail/domain/pricing";

import type {
  AuditEventListFilters,
  AuditEventRecord,
  AuditEventRepo,
  AuditEventSummary,
  AuditEventSummaryFilters,
  AuditEventTimeseriesFilters,
  AuditEventTimeseriesPoint,
  AuditEventTenant
} from "./repo.js";
import {
  defaultPlatformMeterKey,
  type PlatformEntitlementService
} from "../platform/entitlements/service.js";
import { EventQuotaExceededError } from "./repo.js";

export interface AuditEventService {
  ingest(
    tenant: AuditEventTenant,
    input: IngestAuditEventInput
  ): Promise<AuditEventRecord>;
  list(
    tenant: AuditEventTenant,
    filters: AuditEventListFilters
  ): Promise<AuditEventRecord[]>;
  summarize(
    tenant: AuditEventTenant,
    filters: AuditEventSummaryFilters
  ): Promise<AuditEventSummary>;
  timeseries(
    tenant: AuditEventTenant,
    filters: AuditEventTimeseriesFilters
  ): Promise<AuditEventTimeseriesPoint[]>;
}

export { EventQuotaExceededError } from "./repo.js";

export function createAuditEventService(
  repo: AuditEventRepo,
  options: {
    entitlementService?: PlatformEntitlementService;
  } = {}
): AuditEventService {
  return {
    async ingest(tenant, input) {
      if (!options.entitlementService) {
        return repo.append(tenant, input);
      }

      const entitlement = await options.entitlementService.evaluateMeterEntitlement({
        meterKey: defaultPlatformMeterKey,
        organizationId: tenant.organizationId,
        productId: auditTrailProduct.id,
        quantity: 1
      });
      const quota = resolveEventQuota(entitlement.summary);

      if (entitlement.decision.status !== "allowed") {
        throw new EventQuotaExceededError(quota);
      }

      return repo.append(tenant, input, {
        quota
      });
    },
    list(tenant, filters) {
      return repo.list(tenant, filters);
    },
    summarize(tenant, filters) {
      return repo.summarize(tenant, filters);
    },
    timeseries(tenant, filters) {
      return repo.timeseries(tenant, filters);
    }
  };
}

function resolveEventQuota(
  summary: Awaited<ReturnType<PlatformEntitlementService["getEntitlementSummary"]>>
): PricingUsageSummary {
  const eventUsage = summary.meterUsage.find(
    (meterUsage) => meterUsage.meterKey === defaultPlatformMeterKey
  );
  const plan = getPricingPlan(summary.planId);

  return {
    id: summary.planId,
    includedEvents: eventUsage?.includedUnits ?? plan.includedEvents,
    name: plan.name,
    periodEnd: summary.periodEnd,
    periodStart: summary.periodStart,
    remainingEvents: eventUsage?.remainingUnits ?? 0,
    usedEvents: eventUsage?.usedUnits ?? 0
  };
}
