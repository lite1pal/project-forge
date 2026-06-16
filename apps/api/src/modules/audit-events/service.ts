import type { IngestAuditEventInput } from "@auditrail/domain/audit-events";

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

export function createAuditEventService(repo: AuditEventRepo): AuditEventService {
  return {
    ingest(tenant, input) {
      return repo.append(tenant, input);
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
