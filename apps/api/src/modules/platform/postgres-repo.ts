import {
  apiKeys,
  auditEvents,
  organizationMonthlyUsage,
  organizationInvitations,
  organizationMemberships,
  organizations,
  projects,
  userOrganizationOnboardingStates,
  users
} from "@auditrail/db/schema";
import {
  summarizeOnboardingProgress,
} from "@auditrail/domain";
import { getUtcMonthWindow } from "@auditrail/domain/pricing";
import type { PricingPlanId } from "@auditrail/domain/pricing";
import { and, asc, eq, isNull } from "drizzle-orm";

import type { AppDatabase } from "../../plugins/database.js";
import type { UserContextRepo, UserMembershipContextRecord } from "./context.js";
import type { PlatformEntitlementRepo } from "./entitlements/service.js";
import {
  platformAuditOnboardingSteps,
  toPlatformAuditOnboardingCompletedAtByStep
} from "./onboarding.js";
import type {
  Invitation,
  Membership,
  OrganizationMember,
  Organization,
  PlatformRepo,
  Project
} from "./service.js";

export function createPostgresPlatformRepo(
  db: AppDatabase,
  options: {
    now?: () => Date;
  } = {}
): PlatformRepo & UserContextRepo & PlatformEntitlementRepo {
  const now = options.now ?? (() => new Date());
  const usageMeterKey = "events";

  return {
    async acceptInvitation(input) {
      await db
        .update(organizationInvitations)
        .set({
          acceptedAt: new Date(input.acceptedAt)
        })
        .where(eq(organizationInvitations.id, input.invitationId));
    },
    async createInvitation(input) {
      const [record] = await db
        .insert(organizationInvitations)
        .values({
          email: input.email,
          expiresAt: new Date(input.expiresAt),
          organizationId: input.organizationId,
          role: input.role,
          tokenHash: input.tokenHash
        })
        .returning();

      return toInvitation(record);
    },
    async createMembership(input) {
      const [record] = await db
        .insert(organizationMemberships)
        .values(input)
        .returning();

      return toMembership(record);
    },
    async createOrganization(input) {
      const [record] = await db.insert(organizations).values(input).returning();

      return toOrganization(record);
    },
    async createProject(input) {
      const [record] = await db.insert(projects).values(input).returning();

      return toProject(record);
    },
    async findMembership(input) {
      const [record] = await db
        .select()
        .from(organizationMemberships)
        .where(
          and(
            eq(organizationMemberships.organizationId, input.organizationId),
            eq(organizationMemberships.userId, input.userId)
          )
        )
        .limit(1);

      if (!record || record.userId !== input.userId) {
        return undefined;
      }

      return toMembership(record);
    },
    async getOrganizationPlanId(organizationId) {
      const [record] = await db
        .select({
          planId: organizations.planId
        })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);

      return record?.planId as PricingPlanId | undefined;
    },
    async getOrganizationEntitlementSnapshot(input) {
      const [organizationRecord] = await db
        .select({
          id: organizations.id,
          planId: organizations.planId
        })
        .from(organizations)
        .where(eq(organizations.id, input.organizationId))
        .limit(1);

      if (!organizationRecord) {
        return undefined;
      }

      const usageRecords = await db
        .select({
          meterKey: organizationMonthlyUsage.meterKey,
          usedUnits: organizationMonthlyUsage.quantity
        })
        .from(organizationMonthlyUsage)
        .where(
          and(
            eq(organizationMonthlyUsage.organizationId, input.organizationId),
            eq(
              organizationMonthlyUsage.monthStart,
              new Date(input.periodStart)
            )
          )
        );

      return {
        meterUsage: usageRecords.map((usageRecord) => ({
          meterKey: usageRecord.meterKey,
          usedUnits: usageRecord.usedUnits
        })),
        organizationId: organizationRecord.id,
        planId: organizationRecord.planId as PricingPlanId | undefined
      };
    },
    async saveOrganizationOnboardingState(input) {
      const [record] = await db
        .insert(userOrganizationOnboardingStates)
        .values({
          dismissedAt: input.dismissedAt ? new Date(input.dismissedAt) : null,
          organizationId: input.organizationId,
          updatedAt: new Date(),
          userId: input.userId
        })
        .onConflictDoUpdate({
          set: {
            dismissedAt: input.dismissedAt ? new Date(input.dismissedAt) : null,
            updatedAt: new Date()
          },
          target: [
            userOrganizationOnboardingStates.organizationId,
            userOrganizationOnboardingStates.userId
          ]
        })
        .returning();

      return {
        dismissedAt: record.dismissedAt?.toISOString(),
        organizationId: record.organizationId,
        userId: record.userId
      };
    },
    async findInvitationByTokenHash(tokenHash) {
      const [record] = await db
        .select()
        .from(organizationInvitations)
        .where(eq(organizationInvitations.tokenHash, tokenHash))
        .limit(1);

      return record ? toInvitation(record) : undefined;
    },
    async findPendingInvitationForEmail(input) {
      const [record] = await db
        .select()
        .from(organizationInvitations)
        .where(
          and(
            eq(organizationInvitations.organizationId, input.organizationId),
            eq(organizationInvitations.email, input.email),
            isNull(organizationInvitations.acceptedAt),
            isNull(organizationInvitations.revokedAt)
          )
        )
        .limit(1);

      return record ? toInvitation(record) : undefined;
    },
    async listOrganizationsForUser(userId) {
      const records = await db
        .select({
          organization: organizations
        })
        .from(organizationMemberships)
        .innerJoin(
          organizations,
          eq(organizations.id, organizationMemberships.organizationId)
        )
        .where(eq(organizationMemberships.userId, userId));

      return records.map((record) => toOrganization(record.organization));
    },
    async listOrganizationMembers(organizationId) {
      const records = await db
        .select({
          membership: organizationMemberships,
          user: users
        })
        .from(organizationMemberships)
        .innerJoin(users, eq(users.id, organizationMemberships.userId))
        .where(eq(organizationMemberships.organizationId, organizationId));

      return records.map((record) => ({
        email: record.user.email,
        id: record.user.id,
        name: record.user.name ?? undefined,
        role: record.membership.role as OrganizationMember["role"]
      }));
    },
    async listProjects(organizationId) {
      const records = await db
        .select()
        .from(projects)
        .where(eq(projects.organizationId, organizationId));

      return records.map(toProject);
    },
    async listUserMembershipContexts(userId) {
      const currentWindow = getUtcMonthWindow(now());
      const records = await db
        .select({
          membership: organizationMemberships,
          organization: organizations
        })
        .from(organizationMemberships)
        .innerJoin(
          organizations,
          eq(organizations.id, organizationMemberships.organizationId)
        )
        .where(eq(organizationMemberships.userId, userId));
      const contexts: UserMembershipContextRecord[] = [];
      const seenOrganizations = new Set<string>();

      for (const record of records) {
        if (seenOrganizations.has(record.organization.id)) {
          continue;
        }

        seenOrganizations.add(record.organization.id);

        const projectRecords = await db
          .select()
          .from(projects)
          .where(eq(projects.organizationId, record.organization.id));
        const [usageRecord] = await db
          .select({
            quantity: organizationMonthlyUsage.quantity
          })
          .from(organizationMonthlyUsage)
          .where(
            and(
              eq(organizationMonthlyUsage.organizationId, record.organization.id),
              eq(
                organizationMonthlyUsage.monthStart,
                new Date(currentWindow.periodStart)
              ),
              eq(
                organizationMonthlyUsage.meterKey,
                usageMeterKey
              )
            )
          )
          .limit(1);
        const [firstProjectRecord] = await db
          .select({
            createdAt: projects.createdAt
          })
          .from(projects)
          .where(eq(projects.organizationId, record.organization.id))
          .orderBy(asc(projects.createdAt), asc(projects.id))
          .limit(1);
        const [firstApiKeyRecord] = await db
          .select({
            createdAt: apiKeys.createdAt
          })
          .from(apiKeys)
          .innerJoin(projects, eq(projects.id, apiKeys.projectId))
          .where(eq(projects.organizationId, record.organization.id))
          .orderBy(asc(apiKeys.createdAt), asc(apiKeys.id))
          .limit(1);
        const [firstEventRecord] = await db
          .select({
            createdAt: auditEvents.createdAt
          })
          .from(auditEvents)
          .where(eq(auditEvents.organizationId, record.organization.id))
          .orderBy(asc(auditEvents.createdAt), asc(auditEvents.id))
          .limit(1);
        const [firstInvitationRecord] = await db
          .select({
            createdAt: organizationInvitations.createdAt
          })
          .from(organizationInvitations)
          .where(eq(organizationInvitations.organizationId, record.organization.id))
          .orderBy(
            asc(organizationInvitations.createdAt),
            asc(organizationInvitations.id)
          )
          .limit(1);
        const [onboardingStateRecord] = await db
          .select({
            dismissedAt: userOrganizationOnboardingStates.dismissedAt
          })
          .from(userOrganizationOnboardingStates)
          .where(
            and(
              eq(
                userOrganizationOnboardingStates.organizationId,
                record.organization.id
              ),
              eq(userOrganizationOnboardingStates.userId, userId)
            )
          )
          .limit(1);

        contexts.push({
          membership: toMembership(record.membership),
          onboarding: summarizeOnboardingProgress({
            completedAtByStep: toPlatformAuditOnboardingCompletedAtByStep({
              apiKeyCreatedAt: firstApiKeyRecord?.createdAt?.toISOString(),
              firstEventIngestedAt: firstEventRecord?.createdAt?.toISOString(),
              memberInvitedAt: firstInvitationRecord?.createdAt?.toISOString(),
              projectCreatedAt: firstProjectRecord?.createdAt?.toISOString()
            }),
            dismissedAt: onboardingStateRecord?.dismissedAt?.toISOString(),
            steps: platformAuditOnboardingSteps
          }),
          organization: toOrganization(record.organization),
          planId: record.organization.planId as PricingPlanId,
          projects: projectRecords.map(toProject),
          usedEvents: usageRecord?.quantity ?? 0
        });
      }

      return contexts;
    },
    async revokeInvitation(input) {
      await db
        .update(organizationInvitations)
        .set({
          revokedAt: new Date(input.revokedAt)
        })
        .where(eq(organizationInvitations.id, input.invitationId));
    },
    async updateOrganizationPlan(input) {
      await db
        .update(organizations)
        .set({
          planId: input.planId
        })
        .where(eq(organizations.id, input.organizationId));
    }
  };
}

function toInvitation(
  record: typeof organizationInvitations.$inferSelect
): Invitation {
  return {
    acceptedAt: record.acceptedAt?.toISOString(),
    email: record.email,
    expiresAt: record.expiresAt.toISOString(),
    id: record.id,
    organizationId: record.organizationId,
    revokedAt: record.revokedAt?.toISOString(),
    role: record.role as Invitation["role"]
  };
}

function toMembership(
  record: typeof organizationMemberships.$inferSelect
): Membership {
  return {
    id: record.id,
    organizationId: record.organizationId,
    role: record.role as Membership["role"],
    userId: record.userId
  };
}

function toOrganization(record: typeof organizations.$inferSelect): Organization {
  return {
    id: record.id,
    name: record.name
  };
}

function toProject(record: typeof projects.$inferSelect): Project {
  return {
    id: record.id,
    name: record.name,
    organizationId: record.organizationId
  };
}
