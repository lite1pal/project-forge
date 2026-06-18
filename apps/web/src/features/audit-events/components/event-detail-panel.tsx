import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { EmptyState } from "@/src/components/ui/empty-state";
import type { AuditEventRow } from "@/src/features/audit-events/domain/types";

interface EventDetailPanelProps {
  event: AuditEventRow | null;
  onClose: () => void;
}

export function EventDetailPanel({ event, onClose }: EventDetailPanelProps) {
  return (
    <Card aria-label="Event detail panel" className="grid gap-4 self-start">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-base font-bold text-[var(--foreground)]">Event details</h2>
          <p className="text-sm text-[var(--muted)]">
            {event
              ? "Inspect the selected event without leaving the dashboard."
              : "Select an event row to inspect it here."}
          </p>
        </div>
        <Button
          disabled={!event}
          onClick={onClose}
          size="sm"
          type="button"
          variant="ghost"
        >
          Close
        </Button>
      </div>

      {event ? (
        <dl className="grid gap-4">
          <DetailItem label="Event" value={event.event} />
          <DetailItem label="Created" value={event.createdAt} />
          <DetailItem label="Actor" value={event.actor} />
          <DetailItem label="Target" value={event.target} />
          <div className="grid gap-2">
            <dt className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
              Metadata
            </dt>
            <dd className="m-0 overflow-x-auto rounded-lg bg-[var(--panel-subtle)] p-3 text-sm">
              <pre className="m-0 whitespace-pre-wrap break-words font-mono">
                {event.metadata}
              </pre>
            </dd>
          </div>
        </dl>
      ) : (
        <EmptyState label="No event selected. Choose Inspect on any row to open its details." />
      )}
    </Card>
  );
}

interface DetailItemProps {
  label: string;
  value: string;
}

function DetailItem({ label, value }: DetailItemProps) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
        {label}
      </dt>
      <dd className="m-0 text-sm text-[var(--foreground)]">{value}</dd>
    </div>
  );
}
