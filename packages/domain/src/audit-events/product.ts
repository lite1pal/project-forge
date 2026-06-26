import type { ProductDefinition } from "../product/index.js";

import {
  auditOnboardingStepIds,
  auditOnboardingSteps
} from "./onboarding.js";

export type AuditTrailOnboardingActionHref =
  | "access-settings"
  | "api-keys"
  | "project-settings"
  | "selected-project-settings";

export interface AuditTrailOnboardingAction {
  href: AuditTrailOnboardingActionHref;
  label: string;
}

export interface AuditTrailOnboardingStepContent {
  action: AuditTrailOnboardingAction;
  description: string;
  missingProjectAction?: AuditTrailOnboardingAction;
  showsIngestCommand?: boolean;
  title: string;
}

export interface AuditTrailOnboardingContent {
  completeSummaryDescription: string;
  dismissFromSidebarLabel: string;
  eyebrow: string;
  incompleteSummaryDescription: string;
  showInSidebarLabel: string;
  steps: Readonly<Record<(typeof auditOnboardingStepIds)[number], AuditTrailOnboardingStepContent>>;
  title: string;
}

export interface AuditTrailAppChromeContent {
  errorHeading: string;
  loadingLabel: string;
  metadataDescription: string;
  metadataTitle: string;
}

type AuditTrailProductDefinition = ProductDefinition & {
  appChrome: AuditTrailAppChromeContent;
  onboarding: AuditTrailOnboardingContent;
};

export const auditTrailProduct = {
  emptyStateCopy: {
    emptyStateDescription:
      "No organization is available yet. Create a workspace first, then come back here for the guided setup flow.",
    emptyStateTitle: "Getting started",
    primaryCtaHref: "/settings",
    primaryCtaLabel: "Open settings"
  },
  id: "audit-events",
  name: "AuditTrail",
  appChrome: {
    errorHeading: "Unable to load AuditTrail",
    loadingLabel: "Loading AuditTrail...",
    metadataDescription: "AuditTrail event monitoring workspace",
    metadataTitle: "AuditTrail"
  },
  navItems: [
    {
      href: "/",
      id: "events",
      label: "Events"
    }
  ],
  onboardingSteps: auditOnboardingSteps,
  onboarding: {
    completeSummaryDescription: "Required setup is complete.",
    dismissFromSidebarLabel: "Dismiss from sidebar",
    eyebrow: "Workspace setup",
    incompleteSummaryDescription:
      "Finish the required steps to complete the initial workspace setup.",
    showInSidebarLabel: "Show in sidebar",
    steps: {
      api_key_created: {
        action: {
          href: "api-keys",
          label: "Create first API key"
        },
        description: "Generate a machine credential in the existing API keys flow.",
        missingProjectAction: {
          href: "project-settings",
          label: "Create a project first"
        },
        title: "Create an API key"
      },
      first_event_ingested: {
        action: {
          href: "selected-project-settings",
          label: "Send first event"
        },
        description:
          "Send one test event through the selected project to validate the full ingest path.",
        missingProjectAction: {
          href: "project-settings",
          label: "Create a project first"
        },
        showsIngestCommand: true,
        title: "Send the first event"
      },
      member_invited: {
        action: {
          href: "access-settings",
          label: "Invite teammate"
        },
        description:
          "Add another member from the workspace access settings when you are ready.",
        title: "Invite a teammate"
      },
      project_created: {
        action: {
          href: "project-settings",
          label: "Create first project"
        },
        description:
          "Create the first project for this organization in workspace settings.",
        title: "Create a project"
      }
    },
    title: "Getting started"
  },
  usageMeters: [
    {
      key: "events",
      label: "Events"
    }
  ]
} satisfies AuditTrailProductDefinition;
