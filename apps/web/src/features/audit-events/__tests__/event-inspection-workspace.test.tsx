import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { EventInspectionWorkspace } from "@/src/features/audit-events/components/event-inspection-workspace";

describe("EventInspectionWorkspace", () => {
  it("opens the detail modal for the selected event and closes it", async () => {
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

    expect(screen.queryByLabelText("Event detail modal")).toBeNull();
    expect(screen.queryByText("Event details")).toBeNull();

    const inspectButtons = screen.getAllByRole("button", { name: "Inspect" });

    expect(inspectButtons).toHaveLength(2);

    await user.click(inspectButtons[1]!);

    expect(screen.getByRole("dialog", { name: "Event details" })).toBeTruthy();
    expect(
      screen.getByRole("button", { hidden: true, name: "Inspecting" }).getAttribute(
        "aria-pressed"
      )
    ).toBe("true");
    const detailPanel = screen.getByLabelText("Event detail modal");

    expect(detailPanel.textContent).toContain("user.updated");
    expect(detailPanel.textContent).toContain("account-2");
    expect(screen.getAllByRole("button", { hidden: true, name: "Inspect" })).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByLabelText("Event detail modal")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Inspect" })).toHaveLength(2);
  });

  it("renders fallback actor and target copy in the detail modal", async () => {
    const user = userEvent.setup();

    render(
      <EventInspectionWorkspace
        hasMore={false}
        nextCursor={null}
        query={{ limit: 25 }}
        rows={[
          {
            actor: "No actor recorded",
            createdAt: "Jan 3, 2026, 12:00 AM",
            event: "user.deleted",
            id: "event-3",
            metadata: "{\"source\":\"test\"}",
            target: "No target recorded"
          }
        ]}
      />
    );

    await user.click(screen.getByRole("button", { name: "Inspect" }));

    const detailPanel = screen.getByLabelText("Event detail modal");

    expect(detailPanel.textContent).toContain("No actor recorded");
    expect(detailPanel.textContent).toContain("No target recorded");
    expect(detailPanel.textContent).not.toContain("undefined");
    expect(detailPanel.textContent).not.toContain("null");
  });
});
