import { describe, expect, it } from "vitest";

import {
  toEventListViewModel,
  toEventStatsViewModel,
  toEventTimeseriesViewModel
} from "@/src/features/audit-events/domain/presenters";

describe("toEventListViewModel", () => {
  it("maps API events to table rows", () => {
    const result = toEventListViewModel({
      events: [
        {
          actor: "actor-1",
          createdAt: "2026-01-01T00:00:00.000Z",
          event: "user.created",
          id: "event-1",
          metadata: { source: "test" },
          target: "user-1"
        }
      ],
      pageInfo: {
        hasMore: false,
        nextCursor: null
      }
    });

    expect(result.hasMore).toBe(false);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.event).toBe("user.created");
  });

  it("applies stable fallback copy for missing actor and target values", () => {
    const result = toEventListViewModel({
      events: [
        {
          actor: " ",
          createdAt: "2026-01-01T00:00:00.000Z",
          event: "user.created",
          id: "event-1",
          metadata: { source: "test" },
          target: undefined
        }
      ],
      pageInfo: {
        hasMore: false,
        nextCursor: null
      }
    });

    expect(result.rows[0]?.actor).toBe("No actor recorded");
    expect(result.rows[0]?.target).toBe("No target recorded");
  });
});

describe("toEventStatsViewModel", () => {
  it("formats event statistics for dashboard cards", () => {
    const result = toEventStatsViewModel({
      totalEvents: 1200,
      topEventTypes: [{ event: "user.created", count: 1000 }]
    });

    expect(result.totalEvents).toBe("1,200");
    expect(result.topEventTypes[0]?.count).toBe("1,000");
  });
});

describe("toEventTimeseriesViewModel", () => {
  it("maps points for the chart component", () => {
    const result = toEventTimeseriesViewModel({
      points: [{ bucketStart: "2026-01-01T00:00:00.000Z", count: 2 }]
    });

    expect(result.points[0]?.count).toBe(2);
  });
});
