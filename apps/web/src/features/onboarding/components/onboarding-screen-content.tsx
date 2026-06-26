import { Badge } from "@/src/components/ui/badge";
import { Card } from "@/src/components/ui/card";
import { SectionHeader } from "@/src/components/ui/section-header";
import type { CurrentUserResponse } from "@/src/features/auth/domain/schemas";
import { OnboardingSidebarToggleButton } from "@/src/features/onboarding/components/onboarding-sidebar-toggle-button";
import { OnboardingStepCard } from "@/src/features/onboarding/components/onboarding-step-card";
import type {
  OnboardingScreenCopy,
  OnboardingStepView
} from "@/src/features/onboarding/domain/onboarding-screen";

interface OnboardingScreenContentProps {
  activeOnboarding: CurrentUserResponse["memberships"][number]["onboarding"];
  activeOrganizationId: string;
  activeOrganizationName?: string;
  activeProjectId?: string;
  activeProjectName?: string;
  ingestCommand?: string;
  onboardingCopy: OnboardingScreenCopy;
  onboardingStepViews: readonly OnboardingStepView[];
  updateOnboardingStateAction: (formData: FormData) => Promise<void>;
}

export function OnboardingScreenContent({
  activeOnboarding,
  activeOrganizationId,
  activeOrganizationName,
  activeProjectId,
  activeProjectName,
  ingestCommand,
  onboardingCopy,
  onboardingStepViews,
  updateOnboardingStateAction
}: OnboardingScreenContentProps) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          description={getHeaderDescription(activeOrganizationName, activeProjectName)}
          eyebrow={onboardingCopy.eyebrow}
          title={onboardingCopy.title}
        />
        <OnboardingSidebarToggle
          activeOnboarding={activeOnboarding}
          activeOrganizationId={activeOrganizationId}
          onboardingCopy={onboardingCopy}
          updateOnboardingStateAction={updateOnboardingStateAction}
        />
      </div>

      <Card className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>
            {activeOnboarding.completedRequiredSteps} / {activeOnboarding.totalRequiredSteps} required
          </Badge>
          <span className="text-sm text-[var(--muted)]">
            {activeOnboarding.isComplete
              ? onboardingCopy.completeSummaryDescription
              : onboardingCopy.incompleteSummaryDescription}
          </span>
        </div>
      </Card>

      <section className="grid gap-4">
        {onboardingStepViews.map((step) => (
          <OnboardingStepCard
            ingestCommand={ingestCommand}
            key={step.id}
            step={step}
          />
        ))}
      </section>
    </>
  );
}

function OnboardingSidebarToggle({
  activeOnboarding,
  activeOrganizationId,
  onboardingCopy,
  updateOnboardingStateAction
}: Pick<
  OnboardingScreenContentProps,
  | "activeOnboarding"
  | "activeOrganizationId"
  | "onboardingCopy"
  | "updateOnboardingStateAction"
>) {
  return (
    <form action={updateOnboardingStateAction}>
      <input name="organizationId" type="hidden" value={activeOrganizationId} />
      <input
        name="dismissed"
        type="hidden"
        value={activeOnboarding.isDismissed ? "false" : "true"}
      />
      <OnboardingSidebarToggleButton
        dismissFromSidebarLabel={onboardingCopy.dismissFromSidebarLabel}
        isDismissed={activeOnboarding.isDismissed}
        showInSidebarLabel={onboardingCopy.showInSidebarLabel}
      />
    </form>
  );
}

function getHeaderDescription(
  activeOrganizationName?: string,
  activeProjectName?: string
) {
  if (activeProjectName) {
    return `${activeOrganizationName} / ${activeProjectName}`;
  }

  return `${activeOrganizationName} setup progress`;
}
