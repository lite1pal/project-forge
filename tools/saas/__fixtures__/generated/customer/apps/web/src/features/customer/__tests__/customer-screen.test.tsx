import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CustomerScreen } from "../components/customer-screen.js";

describe("CustomerScreen", () => {
  it("renders the empty state when no customers exist", () => {
    render(<CustomerScreen items={[]} />);

    expect(screen.getByText("No customers yet")).toBeInTheDocument();
  });
});
