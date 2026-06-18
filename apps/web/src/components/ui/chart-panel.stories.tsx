import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ChartPanel } from "@/src/components/ui/chart-panel";

const meta = {
  component: ChartPanel,
  title: "UI/ChartPanel"
} satisfies Meta<typeof ChartPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: <div className="h-32 rounded bg-slate-100" />,
    label: "Events over time"
  }
};
