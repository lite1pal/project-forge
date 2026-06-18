import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { DataTable } from "@/src/components/ui/data-table";

interface Row {
  event: string;
  actor: string;
}

const RowDataTable = DataTable<Row>;

const meta = {
  component: RowDataTable,
  title: "UI/DataTable"
} satisfies Meta<typeof RowDataTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    columns: [
      { accessorKey: "event", header: "Event" },
      { accessorKey: "actor", header: "Actor" }
    ],
    emptyLabel: "No rows.",
    rows: [{ actor: "user-1", event: "user.created" }]
  }
};
