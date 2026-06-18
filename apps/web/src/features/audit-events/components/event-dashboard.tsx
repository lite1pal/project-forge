import type {
  EventStatsViewModel,
  EventTimeseriesViewModel
} from "@/src/features/audit-events/domain/types";
import { MetricCard } from "@/src/components/ui/metric-card";
import { EventTimeseriesChart } from "@/src/features/audit-events/components/event-timeseries-chart";

interface EventDashboardProps {
  stats: EventStatsViewModel;
  timeseries: EventTimeseriesViewModel;
}

export function EventDashboard({ stats, timeseries }: EventDashboardProps) {
  return (
    <section
      aria-label="Event dashboard"
      className="grid gap-4 lg:grid-cols-[220px_280px_minmax(0,1fr)]"
    >
      <MetricCard label="Total events" value={stats.totalEvents} />
      <MetricCard label="Top event types">
        <ul className="m-0 grid list-none gap-2 p-0">
          {stats.topEventTypes.map((eventType) => (
            <li className="flex items-center justify-between gap-3" key={eventType.event}>
              <span>{eventType.event}</span>
              <strong>{eventType.count}</strong>
            </li>
          ))}
        </ul>
      </MetricCard>
      <EventTimeseriesChart points={timeseries.points} />
    </section>
  );
}
