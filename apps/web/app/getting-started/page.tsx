import { AppShell } from "@/src/components/layout/app-shell";
import { requireCurrentUser } from "@/src/features/auth/server/auth-server";
import { OnboardingScreen } from "@/src/features/onboarding/components/onboarding-screen";
import {
  loadOnboardingPage,
  updateOnboardingStateAction
} from "@/src/features/onboarding/server/onboarding-server";

import {
  buildAuditTrailOnboardingStepViews,
  getAuditTrailOnboardingScreenCopy
} from "./audit-product-onboarding";
import { getAuditTrailShellProductConfig } from "@/app/audit-product-navigation";

interface GettingStartedPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function GettingStartedPage({
  searchParams
}: GettingStartedPageProps) {
  const currentUser = await requireCurrentUser();
  const onboarding = await loadOnboardingPage(await searchParams, {
    currentUser
  });
  const onboardingCopy = getAuditTrailOnboardingScreenCopy();
  const shellProduct = getAuditTrailShellProductConfig({
    activeOrganizationId: onboarding.activeOrganizationId,
    activeProjectId: onboarding.activeProjectId
  });
  const onboardingStepViews =
    onboarding.activeOnboarding && onboarding.activeOrganizationId
      ? buildAuditTrailOnboardingStepViews({
          activeOnboarding: onboarding.activeOnboarding,
          activeOrganizationId: onboarding.activeOrganizationId,
          activeProjectId: onboarding.activeProjectId
        })
      : undefined;

  return (
    <AppShell
      activeOrganizationId={onboarding.activeOrganizationId}
      activeProjectId={onboarding.activeProjectId}
      currentUser={currentUser}
      productName={shellProduct.productName}
      productNavItems={shellProduct.navItems}
    >
      <OnboardingScreen
        activeOnboarding={onboarding.activeOnboarding}
        activeOrganizationId={onboarding.activeOrganizationId}
        activeOrganizationName={onboarding.activeOrganizationName}
        activeProjectId={onboarding.activeProjectId}
        activeProjectName={onboarding.activeProjectName}
        ingestCommand={onboarding.ingestCommand}
        onboardingCopy={onboardingCopy}
        onboardingStepViews={onboardingStepViews}
        updateOnboardingStateAction={updateOnboardingStateAction}
      />
    </AppShell>
  );
}
