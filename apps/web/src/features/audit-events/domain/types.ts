import { z } from "zod";

import {
  auditEventSchema,
  eventListResponseSchema,
  eventStatsResponseSchema,
  eventTimeseriesResponseSchema
} from "@/src/features/audit-events/domain/schemas";

export type AuditEvent = z.infer<typeof auditEventSchema>;
export type EventListResponse = z.infer<typeof eventListResponseSchema>;
export type EventStatsResponse = z.infer<typeof eventStatsResponseSchema>;
export type EventTimeseriesResponse = z.infer<
  typeof eventTimeseriesResponseSchema
>;

export interface AuditEventRow {
  actor: string;
  createdAt: string;
  event: string;
  id: string;
  metadata: string;
  target: string;
}

export interface EventListViewModel {
  hasMore: boolean;
  nextCursor: string | null;
  rows: AuditEventRow[];
}

export interface EventStatsViewModel {
  totalEvents: string;
  topEventTypes: Array<{
    count: string;
    event: string;
  }>;
}

export interface EventTimeseriesViewModel {
  points: Array<{
    bucketStart: string;
    count: number;
  }>;
}
