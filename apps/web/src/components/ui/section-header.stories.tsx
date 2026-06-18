import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { SectionHeader } from "@/src/components/ui/section-header";

const meta = {
  component: SectionHeader,
  title: "UI/SectionHeader"
} satisfies Meta<typeof SectionHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    eyebrow: "Audit events",
    title: "Event stream"
  }
};
