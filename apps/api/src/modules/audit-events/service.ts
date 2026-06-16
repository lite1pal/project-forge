import type { IngestAuditEventInput } from "@auditrail/domain/audit-events";

import type {
  AuditEventRecord,
  AuditEventRepo,
  AuditEventTenant
} from "./repo.js";

export interface AuditEventService {
  ingest(
    tenant: AuditEventTenant,
    input: IngestAuditEventInput
  ): Promise<AuditEventRecord>;
  listRecent(
    tenant: AuditEventTenant,
    limit: number
  ): Promise<AuditEventRecord[]>;
}

export function createAuditEventService(repo: AuditEventRepo): AuditEventService {
  return {
    ingest(tenant, input) {
      return repo.append(tenant, input);
    },
    listRecent(tenant, limit) {
      return repo.listRecent(tenant, limit);
    }
  };
}
