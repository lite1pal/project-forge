import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PaginationLink } from "@/src/components/ui/pagination-link";

const meta = {
  component: PaginationLink,
  title: "UI/PaginationLink"
} satisfies Meta<typeof PaginationLink>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "Next page",
    href: "/"
  }
};
