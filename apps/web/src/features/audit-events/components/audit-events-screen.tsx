import Link from "next/link";

import { Button } from "../../../components/ui/button";
import { EmptyState } from "../../../components/ui/empty-state";
import { PageShell } from "../../../components/ui/page-shell";
import { SectionHeader } from "../../../components/ui/section-header";
import {
  toEventListViewModel,
  toEventStatsViewModel,
  toEventTimeseriesViewModel
} from "../domain/presenters";
import type { EventListQuery } from "../domain/query";
import type {
  EventListResponse,
  EventStatsResponse,
  EventTimeseriesResponse
} from "../domain/types";
import { EventDashboard } from "./event-dashboard";
import { EventFilters } from "./event-filters";
import { EventsTable } from "./events-table";

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
        <EventsTable
          hasMore={viewModel.hasMore}
          nextCursor={viewModel.nextCursor}
          query={query}
          rows={viewModel.rows}
        />
      )}
    </PageShell>
  );
}
