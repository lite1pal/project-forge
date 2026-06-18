import type {
  EventListResponse,
  EventListViewModel,
  EventStatsResponse,
  EventStatsViewModel,
  EventTimeseriesResponse,
  EventTimeseriesViewModel
} from "@/src/features/audit-events/domain/types";

export function toEventListViewModel(
  response: EventListResponse
): EventListViewModel {
  return {
    hasMore: response.pageInfo.hasMore,
    nextCursor: response.pageInfo.nextCursor,
    rows: response.events.map((event) => ({
      actor: toFallbackValue(event.actor, "No actor recorded"),
      createdAt: formatIsoDate(event.createdAt),
      event: event.event,
      id: event.id,
      metadata: JSON.stringify(event.metadata),
      target: toFallbackValue(event.target, "No target recorded")
    }))
  };
}

export function toEventStatsViewModel(
  response: EventStatsResponse
): EventStatsViewModel {
  return {
    totalEvents: response.totalEvents.toLocaleString("en"),
    topEventTypes: response.topEventTypes.map((eventType) => ({
      count: eventType.count.toLocaleString("en"),
      event: eventType.event
    }))
  };
}

export function toEventTimeseriesViewModel(
  response: EventTimeseriesResponse
): EventTimeseriesViewModel {
  return {
    points: response.points.map((point) => ({
      bucketStart: formatIsoDate(point.bucketStart),
      count: point.count
    }))
  };
}

function formatIsoDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function toFallbackValue(value: string | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : fallback;
}
