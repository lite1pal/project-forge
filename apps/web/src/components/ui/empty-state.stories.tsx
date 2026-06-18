import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EmptyState } from "@/src/components/ui/empty-state";

const meta = {
  component: EmptyState,
  title: "UI/EmptyState"
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "No audit events match these filters."
  }
};
