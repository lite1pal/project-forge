import { describe, expect, it } from "vitest";

import {
  buildOnboardingStepViews,
  getOnboardingScreenCopy,
  getProductErrorHeading,
  getProductLoadingLabel,
  getProductMetadata,
  getShellProductConfig,
  getWorkspaceSettingsProductCopy
} from "@/app/product-module";

describe("app product module", () => {
  it("exposes metadata and chrome copy from the AuditTrail product module", () => {
    expect(getProductMetadata()).toEqual({
      description: "AuditTrail event monitoring workspace",
      title: "AuditTrail"
    });
    expect(getProductLoadingLabel()).toBe("Loading AuditTrail...");
    expect(getProductErrorHeading()).toBe("Unable to load AuditTrail");
  });

  it("builds shell navigation and onboarding views from one product boundary", () => {
    expect(
      getShellProductConfig({
        activeOrganizationId: "org-1",
        activeProjectId: "project-1"
      })
    ).toEqual({
      navItems: [
        {
          href: "/?organizationId=org-1&projectId=project-1",
          id: "events",
          label: "Events"
        }
      ],
      productName: "AuditTrail"
    });

    expect(getOnboardingScreenCopy()).toMatchObject({
      title: "Getting started",
      eyebrow: "Workspace setup"
    });

    expect(
      buildOnboardingStepViews({
        activeOnboarding: {
          completedRequiredSteps: 0,
          isComplete: false,
          isDismissed: false,
          steps: [
            {
              id: "api_key_created",
              required: true,
              status: "pending"
            }
          ],
          totalRequiredSteps: 1
        },
        activeOrganizationId: "org-1"
      })
    ).toMatchObject([
      {
        ctaHref: "/settings?organizationId=org-1#project-settings",
        ctaLabel: "Create a project first"
      }
    ]);
  });

  it("exposes workspace settings copy from the same product boundary", () => {
    expect(getWorkspaceSettingsProductCopy()).toMatchObject({
      planUsage: {
        navLabel: "Plan & usage",
        sectionTitle: "Plan & usage"
      }
    });
  });
});
