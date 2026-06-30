import { describe, expect, it } from "vitest";

import { auditTrailProductModule } from "../product-module.js";

describe("auditTrailProductModule", () => {
  it("builds workspace-aware shell navigation from the product manifest", () => {
    expect(
      auditTrailProductModule.getShellProductConfig({
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
  });

  it("builds onboarding copy and project-aware step views from the product manifest", () => {
    expect(auditTrailProductModule.getOnboardingScreenCopy()).toMatchObject({
      title: "Getting started",
      eyebrow: "Workspace setup",
      emptyStatePrimaryCtaHref: "/settings",
      emptyStatePrimaryCtaLabel: "Open settings"
    });

    expect(
      auditTrailProductModule.buildOnboardingStepViews({
        activeOnboarding: {
          steps: [
            {
              completedAt: "2026-06-25T10:00:00.000Z",
              id: "project_created",
              required: true,
              status: "complete"
            },
            {
              id: "api_key_created",
              required: true,
              status: "pending"
            },
            {
              id: "first_event_ingested",
              required: true,
              status: "pending"
            }
          ]
        },
        activeOrganizationId: "org-1",
        activeProjectId: "project-1"
      })
    ).toMatchObject([
      {
        ctaHref: "/settings?organizationId=org-1#project-settings",
        ctaLabel: "Create first project"
      },
      {
        ctaHref: "/api-keys?organizationId=org-1&projectId=project-1",
        ctaLabel: "Create first API key"
      },
      {
        ctaHref: "/settings?organizationId=org-1&projectId=project-1",
        ctaLabel: "Send first event",
        showsIngestCommand: true
      }
    ]);
  });

  it("exposes declared runtime registrations by surface", () => {
    expect(
      auditTrailProductModule
        .getRuntimeRegistrations("api")
        .map((registration) => registration.target)
    ).toEqual(["audit-events-routes"]);
    expect(
      auditTrailProductModule
        .getRuntimeRegistrations("web")
        .map((registration) => registration.target)
    ).toEqual(["audit-product-navigation", "audit-product-onboarding"]);
  });
});
