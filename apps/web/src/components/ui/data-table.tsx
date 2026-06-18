"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef
} from "@tanstack/react-table";

import { EmptyState } from "@/src/components/ui/empty-state";

interface DataTableProps<TData> {
  columns: Array<ColumnDef<TData>>;
  emptyLabel: string;
  loading?: boolean;
  rows: TData[];
}

export function DataTable<TData>({
  columns,
  emptyLabel,
  loading,
  rows
}: DataTableProps<TData>) {
  const table = useReactTable({
    columns,
    data: rows,
    getCoreRowModel: getCoreRowModel()
  });

  if (loading) {
    return <EmptyState label="Loading..." />;
  }

  if (rows.length === 0) {
    return <EmptyState label={emptyLabel} />;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel)]">
    <table className="w-full border-collapse">
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th
                className="border-b border-slate-200 bg-[var(--panel-subtle)] p-3 text-left text-sm font-bold text-slate-600"
                key={header.id}
              >
                {flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <td
                className="border-b border-slate-100 p-3 align-top text-sm"
                key={cell.id}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
