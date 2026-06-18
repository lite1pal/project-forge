import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EventDashboard } from "@/src/features/audit-events/components/event-dashboard";

const meta = {
  component: EventDashboard,
  title: "Features/Audit Events/EventDashboard"
} satisfies Meta<typeof EventDashboard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    stats: {
      topEventTypes: [
        { count: "128", event: "user.created" },
        { count: "64", event: "project.updated" }
      ],
      totalEvents: "1,240"
    },
    timeseries: {
      points: [
        { bucketStart: "Jan 1, 2026, 12:00 AM", count: 12 },
        { bucketStart: "Jan 2, 2026, 12:00 AM", count: 28 },
        { bucketStart: "Jan 3, 2026, 12:00 AM", count: 18 }
      ]
    }
  }
};
