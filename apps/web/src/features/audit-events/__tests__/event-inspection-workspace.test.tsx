import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { EventInspectionWorkspace } from "@/src/features/audit-events/components/event-inspection-workspace";

describe("EventInspectionWorkspace", () => {
  it("marks the selected event row when inspection starts", async () => {
    const user = userEvent.setup();

    render(
      <EventInspectionWorkspace
        hasMore={false}
        nextCursor={null}
        query={{ limit: 25 }}
        rows={[
          {
            actor: "user-1",
            createdAt: "Jan 1, 2026, 12:00 AM",
            event: "user.created",
            id: "event-1",
            metadata: "{\"source\":\"test\"}",
            target: "account-1"
          },
          {
            actor: "user-2",
            createdAt: "Jan 2, 2026, 12:00 AM",
            event: "user.updated",
            id: "event-2",
            metadata: "{\"source\":\"test\"}",
            target: "account-2"
          }
        ]}
      />
    );

    const inspectButtons = screen.getAllByRole("button", { name: "Inspect" });

    expect(inspectButtons).toHaveLength(2);

    await user.click(inspectButtons[1]!);

    expect(screen.getByRole("button", { name: "Inspecting" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Inspecting" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(screen.getAllByRole("button", { name: "Inspect" })).toHaveLength(1);
  });
});
