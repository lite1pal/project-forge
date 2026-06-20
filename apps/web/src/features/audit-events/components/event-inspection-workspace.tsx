"use client";

import { useState } from "react";

import { Dialog } from "@/src/components/ui/dialog";
import { EventDetailPanel } from "@/src/features/audit-events/components/event-detail-panel";
import type {
  EventListQuery,
  EventListWorkspaceQuery
} from "@/src/features/audit-events/domain/query";
import type { AuditEventRow } from "@/src/features/audit-events/domain/types";
import { EventsTable } from "@/src/features/audit-events/components/events-table";

interface EventInspectionWorkspaceProps {
  hasMore: boolean;
  nextCursor: string | null;
  query: EventListQuery;
  rows: AuditEventRow[];
  workspace?: EventListWorkspaceQuery;
}

export function EventInspectionWorkspace({
  hasMore,
  nextCursor,
  query,
  rows,
  workspace
}: EventInspectionWorkspaceProps) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const selectedEvent = rows.find((row) => row.id === selectedEventId) ?? null;

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          setSelectedEventId(null);
        }
      }}
      open={selectedEvent !== null}
    >
      <section className="grid gap-4">
        <EventsTable
          hasMore={hasMore}
          nextCursor={nextCursor}
          onInspect={setSelectedEventId}
          query={query}
          rows={rows}
          selectedEventId={selectedEventId}
          workspace={workspace}
        />
        <EventDetailPanel event={selectedEvent} onClose={() => setSelectedEventId(null)} />
      </section>
    </Dialog>
  );
}
