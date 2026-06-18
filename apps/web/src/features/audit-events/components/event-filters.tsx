import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import type { EventListQuery } from "@/src/features/audit-events/domain/query";

interface EventFiltersProps {
  query: EventListQuery;
}

export function EventFilters({ query }: EventFiltersProps) {
  return (
    <form
      aria-label="Event filters"
      className="grid gap-4 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 md:grid-cols-[repeat(3,minmax(0,1fr))_auto]"
      method="get"
    >
      <Label>
        <span>Event</span>
        <Input defaultValue={query.event} name="event" placeholder="user.created" />
      </Label>
      <Label>
        <span>Actor</span>
        <Input defaultValue={query.actor} name="actor" placeholder="actor id" />
      </Label>
      <Label>
        <span>Target</span>
        <Input defaultValue={query.target} name="target" placeholder="target id" />
      </Label>
      <Button className="self-end" type="submit">
        Apply
      </Button>
    </form>
  );
}
