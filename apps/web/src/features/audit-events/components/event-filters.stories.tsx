import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EventFilters } from "@/src/features/audit-events/components/event-filters";

const meta = {
  component: EventFilters,
  title: "Features/Audit Events/EventFilters"
} satisfies Meta<typeof EventFilters>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    query: {
      limit: 25
    }
  }
};

export const WithValues: Story = {
  args: {
    query: {
      actor: "user-1",
      event: "user.created",
      limit: 25,
      target: "account-1"
    }
  }
};
