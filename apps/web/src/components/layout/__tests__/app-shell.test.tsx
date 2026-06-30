import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "@/src/components/layout/app-shell";

vi.mock("@/src/config/env", () => ({
  loadPublicConfig: () => ({
    NEXT_PUBLIC_API_BASE_URL: "https://api.example.com",
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    push: vi.fn(),
  }),
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
              installedProducts: [
                {
                  enabled: true,
                  productId: "audit-events",
                },
              ],
              organization: {
                id: "org-1",
                name: "Acme",
              },
              onboarding: incompleteOnboarding(),
              organizationId: "org-1",
              plan: starterPlan(),
              projectIds: ["project-1", "project-2"],
              projects: [
                {
                  id: "project-1",
                  name: "Production",
                  organizationId: "org-1",
                },
                {
                  id: "project-2",
                  name: "Billing",
                  organizationId: "org-1",
                },
              ],
              role: "owner",
            },
          ],
          user: {
            email: "user@example.com",
            id: "user-1",
          },
        }}
        productName="AuditTrail"
        productNavItems={[
          {
            href: "/?organizationId=org-1&projectId=project-1",
            id: "events",
            label: "Events"
          }
        ]}
      >
        <div>Child content</div>
      </AppShell>,
    );

    expect(screen.getByText("AuditTrail")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Events" }).getAttribute("href"),
    ).toBe("/?organizationId=org-1&projectId=project-1");
    expect(
      screen.getByRole("link", { name: "Settings" }).getAttribute("href"),
    ).toBe("/settings?organizationId=org-1&projectId=project-1");
    expect(
      screen.getByRole("link", { name: "API Keys" }).getAttribute("href"),
    ).toBe("/api-keys?organizationId=org-1&projectId=project-1");
    expect(
      screen.getByRole("link", { name: "Getting started" }).getAttribute("href"),
    ).toBe("/getting-started?organizationId=org-1&projectId=project-1");
    expect(
      screen.getByRole("link", { name: "Members" }).getAttribute("href"),
    ).toBe("/members?organizationId=org-1&projectId=project-1");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign out" }).closest("form")?.getAttribute("action")).toBe(
      "https://api.example.com/api/v1/auth/sessions/current/logout?redirectTo=%2Fauth%2Fsign-in",
    );
    expect(screen.getByText("Workspace")).toBeTruthy();
    expect(screen.getByLabelText("Organization")).toBeTruthy();
    expect(screen.getByLabelText("Project")).toBeTruthy();
    expect(screen.getByText("Child content")).toBeTruthy();
  });

  it("falls back to root-level links when no workspace is selected", () => {
    render(
      <AppShell
        currentUser={{
          memberships: [],
          user: {
            email: "user@example.com",
            id: "user-1",
          },
        }}
        productName="AuditTrail"
        productNavItems={[
          {
            href: "/",
            id: "events",
            label: "Events"
          }
        ]}
      >
        <div>Child content</div>
      </AppShell>,
    );

    expect(screen.getByText("No organization · No project")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Events" }).getAttribute("href"),
    ).toBe("/");
    expect(
      screen.getByRole("link", { name: "Settings" }).getAttribute("href"),
    ).toBe("/settings");
    expect(
      screen.getByRole("link", { name: "API Keys" }).getAttribute("href"),
    ).toBe("/api-keys");
    expect(
      screen.getByRole("link", { name: "Members" }).getAttribute("href"),
    ).toBe("/members");
  });
});

function starterPlan() {
  return {
    id: "starter" as const,
    includedEvents: 100000,
    name: "Starter",
    periodEnd: "2026-07-01T00:00:00.000Z",
    periodStart: "2026-06-01T00:00:00.000Z",
    remainingEvents: 99999,
    usedEvents: 1,
  };
}

function incompleteOnboarding() {
  return {
    completedRequiredSteps: 0,
    isComplete: false,
    isDismissed: false,
    steps: [
      { id: "project_created" as const, required: true, status: "pending" as const },
      { id: "api_key_created" as const, required: true, status: "pending" as const },
      {
        id: "first_event_ingested" as const,
        required: true,
        status: "pending" as const,
      },
      { id: "member_invited" as const, required: false, status: "pending" as const },
    ],
    totalRequiredSteps: 3,
  };
}
