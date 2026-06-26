import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WorkspaceSettingsScreen } from "@/src/features/organizations/components/workspace-settings-screen";
import type { WorkspaceSettingsProductCopy } from "@/src/features/organizations/components/workspace-settings-screen.types";

describe("WorkspaceSettingsScreen", () => {
  it("surfaces the current workspace and a clear next step", () => {
    render(
      <WorkspaceSettingsScreen
        acceptInvitationAction={noopAction}
        activeOrganizationId="org-1"
        billingStatus={{
          customer: null,
          organizationId: "org-1",
          providerConfigurationStatus: "configured",
          subscription: {
            billingCustomerId: "customer-1",
            billingPlanId: "billing-growth-monthly",
            cancelAtPeriodEnd: false,
            createdAt: "2026-06-18T10:00:00.000Z",
            currentPeriodEnd: "2026-07-01T00:00:00.000Z",
            currentPeriodStart: "2026-06-01T00:00:00.000Z",
            entitlementPlanId: "growth",
            id: "subscription-1",
            provider: "stripe",
            providerPriceId: "price_123",
            providerSubscriptionId: "sub_123",
            status: "active",
            updatedAt: "2026-06-18T10:00:00.000Z"
          }
        }}
        activeOrganizationPlan={starterPlan()}
        activeOrganizationRole="owner"
        activeProjectId="project-1"
        changeOrganizationPlanAction={noopAction}
        apiKeys={[
          {
            createdAt: "2026-06-18T10:00:00.000Z",
            id: "key-1",
            keyPrefix: "atlabc",
            lastUsedAt: "2026-06-18T11:00:00.000Z",
            name: "Production ingest",
            projectId: "project-1",
            revoked: false
          }
        ]}
        createApiKeyAction={noopAction}
        requestBillingCheckoutAction={noopBillingAction}
        requestBillingPortalAction={noopBillingAction}
        createOrganizationAction={noopAction}
        createProjectAction={noopAction}
        ingestCommand="curl -i http://localhost:4000/api/v1/events"
        invitationUrl="http://localhost:3000/settings?invitationToken=invite-1"
        inviteMemberAction={noopAction}
        newApiKey={{
          name: "Production ingest",
          projectId: "project-1",
          rawKey: "atlabc_secret"
        }}
        organizations={[
          {
            id: "org-1",
            name: "Acme"
          }
        ]}
        productCopy={productCopy}
        projects={[
          {
            id: "project-1",
            name: "Production",
            organizationId: "org-1"
          }
        ]}
        revokeApiKeyAction={noopAction}
      />
    );

    expect(
      screen.getByText("Manage organizations, projects, and ingest keys from one place.")
    ).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Settings sections" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Workspace/i }).getAttribute("href")).toBe(
      "#workspace-settings"
    );
    expect(screen.getByRole("link", { name: /Plan & usage/i }).getAttribute("href")).toBe(
      "#plan-settings"
    );
    expect(screen.getByRole("link", { name: /Billing/i }).getAttribute("href")).toBe(
      "#billing-settings"
    );
    expect(screen.getByRole("link", { name: /Access/i }).getAttribute("href")).toBe(
      "#access-settings"
    );
    expect(screen.getByRole("link", { name: /Projects/i }).getAttribute("href")).toBe(
      "#project-settings"
    );
    expect(screen.getByText("Workspace snapshot")).toBeTruthy();
    expect(screen.getByText("Selected project: Production")).toBeTruthy();
    expect(screen.getByText("Used this month")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Starter selected" })).toBeTruthy();
    expect(screen.getByText("billing-growth-monthly")).toBeTruthy();
    expect(screen.getByText("active")).toBeTruthy();
    expect(
      screen.getByText(
        "Billing is connected for this organization. Checkout and customer portal actions will open real provider sessions."
      )
    ).toBeTruthy();
    expect(screen.getByText("Invitation link")).toBeTruthy();
    expect(screen.getByText("Selected")).toBeTruthy();
  });

  it("shows empty-state guidance when no project is selected", () => {
    render(
      <WorkspaceSettingsScreen
        acceptInvitationAction={noopAction}
        activeOrganizationId="org-1"
        billingStatus={{
          customer: null,
          organizationId: "org-1",
          providerConfigurationStatus: "not_configured",
          subscription: null
        }}
        activeOrganizationPlan={starterPlan()}
        activeOrganizationRole="owner"
        apiKeys={[]}
        changeOrganizationPlanAction={noopAction}
        createApiKeyAction={noopAction}
        requestBillingCheckoutAction={noopBillingAction}
        requestBillingPortalAction={noopBillingAction}
        createOrganizationAction={noopAction}
        createProjectAction={noopAction}
        inviteMemberAction={noopAction}
        organizations={[
          {
            id: "org-1",
            name: "Acme"
          }
        ]}
        productCopy={productCopy}
        projects={[]}
        revokeApiKeyAction={noopAction}
      />
    );

    expect(screen.getByText("No projects yet. Create one to generate keys and start collecting events.")).toBeTruthy();
    expect(
      screen.getByText("Create an invitation to generate a shareable join link for this organization.")
    ).toBeTruthy();
    expect(screen.getByText("Needs a project")).toBeTruthy();
    expect(screen.getByText("No active subscription")).toBeTruthy();
    expect(screen.getByText(/Billing is not connected for this organization yet\./)).toBeTruthy();
  });

  it("hides restricted settings actions behind disabled forms for non-admin roles", () => {
    render(
      <WorkspaceSettingsScreen
        acceptInvitationAction={noopAction}
        activeOrganizationId="org-1"
        billingStatus={{
          customer: null,
          organizationId: "org-1",
          providerConfigurationStatus: "not_configured",
          subscription: null
        }}
        activeOrganizationPlan={starterPlan()}
        activeOrganizationRole="viewer"
        apiKeys={[]}
        changeOrganizationPlanAction={noopAction}
        createApiKeyAction={noopAction}
        requestBillingCheckoutAction={noopBillingAction}
        requestBillingPortalAction={noopBillingAction}
        createOrganizationAction={noopAction}
        createProjectAction={noopAction}
        inviteMemberAction={noopAction}
        organizations={[
          {
            id: "org-1",
            name: "Acme"
          }
        ]}
        productCopy={productCopy}
        projects={[]}
        revokeApiKeyAction={noopAction}
      />
    );

    expect(screen.getByRole("button", { name: "Create project" }).getAttribute("disabled")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Create invitation" }).getAttribute("disabled")).not.toBeNull();
    expect(screen.getByText("Only organization owners and admins can create projects.")).toBeTruthy();
    expect(screen.getByText("Only organization owners and admins can invite members.")).toBeTruthy();
    expect(screen.getByText("Only organization owners and admins can change plans.")).toBeTruthy();
    expect(
      screen.getByText("Only organization owners and admins can start billing actions.")
    ).toBeTruthy();
  });

  it("falls back to the root dashboard link when no organization is selected", () => {
    render(
      <WorkspaceSettingsScreen
        acceptInvitationAction={noopAction}
        apiKeys={[]}
        changeOrganizationPlanAction={noopAction}
        createApiKeyAction={noopAction}
        requestBillingCheckoutAction={noopBillingAction}
        requestBillingPortalAction={noopBillingAction}
        createOrganizationAction={noopAction}
        createProjectAction={noopAction}
        inviteMemberAction={noopAction}
        organizations={[]}
        productCopy={productCopy}
        projects={[]}
        revokeApiKeyAction={noopAction}
      />
    );

    expect(screen.getByRole("link", { name: "Open dashboard" }).getAttribute("href")).toBe("/");
    expect(screen.getByText("No organization selected")).toBeTruthy();
    expect(
      screen.getByText("Select an organization to review its current plan and monthly event usage.")
    ).toBeTruthy();
  });
});

async function noopAction() {}

async function noopBillingAction() {
  return {
    status: "idle" as const
  };
}

function starterPlan() {
  return {
    id: "starter" as const,
    includedEvents: 100000,
    name: "Starter",
    periodEnd: "2026-07-01T00:00:00.000Z",
    periodStart: "2026-06-01T00:00:00.000Z",
    remainingEvents: 99999,
    usedEvents: 1
  };
}

const productCopy: WorkspaceSettingsProductCopy = {
  planUsage: {
    emptyStateDescription:
      "Select an organization to review its current plan and monthly event usage.",
    metrics: {
      currentPlan: "Current plan",
      includedUnits: "Included events",
      remainingUnits: "Remaining",
      usedThisMonth: "Used this month"
    },
    navDescription: "Review monthly quota usage and switch the active plan.",
    navLabel: "Plan & usage",
    noPermissionDescription:
      "Only organization owners and admins can change plans.",
    resetDatePrefix: "Resets on",
    selectedPlanSuffix: "selected",
    sectionDescription:
      "Review the current monthly quota, the UTC reset window, and switch plans when your workspace needs more capacity.",
    sectionTitle: "Plan & usage",
    switchToPlanPrefix: "Switch to",
    usageWindowPrefix: "Usage is tracked by UTC calendar month from"
  }
};
