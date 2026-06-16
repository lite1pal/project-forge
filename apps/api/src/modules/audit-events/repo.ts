import type { IngestAuditEventInput } from "@auditrail/domain/audit-events";
import { randomUUID } from "node:crypto";

import { decodeAuditEventCursor } from "./cursor.js";

export interface AuditEventRecord {
  id: string;
  eventType: string;
  actorId?: string;
  targetId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditEventTenant {
  organizationId: string;
  projectId: string;
}

export interface AuditEventListFilters {
  limit: number;
  cursor?: string;
  eventTypes?: string[];
  actorIds?: string[];
  targetIds?: string[];
  from?: string;
  to?: string;
}

export interface AuditEventSummaryFilters {
  from?: string;
  to?: string;
  top: number;
}

export interface AuditEventSummary {
  totalEvents: number;
  topEventTypes: Array<{
    event: string;
    count: number;
  }>;
}

export interface AuditEventTimeseriesFilters {
  from: string;
  to: string;
  bucket: "hour" | "day";
}

export interface AuditEventTimeseriesPoint {
  bucketStart: string;
  count: number;
}

export interface InMemoryAuditEventRepoOptions {
  now?: () => string;
}

export interface AuditEventRepo {
  append(
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

export function createInMemoryAuditEventRepo(
  options: InMemoryAuditEventRepoOptions = {}
): AuditEventRepo {
  const events: AuditEventRecord[] = [];
  const now = options.now ?? (() => new Date().toISOString());

  return {
    async append(_tenant, input) {
      const record = {
        id: randomUUID(),
        eventType: input.event,
        actorId: input.actor,
        targetId: input.target,
        metadata: input.metadata,
        createdAt: now()
      };

      events.push(record);

      return record;
    },
    async list(_tenant, filters) {
      return [...events]
        .filter((event) => matchesEventFilters(event, filters))
        .sort(compareAuditEventsDesc)
        .filter((event) => {
          if (!filters.cursor) {
            return true;
          }

          const cursor = decodeAuditEventCursor(filters.cursor);

          if (event.createdAt < cursor.createdAt) {
            return true;
          }

          if (event.createdAt > cursor.createdAt) {
            return false;
          }

          return event.id < cursor.id;
        })
        .slice(0, filters.limit);
    },
    async summarize(_tenant, filters) {
      const filteredEvents = events.filter((event) =>
        matchesEventFilters(event, filters)
      );
      const eventCounts = new Map<string, number>();

      for (const event of filteredEvents) {
        eventCounts.set(event.eventType, (eventCounts.get(event.eventType) ?? 0) + 1);
      }

      return {
        totalEvents: filteredEvents.length,
        topEventTypes: [...eventCounts.entries()]
          .map(([event, count]) => ({
            event,
            count
          }))
          .sort((left, right) => {
            if (left.count === right.count) {
              return left.event.localeCompare(right.event);
            }

            return right.count - left.count;
          })
          .slice(0, filters.top)
      };
    },
    async timeseries(_tenant, filters) {
      const filteredEvents = events.filter((event) =>
        matchesEventFilters(event, filters)
      );
      const counts = new Map<string, number>();

      for (const event of filteredEvents) {
        const bucketStart = truncateIsoDate(event.createdAt, filters.bucket);
        counts.set(bucketStart, (counts.get(bucketStart) ?? 0) + 1);
      }

      return [...counts.entries()]
        .map(([bucketStart, count]) => ({
          bucketStart,
          count
        }))
        .sort((left, right) => left.bucketStart.localeCompare(right.bucketStart));
    }
  };
}

function compareAuditEventsDesc(left: AuditEventRecord, right: AuditEventRecord) {
  if (left.createdAt === right.createdAt) {
    return right.id.localeCompare(left.id);
  }

  return right.createdAt.localeCompare(left.createdAt);
}

function matchesEventFilters(
  event: AuditEventRecord,
  filters: {
    eventTypes?: string[];
    actorIds?: string[];
    targetIds?: string[];
    from?: string;
    to?: string;
  }
) {
  if (
    filters.eventTypes &&
    filters.eventTypes.length > 0 &&
    !filters.eventTypes.includes(event.eventType)
  ) {
    return false;
  }

  if (
    filters.actorIds &&
    filters.actorIds.length > 0 &&
    !filters.actorIds.includes(event.actorId ?? "")
  ) {
    return false;
  }

  if (
    filters.targetIds &&
    filters.targetIds.length > 0 &&
    !filters.targetIds.includes(event.targetId ?? "")
  ) {
    return false;
  }

  if (filters.from && event.createdAt < filters.from) {
    return false;
  }

  if (filters.to && event.createdAt > filters.to) {
    return false;
  }

  return true;
}

function truncateIsoDate(
  isoDate: string,
  bucket: AuditEventTimeseriesFilters["bucket"]
) {
  const date = new Date(isoDate);

  if (bucket === "day") {
    date.setUTCHours(0, 0, 0, 0);
  } else {
    date.setUTCMinutes(0, 0, 0);
  }

  return date.toISOString();
}
