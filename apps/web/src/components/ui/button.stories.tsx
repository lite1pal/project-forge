import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "@/src/components/ui/button";

const meta = {
  component: Button,
  title: "UI/Button"
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    children: "Apply",
    variant: "primary"
  }
};

export const Secondary: Story = {
  args: {
    children: "Cancel",
    variant: "secondary"
  }
};
