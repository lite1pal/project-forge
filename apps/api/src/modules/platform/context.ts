import { summarizePricingUsage } from "@auditrail/domain/pricing";
import type { InstalledProductState } from "@auditrail/domain/product";
import type {
  OnboardingSummary,
  PricingPlanId,
  PricingUsageSummary
} from "@auditrail/domain";

import type { AuthUser } from "../auth/service.js";
import type { PlatformAuditOnboardingStepId } from "./onboarding.js";
import type { Membership, Organization, Project } from "./service.js";

export interface UserMembershipContext {
  installedProducts: InstalledProductState[];
  membership: Membership;
  onboarding: OnboardingSummary<PlatformAuditOnboardingStepId>;
  organization: Organization;
  plan: PricingUsageSummary;
  projects: Project[];
}

export interface UserMembershipContextRecord {
  installedProducts: InstalledProductState[];
  onboarding: OnboardingSummary<PlatformAuditOnboardingStepId>;
  membership: Membership;
  organization: Organization;
  planId: PricingPlanId;
  projects: Project[];
  usedEvents: number;
}

export interface CurrentUserContext {
  memberships: UserMembershipContext[];
  user: AuthUser;
}

export interface UserContextRepo {
  listUserMembershipContexts(userId: string): Promise<UserMembershipContextRecord[]>;
}

export interface CurrentUserContextService {
  getCurrentUserContext(user: AuthUser): Promise<CurrentUserContext>;
}

export function createCurrentUserContextService(
  repo: UserContextRepo,
  options: {
    now?: () => Date;
  } = {}
): CurrentUserContextService {
  const now = options.now ?? (() => new Date());

  return {
    async getCurrentUserContext(user) {
      const currentDate = now();
      const memberships = await repo.listUserMembershipContexts(user.id);

      return {
        memberships: memberships.map((membership) => ({
          installedProducts: membership.installedProducts,
          membership: membership.membership,
          onboarding: membership.onboarding,
          organization: membership.organization,
          plan: summarizePricingUsage({
            now: currentDate,
            planId: membership.planId,
            usedEvents: membership.usedEvents
          }),
          projects: membership.projects
        })),
        user
      };
    }
  };
}
