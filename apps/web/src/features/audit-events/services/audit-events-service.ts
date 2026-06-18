import type { AuditEventsClient } from "@/src/features/audit-events/api/audit-events-client";
import type { EventListQuery } from "@/src/features/audit-events/domain/query";

export interface AuditEventsService {
  list(query: EventListQuery): ReturnType<AuditEventsClient["list"]>;
  stats(query: {
    from?: string;
    to?: string;
    top?: number;
  }): ReturnType<AuditEventsClient["stats"]>;
  timeseries(query: {
    bucket?: "hour" | "day";
    from: string;
    to: string;
  }): ReturnType<AuditEventsClient["timeseries"]>;
}

export function createAuditEventsService(
  client: AuditEventsClient
): AuditEventsService {
  return {
    list(query) {
      return client.list(query);
    },
    stats(query) {
      return client.stats(query);
    },
    timeseries(query) {
      return client.timeseries(query);
    }
  };
}
