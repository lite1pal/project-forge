import Link from "next/link";

import { Button } from "@/src/components/ui/button";
import { EmptyState } from "@/src/components/ui/empty-state";
import { PageShell } from "@/src/components/ui/page-shell";
import { SectionHeader } from "@/src/components/ui/section-header";
import {
  toEventListViewModel,
  toEventStatsViewModel,
  toEventTimeseriesViewModel
} from "@/src/features/audit-events/domain/presenters";
import type { EventListQuery } from "@/src/features/audit-events/domain/query";
import type {
  EventListResponse,
  EventStatsResponse,
  EventTimeseriesResponse
} from "@/src/features/audit-events/domain/types";
import { EventDashboard } from "@/src/features/audit-events/components/event-dashboard";
import { EventInspectionWorkspace } from "@/src/features/audit-events/components/event-inspection-workspace";
import { EventFilters } from "@/src/features/audit-events/components/event-filters";

interface AuditEventsScreenProps {
  initialEvents: EventListResponse;
  query: EventListQuery;
  stats: EventStatsResponse;
  timeseries: EventTimeseriesResponse;
}

export function AuditEventsScreen({
  initialEvents,
  query,
  stats,
  timeseries
}: AuditEventsScreenProps) {
  const viewModel = toEventListViewModel(initialEvents);

  return (
    <PageShell>
      <SectionHeader eyebrow="Audit events" title="Event stream" />
      <EventFilters query={query} />
      <EventDashboard
        stats={toEventStatsViewModel(stats)}
        timeseries={toEventTimeseriesViewModel(timeseries)}
      />
      {viewModel.rows.length === 0 ? (
        <section className="grid gap-4">
          <EmptyState label="No audit events yet. Generate a project key in Settings and send one test event." />
          <div>
            <Button asChild variant="secondary">
              <Link href="/settings">Open settings</Link>
            </Button>
          </div>
        </section>
      ) : (
        <EventInspectionWorkspace
          hasMore={viewModel.hasMore}
          nextCursor={viewModel.nextCursor}
          query={query}
          rows={viewModel.rows}
        />
      )}
    </PageShell>
  );
}
