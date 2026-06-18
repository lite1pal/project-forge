"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import { Button } from "@/src/components/ui/button";
import { DataTable } from "@/src/components/ui/data-table";
import { PaginationLink } from "@/src/components/ui/pagination-link";
import type { EventListQuery } from "@/src/features/audit-events/domain/query";
import { toEventListHref } from "@/src/features/audit-events/domain/query";
import type { AuditEventRow } from "@/src/features/audit-events/domain/types";

interface EventsTableProps {
  hasMore: boolean;
  loading?: boolean;
  nextCursor: string | null;
  onInspect?: (eventId: string) => void;
  query: EventListQuery;
  rows: AuditEventRow[];
  selectedEventId?: string | null;
}

export function EventsTable({
  hasMore,
  loading,
  nextCursor,
  onInspect,
  query,
  rows,
  selectedEventId
}: EventsTableProps) {
  const columns = useMemo<Array<ColumnDef<AuditEventRow>>>(
    () => {
      const baseColumns: Array<ColumnDef<AuditEventRow>> = [
        { accessorKey: "createdAt", header: "Created" },
        { accessorKey: "event", header: "Event" },
        { accessorKey: "actor", header: "Actor" },
        { accessorKey: "target", header: "Target" },
        { accessorKey: "metadata", header: "Metadata" }
      ];

      if (!onInspect) {
        return baseColumns;
      }

      return [
        ...baseColumns,
        {
          cell: ({ row }) => {
            const selected = row.original.id === selectedEventId;

            return (
              <Button
                aria-pressed={selected}
                onClick={() => onInspect(row.original.id)}
                size="sm"
                type="button"
                variant={selected ? "secondary" : "ghost"}
              >
                {selected ? "Inspecting" : "Inspect"}
              </Button>
            );
          },
          header: "Inspect",
          id: "inspect"
        }
      ];
    },
    [onInspect, selectedEventId]
  );

  return (
    <section className="grid gap-4">
      <DataTable
        columns={columns}
        emptyLabel="No audit events match these filters."
        loading={loading}
        rows={rows}
      />
      {hasMore && nextCursor ? (
        <PaginationLink href={toEventListHref(query, nextCursor)}>
          Next page
        </PaginationLink>
      ) : null}
    </section>
  );
}
