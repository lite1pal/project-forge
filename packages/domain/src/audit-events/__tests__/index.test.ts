import { describe, expect, it } from "vitest";

import { productDefinitionSchema } from "../../product/index.js";

import {
  auditTrailProduct,
  auditOnboardingSteps,
  ingestAuditEventSchema,
  toAuditOnboardingCompletedAtByStep
} from "../index.js";

describe("audit event schemas", () => {
  it("accepts the MVP ingestion shape", () => {
    expect(
      ingestAuditEventSchema.parse({
        event: "user.deleted",
        actor: "admin_123",
        target: "user_456",
        metadata: {
          reason: "GDPR request"
        }
      })
    ).toEqual({
      event: "user.deleted",
      actor: "admin_123",
      target: "user_456",
      metadata: {
        reason: "GDPR request"
      }
    });
  });

  it("defaults metadata to an empty object", () => {
    expect(
      ingestAuditEventSchema.parse({
        event: "login.succeeded"
      })
    ).toEqual({
      event: "login.succeeded",
      metadata: {}
    });
  });

  it("rejects blank event names", () => {
    expect(() =>
      ingestAuditEventSchema.parse({
        event: " "
      })
    ).toThrow();
  });

  it("exposes the audit onboarding milestone catalog", () => {
    expect(auditOnboardingSteps).toEqual([
      {
        id: "project_created",
        required: true
      },
      {
        id: "api_key_created",
        required: true
      },
      {
        id: "first_event_ingested",
        required: true
      },
      {
        id: "member_invited",
        required: false
      }
    ]);
  });

  it("maps audit milestones into generic onboarding facts", () => {
    expect(
      toAuditOnboardingCompletedAtByStep({
        apiKeyCreatedAt: "2026-06-25T12:01:00.000Z",
        firstEventIngestedAt: "2026-06-25T12:02:00.000Z",
        memberInvitedAt: "2026-06-25T12:03:00.000Z",
        projectCreatedAt: "2026-06-25T12:00:00.000Z"
      })
    ).toEqual({
      api_key_created: "2026-06-25T12:01:00.000Z",
      first_event_ingested: "2026-06-25T12:02:00.000Z",
      member_invited: "2026-06-25T12:03:00.000Z",
      project_created: "2026-06-25T12:00:00.000Z"
    });
  });

  it("exposes an explicit AuditTrail product definition", () => {
    expect(productDefinitionSchema.parse(auditTrailProduct)).toEqual(
      {
        emptyStateCopy: {
          emptyStateDescription:
            "No organization is available yet. Create a workspace first, then come back here for the guided setup flow.",
          emptyStateTitle: "Getting started",
          primaryCtaHref: "/settings",
          primaryCtaLabel: "Open settings"
        },
        id: "audit-events",
        name: "AuditTrail",
        navItems: [
          {
            href: "/",
            id: "events",
            label: "Events"
          }
        ],
        onboardingSteps: auditOnboardingSteps,
        usageMeters: [
          {
            key: "events",
            label: "Events"
          }
        ]
      }
    );

    expect(auditTrailProduct).toMatchObject({
      id: "audit-events",
      name: "AuditTrail",
      navItems: [
        {
          href: "/",
          id: "events",
          label: "Events"
        }
      ],
      onboardingSteps: auditOnboardingSteps,
      usageMeters: [
        {
          key: "events",
          label: "Events"
        }
      ],
      onboarding: {
        steps: {
          api_key_created: {
            action: {
              href: "api-keys",
              label: "Create first API key"
            }
          },
          first_event_ingested: {
            action: {
              href: "selected-project-settings",
              label: "Send first event"
            },
            showsIngestCommand: true
          }
        }
      },
      appChrome: {
        errorHeading: "Unable to load AuditTrail",
        loadingLabel: "Loading AuditTrail...",
        metadataDescription: "AuditTrail event monitoring workspace",
        metadataTitle: "AuditTrail"
      }
    });
  });
});
