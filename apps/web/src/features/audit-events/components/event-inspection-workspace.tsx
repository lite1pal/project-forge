"use client";

import { useState } from "react";

import { EventDetailPanel } from "@/src/features/audit-events/components/event-detail-panel";
import type { EventListQuery } from "@/src/features/audit-events/domain/query";
import type { AuditEventRow } from "@/src/features/audit-events/domain/types";
import { EventsTable } from "@/src/features/audit-events/components/events-table";

interface EventInspectionWorkspaceProps {
  hasMore: boolean;
  nextCursor: string | null;
  query: EventListQuery;
  rows: AuditEventRow[];
}

export function EventInspectionWorkspace({
  hasMore,
  nextCursor,
  query,
  rows
}: EventInspectionWorkspaceProps) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const selectedEvent = rows.find((row) => row.id === selectedEventId) ?? null;

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
      <EventsTable
        hasMore={hasMore}
        nextCursor={nextCursor}
        onInspect={setSelectedEventId}
        query={query}
        rows={rows}
        selectedEventId={selectedEventId}
      />
      <EventDetailPanel event={selectedEvent} onClose={() => setSelectedEventId(null)} />
    </section>
  );
}
