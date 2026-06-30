import type { Metadata } from "next";

import {
  auditTrailProductModule,
  isAuditTrailOnboardingStepId
} from "@auditrail/domain/audit-events";

import type {
  OnboardingScreenCopy,
  OnboardingStepView
} from "@/src/features/onboarding/domain/onboarding-screen";
import type { CurrentUserResponse } from "@/src/features/auth/domain/schemas";
import type { WorkspaceSettingsProductCopy } from "@/src/features/organizations/components/workspace-settings-screen.types";

export function getProductMetadata(): Metadata {
  const chrome = auditTrailProductModule.getChrome();

  return {
    description: chrome.metadataDescription,
    title: chrome.metadataTitle
  };
}

export function getProductLoadingLabel() {
  return auditTrailProductModule.getChrome().loadingLabel;
}

export function getProductErrorHeading() {
  return auditTrailProductModule.getChrome().errorHeading;
}

export function getShellProductConfig(input: {
  activeOrganizationId?: string;
  activeProjectId?: string;
}) {
  return auditTrailProductModule.getShellProductConfig(input);
}

export function getOnboardingScreenCopy(): OnboardingScreenCopy {
  return auditTrailProductModule.getOnboardingScreenCopy();
}

export function buildOnboardingStepViews(input: {
  activeOnboarding: CurrentUserResponse["memberships"][number]["onboarding"];
  activeOrganizationId: string;
  activeProjectId?: string;
}): OnboardingStepView[] {
  return auditTrailProductModule.buildOnboardingStepViews({
    ...input,
    activeOnboarding: {
      steps: input.activeOnboarding.steps.map((step) => {
        if (!isAuditTrailOnboardingStepId(step.id)) {
          throw new Error(`unsupported_audit_onboarding_step:${step.id}`);
        }

        return step;
      })
    }
  });
}

export function getWorkspaceSettingsProductCopy(): WorkspaceSettingsProductCopy {
  return auditTrailProductModule.getWorkspaceSettingsCopy();
}
