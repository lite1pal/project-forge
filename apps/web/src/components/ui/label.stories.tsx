import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

const meta = {
  component: Label,
  title: "UI/Label"
} satisfies Meta<typeof Label>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithInput: Story = {
  render: () => (
    <Label>
      <span>Event</span>
      <Input placeholder="user.created" />
    </Label>
  )
};
