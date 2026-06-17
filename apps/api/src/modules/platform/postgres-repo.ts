import {
  organizationInvitations,
  organizationMemberships,
  organizations,
  projects
} from "@auditrail/db/schema";
import { and, eq } from "drizzle-orm";

import type { AppDatabase } from "../../plugins/database.js";
import type { UserContextRepo, UserMembershipContext } from "./context.js";
import type {
  Invitation,
  Membership,
  Organization,
  PlatformRepo,
  Project
} from "./service.js";

export function createPostgresPlatformRepo(
  db: AppDatabase
): PlatformRepo & UserContextRepo {
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

      if (!record) {
        return undefined;
      }

      return toMembership(record);
    },
    async findInvitationByTokenHash(tokenHash) {
      const [record] = await db
        .select()
        .from(organizationInvitations)
        .where(eq(organizationInvitations.tokenHash, tokenHash))
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
    async listProjects(organizationId) {
      const records = await db
        .select()
        .from(projects)
        .where(eq(projects.organizationId, organizationId));

      return records.map(toProject);
    },
    async listUserMembershipContexts(userId) {
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
      const contexts: UserMembershipContext[] = [];

      for (const record of records) {
        const projectRecords = await db
          .select()
          .from(projects)
          .where(eq(projects.organizationId, record.organization.id));

        contexts.push({
          membership: toMembership(record.membership),
          organization: toOrganization(record.organization),
          projects: projectRecords.map(toProject)
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
