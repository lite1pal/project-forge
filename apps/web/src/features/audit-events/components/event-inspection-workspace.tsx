"use client";

import { useState } from "react";

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

  return (
    <EventsTable
      hasMore={hasMore}
      nextCursor={nextCursor}
      onInspect={setSelectedEventId}
      query={query}
      rows={rows}
      selectedEventId={selectedEventId}
    />
  );
}
