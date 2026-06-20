import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceSidebarSwitcher } from "@/src/features/organizations/components/workspace-sidebar-switcher";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings",
  useRouter: () => ({
    push
  })
}));

describe("WorkspaceSidebarSwitcher", () => {
  beforeEach(() => {
    push.mockReset();
  });

  it("pushes the current route with the selected organization and project", async () => {
    const user = userEvent.setup();

    render(
      <WorkspaceSidebarSwitcher
        activeOrganizationId="org-1"
        activeProjectId="project-1"
        memberships={[
          {
            organization: {
              id: "org-1",
              name: "Acme"
            },
            organizationId: "org-1",
            projectIds: ["project-1"],
            projects: [
              {
                id: "project-1",
                name: "Production",
                organizationId: "org-1"
              }
            ],
            role: "owner"
          },
          {
            organization: {
              id: "org-2",
              name: "Beta"
            },
            organizationId: "org-2",
            projectIds: ["project-2"],
            projects: [
              {
                id: "project-2",
                name: "Billing",
                organizationId: "org-2"
              }
            ],
            role: "member"
          }
        ]}
      />
    );

    await user.selectOptions(screen.getByLabelText("Organization"), "org-2");
    await user.click(screen.getByRole("button", { name: "Open workspace" }));

    expect(push).toHaveBeenCalledWith("/settings?organizationId=org-2&projectId=project-2");
  });
});
