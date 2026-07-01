import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TodoScreen } from "../components/todo-screen.js";

describe("TodoScreen", () => {
  it("renders the empty state when no todos exist", () => {
    render(<TodoScreen items={[]} />);

    expect(screen.getByText("No todos yet")).toBeTruthy();
  });
});
