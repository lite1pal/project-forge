import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Input } from "@/src/components/ui/input";

const meta = {
  component: Input,
  title: "UI/Input"
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: "user.created"
  }
};
