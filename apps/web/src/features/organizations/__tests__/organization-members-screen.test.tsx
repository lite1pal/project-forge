import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OrganizationMembersScreen } from "@/src/features/organizations/components/organization-members-screen";

describe("OrganizationMembersScreen", () => {
  it("renders organization members", () => {
    render(
      <OrganizationMembersScreen
        members={[
          {
            email: "casey@example.com",
            id: "user-1",
            name: "Casey",
            role: "owner"
          },
          {
            email: "alex@example.com",
            id: "user-2",
            role: "viewer"
          }
        ]}
        organizationName="Acme"
      />
    );

    expect(screen.getByText("Acme members")).toBeTruthy();
    expect(screen.getByText("Casey")).toBeTruthy();
    expect(screen.getAllByText("alex@example.com")).toHaveLength(2);
    expect(screen.getByText("owner")).toBeTruthy();
    expect(screen.getByText("viewer")).toBeTruthy();
  });

  it("renders an empty state when no members are available", () => {
    render(<OrganizationMembersScreen members={[]} />);

    expect(
      screen.getByText("No organization members are visible for this workspace yet.")
    ).toBeTruthy();
  });
});
