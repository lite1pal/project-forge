import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "@/src/components/layout/app-shell";

vi.mock("@/src/features/auth/server/auth-server", () => ({
  logoutAction: async () => {}
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    push: vi.fn()
  })
}));

describe("AppShell", () => {
  it("renders the left sidebar with dashboard navigation and the workspace switcher", () => {
    render(
      <AppShell
        activeOrganizationId="org-1"
        activeProjectId="project-1"
        currentUser={{
          memberships: [
            {
              organization: {
                id: "org-1",
                name: "Acme"
              },
              organizationId: "org-1",
              projectIds: ["project-1", "project-2"],
              projects: [
                {
                  id: "project-1",
                  name: "Production",
                  organizationId: "org-1"
                },
                {
                  id: "project-2",
                  name: "Billing",
                  organizationId: "org-1"
                }
              ],
              role: "owner"
            }
          ],
          user: {
            email: "user@example.com",
            id: "user-1"
          }
        }}
      >
        <div>Child content</div>
      </AppShell>
    );

    expect(screen.getByText("AuditTrail")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("href")).toBe(
      "/?organizationId=org-1&projectId=project-1"
    );
    expect(screen.getByRole("link", { name: "Settings" }).getAttribute("href")).toBe(
      "/settings?organizationId=org-1&projectId=project-1"
    );
    expect(screen.getByText("Workspace switcher")).toBeTruthy();
    expect(screen.getByLabelText("Organization")).toBeTruthy();
    expect(screen.getByLabelText("Project")).toBeTruthy();
    expect(screen.getByText("Child content")).toBeTruthy();
  });
});
