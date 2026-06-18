import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PageShell } from "@/src/components/ui/page-shell";

const meta = {
  component: PageShell,
  title: "UI/PageShell"
} satisfies Meta<typeof PageShell>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "Page content"
  }
};
