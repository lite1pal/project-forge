import { auditOnboardingStepIds, type AuditOnboardingStepId } from "./onboarding.js";
import { auditTrailProduct, type AuditTrailWorkspaceSettingsContent } from "./product.js";

export interface AuditTrailWorkspaceScope {
  activeOrganizationId?: string;
  activeProjectId?: string;
}

export interface AuditTrailShellProductNavItem {
  href: string;
  id: string;
  label: string;
}

export interface AuditTrailShellProductConfig {
  navItems: readonly AuditTrailShellProductNavItem[];
  productName: string;
}

export interface AuditTrailOnboardingScreenCopy {
  completeSummaryDescription: string;
  dismissFromSidebarLabel: string;
  emptyStateDescription: string;
  emptyStatePrimaryCtaHref: string;
  emptyStatePrimaryCtaLabel: string;
  eyebrow: string;
  incompleteSummaryDescription: string;
  showInSidebarLabel: string;
  title: string;
}

export interface AuditTrailActiveOnboardingStep {
  completedAt?: string;
  id: AuditOnboardingStepId;
  required: boolean;
  status: "complete" | "pending";
}

export interface AuditTrailActiveOnboarding {
  steps: readonly AuditTrailActiveOnboardingStep[];
}

export interface AuditTrailOnboardingStepView
  extends AuditTrailActiveOnboardingStep {
  ctaHref: string;
  ctaLabel: string;
  description: string;
  showsIngestCommand: boolean;
  title: string;
}

const onboardingStepContentById = Object.fromEntries(
  auditTrailProduct.onboardingContent.stepContent.map((step) => [step.stepId, step])
) as Record<
  AuditOnboardingStepId,
  (typeof auditTrailProduct.onboardingContent.stepContent)[number]
>;

const onboardingScreenCopy: AuditTrailOnboardingScreenCopy = {
  completeSummaryDescription:
    auditTrailProduct.onboardingContent.completeSummaryDescription,
  dismissFromSidebarLabel:
    auditTrailProduct.onboardingContent.dismissFromSidebarLabel,
  emptyStateDescription: auditTrailProduct.emptyStateCopy.emptyStateDescription,
  emptyStatePrimaryCtaHref:
    auditTrailProduct.emptyStateCopy.primaryCtaHref ?? "/settings",
  emptyStatePrimaryCtaLabel:
    auditTrailProduct.emptyStateCopy.primaryCtaLabel ?? "Open settings",
  eyebrow: auditTrailProduct.onboardingContent.eyebrow,
  incompleteSummaryDescription:
    auditTrailProduct.onboardingContent.incompleteSummaryDescription,
  showInSidebarLabel: auditTrailProduct.onboardingContent.showInSidebarLabel,
  title: auditTrailProduct.onboardingContent.title
};

function buildWorkspaceSuffix({
  activeOrganizationId,
  activeProjectId
}: AuditTrailWorkspaceScope) {
  if (!activeOrganizationId) {
    return "";
  }

  const query = new URLSearchParams({
    organizationId: activeOrganizationId
  });

  if (activeProjectId) {
    query.set("projectId", activeProjectId);
  }

  return `?${query.toString()}`;
}

function toWorkspaceScopedHref(baseHref: string, workspaceSuffix: string) {
  if (!workspaceSuffix || baseHref === "/") {
    return workspaceSuffix ? `/${workspaceSuffix}` : baseHref;
  }

  return `${baseHref}${workspaceSuffix}`;
}

function resolveOnboardingActionHref(
  target: string,
  activeOrganizationId: string,
  activeProjectId?: string
) {
  const hrefByTarget = {
    "access-settings": `/settings?organizationId=${activeOrganizationId}#access-settings`,
    "api-keys": activeProjectId
      ? `/api-keys?organizationId=${activeOrganizationId}&projectId=${activeProjectId}`
      : `/settings?organizationId=${activeOrganizationId}#project-settings`,
    "project-settings": `/settings?organizationId=${activeOrganizationId}#project-settings`,
    "selected-project-settings": activeProjectId
      ? `/settings?organizationId=${activeOrganizationId}&projectId=${activeProjectId}`
      : `/settings?organizationId=${activeOrganizationId}#project-settings`
  } as const;

  return hrefByTarget[target as keyof typeof hrefByTarget];
}

export const auditTrailProductModule = {
  manifest: auditTrailProduct,
  getChrome() {
    return auditTrailProduct.chrome;
  },
  getShellProductConfig(input: AuditTrailWorkspaceScope): AuditTrailShellProductConfig {
    const workspaceSuffix = buildWorkspaceSuffix(input);

    return {
      navItems: auditTrailProduct.navItems.map((item) => ({
        href: toWorkspaceScopedHref(item.href, workspaceSuffix),
        id: item.id,
        label: item.label
      })),
      productName: auditTrailProduct.name
    };
  },
  getOnboardingScreenCopy() {
    return onboardingScreenCopy;
  },
  buildOnboardingStepViews(input: {
    activeOnboarding: AuditTrailActiveOnboarding;
    activeOrganizationId: string;
    activeProjectId?: string;
  }): AuditTrailOnboardingStepView[] {
    return input.activeOnboarding.steps.map((step) => {
      const stepConfig = onboardingStepContentById[step.id];
      const action = input.activeProjectId
        ? stepConfig.action
        : (stepConfig.missingProjectAction ?? stepConfig.action);

      return {
        ...step,
        ctaHref: resolveOnboardingActionHref(
          action.target,
          input.activeOrganizationId,
          input.activeProjectId
        ),
        ctaLabel: action.label,
        description: stepConfig.description,
        showsIngestCommand: stepConfig.showsIngestCommand ?? false,
        title: stepConfig.title
      };
    });
  },
  getWorkspaceSettingsCopy(): AuditTrailWorkspaceSettingsContent {
    return auditTrailProduct.workspaceSettings;
  },
  getRuntimeRegistrations(surface: "api" | "web" | "worker") {
    return auditTrailProduct.runtime.registrations.filter(
      (registration) => registration.surface === surface
    );
  }
} as const;

export function isAuditTrailOnboardingStepId(value: string): value is AuditOnboardingStepId {
  return auditOnboardingStepIds.includes(value as AuditOnboardingStepId);
}
