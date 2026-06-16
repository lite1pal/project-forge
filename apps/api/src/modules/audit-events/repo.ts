import type { IngestAuditEventInput } from "@auditrail/domain/audit-events";
import { randomUUID } from "node:crypto";

export interface AuditEventRecord {
  id: string;
  eventType: string;
  actorId?: string;
  targetId?: string;
  metadata: Record<string, unknown>;
}

export interface AuditEventTenant {
  organizationId: string;
  projectId: string;
}

export interface AuditEventRepo {
  append(
    tenant: AuditEventTenant,
    input: IngestAuditEventInput
  ): Promise<AuditEventRecord>;
  listRecent(tenant: AuditEventTenant, limit: number): Promise<AuditEventRecord[]>;
}

export function createInMemoryAuditEventRepo(): AuditEventRepo {
  const events: AuditEventRecord[] = [];

  return {
    async append(_tenant, input) {
      const record = {
        id: randomUUID(),
        eventType: input.event,
        actorId: input.actor,
        targetId: input.target,
        metadata: input.metadata
      };

      events.push(record);

      return record;
    },
    async listRecent(_tenant, limit) {
      return [...events].reverse().slice(0, limit);
    }
  };
}
