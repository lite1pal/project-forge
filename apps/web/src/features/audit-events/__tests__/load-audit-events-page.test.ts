import { describe, expect, it } from "vitest";

import { loadAuditEventsPage } from "@/src/features/audit-events/server/load-audit-events-page";
import type { AuditEventsService } from "@/src/features/audit-events/services/audit-events-service";

describe("loadAuditEventsPage", () => {
  it("loads list, stats, and timeseries through an injected service", async () => {
    const service: AuditEventsService = {
      async list() {
        return {
          events: [],
          pageInfo: {
            hasMore: false,
            nextCursor: null
          }
        };
      },
      async stats() {
        return {
          topEventTypes: [],
          totalEvents: 0
        };
      },
      async timeseries() {
        return {
          points: []
        };
      }
    };

    const result = await loadAuditEventsPage({ limit: 25 }, { service });

    expect(result.events.events).toEqual([]);
    expect(result.stats.totalEvents).toBe(0);
    expect(result.timeseries.points).toEqual([]);
  });
});
