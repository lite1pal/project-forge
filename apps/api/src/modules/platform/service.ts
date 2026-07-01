import { z } from "zod";
import type { InstalledProductState } from "@auditrail/domain/product";
import type { PricingPlanId } from "@auditrail/domain/pricing";
import { createOpaqueToken, hashToken, verifyTokenHash } from "../auth/tokens.js";

const nameSchema = z.string().trim().min(1).max(120);
const emailSchema = z.string().trim().email().transform((value) => value.toLowerCase());
const roleSchema = z.enum(["owner", "admin", "member", "viewer"]);

export type OrganizationRole = z.infer<typeof roleSchema>;

export interface Organization {
  id: string;
  name: string;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
}

export interface Membership {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
}

export interface OrganizationMember {
  email: string;
  id: string;
  name?: string;
  role: OrganizationRole;
}

export interface Invitation {
  id: string;
  email: string;
  organizationId: string;
  role: OrganizationRole;
  expiresAt: string;
  acceptedAt?: string;
  revokedAt?: string;
}

export interface OrganizationOnboardingState {
  dismissedAt?: string;
  organizationId: string;
  userId: string;
}

export interface OrganizationInstalledProduct extends InstalledProductState {
  organizationId: string;
}

export interface PlatformRepo {
  listOrganizations(): Promise<Organization[]>;
  createOrganization(input: { name: string }): Promise<Organization>;
  createProject(input: { organizationId: string; name: string }): Promise<Project>;
  createMembership(input: {
    organizationId: string;
    role: OrganizationRole;
    userId: string;
  }): Promise<Membership>;
  createInvitation(input: {
    email: string;
    expiresAt: string;
    organizationId: string;
    role: OrganizationRole;
    tokenHash: string;
  }): Promise<Invitation>;
  acceptInvitation(input: {
    acceptedAt: string;
    invitationId: string;
    organizationId: string;
  }): Promise<void>;
  findInvitationByTokenHash(tokenHash: string): Promise<Invitation | undefined>;
  findPendingInvitationForEmail(input: {
    email: string;
    organizationId: string;
  }): Promise<Invitation | undefined>;
  findMembership(input: {
    organizationId: string;
    userId: string;
  }): Promise<Membership | undefined>;
  saveOrganizationOnboardingState(input: {
    dismissedAt?: string;
    organizationId: string;
    userId: string;
  }): Promise<OrganizationOnboardingState>;
  getOrganizationPlanId(organizationId: string): Promise<PricingPlanId | undefined>;
  installOrganizationProduct(input: {
    enabled: boolean;
    organizationId: string;
    productId: string;
  }): Promise<OrganizationInstalledProduct>;
  isOrganizationProductInstalled(input: {
    organizationId: string;
    productId: string;
  }): Promise<boolean>;
  listOrganizationMembers(organizationId: string): Promise<OrganizationMember[]>;
  listOrganizationInstalledProducts(
    organizationId: string
  ): Promise<OrganizationInstalledProduct[]>;
  listOrganizationsForUser(userId: string): Promise<Organization[]>;
  listProjects(organizationId: string): Promise<Project[]>;
  revokeInvitation(input: {
    organizationId: string;
    invitationId: string;
    revokedAt: string;
  }): Promise<void>;
  updateOrganizationPlan(input: {
    organizationId: string;
    planId: PricingPlanId;
  }): Promise<void>;
}

export interface PlatformService {
  backfillInstalledProducts(input: {
    productIds: readonly string[];
  }): Promise<{
    changedInstallations: number;
    organizationCount: number;
    productIds: readonly string[];
    unchangedInstallations: number;
  }>;
  createOrganization(input: {
    name: string;
    ownerUserId: string;
  }): Promise<{ membership: Membership; organization: Organization }>;
  createProject(input: { name: string; organizationId: string }): Promise<Project>;
  createProjectForUser(input: {
    name: string;
    organizationId: string;
    userId: string;
  }): Promise<Project>;
  inviteMember(input: {
    email: string;
    organizationId: string;
    role: OrganizationRole;
    tokenSecret: string;
    ttlMs: number;
    userId: string;
  }): Promise<{ invitation: Invitation; token: string }>;
  acceptInvitation(input: {
    now?: Date;
    token: string;
    tokenSecret: string;
    userEmail: string;
    userId: string;
  }): Promise<Membership>;
  listOrganizationMembersForUser(input: {
    organizationId: string;
    userId: string;
  }): Promise<OrganizationMember[]>;
  listOrganizationsForUser(userId: string): Promise<Organization[]>;
  listProjectsForUser(input: {
    organizationId: string;
    userId: string;
  }): Promise<Project[]>;
  revokeInvitation(input: {
    invitationId: string;
    organizationId: string;
    userId: string;
  }): Promise<void>;
  changeOrganizationPlanForUser(input: {
    organizationId: string;
    planId: PricingPlanId;
    userId: string;
  }): Promise<{ organizationId: string; planId: PricingPlanId }>;
  updateOnboardingStateForUser(input: {
    dismissed: boolean;
    organizationId: string;
    userId: string;
  }): Promise<OrganizationOnboardingState>;
}

const pricingPlanIdSchema = z.enum(["starter", "growth", "scale"]);
const productIdsSchema = z.array(z.string().trim().min(1)).min(1);

export function createPlatformService(
  repo: PlatformRepo,
  options: {
    defaultInstalledProductIds?: readonly string[];
  } = {}
): PlatformService {
  const defaultInstalledProductIds = options.defaultInstalledProductIds ?? [];

  return {
    async backfillInstalledProducts(input) {
      const productIds = [...new Set(productIdsSchema.parse(input.productIds))];
      const organizations = await repo.listOrganizations();
      let changedInstallations = 0;
      let unchangedInstallations = 0;

      for (const organization of organizations) {
        for (const productId of productIds) {
          const installed = await repo.isOrganizationProductInstalled({
            organizationId: organization.id,
            productId
          });

          if (installed) {
            unchangedInstallations += 1;
            continue;
          }

          await repo.installOrganizationProduct({
            enabled: true,
            organizationId: organization.id,
            productId
          });
          changedInstallations += 1;
        }
      }

      return {
        changedInstallations,
        organizationCount: organizations.length,
        productIds,
        unchangedInstallations
      };
    },
    async createOrganization(input) {
      const organization = await repo.createOrganization({
        name: nameSchema.parse(input.name)
      });
      await Promise.all(
        defaultInstalledProductIds.map((productId) =>
          repo.installOrganizationProduct({
            enabled: true,
            organizationId: organization.id,
            productId
          })
        )
      );
      const membership = await repo.createMembership({
        organizationId: organization.id,
        role: "owner",
        userId: input.ownerUserId
      });

      return { membership, organization };
    },
    createProject(input) {
      return repo.createProject({
        name: nameSchema.parse(input.name),
        organizationId: input.organizationId
      });
    },
    async createProjectForUser(input) {
      const membership = await repo.findMembership({
        organizationId: input.organizationId,
        userId: input.userId
      });

      assertRole(membership, ["owner", "admin"]);

      return repo.createProject({
        name: nameSchema.parse(input.name),
        organizationId: input.organizationId
      });
    },
    async inviteMember(input) {
      const membership = await repo.findMembership({
        organizationId: input.organizationId,
        userId: input.userId
      });

      assertRole(membership, ["owner", "admin"]);
      const email = emailSchema.parse(input.email);
      const existingInvitation = await repo.findPendingInvitationForEmail({
        email,
        organizationId: input.organizationId
      });

      if (existingInvitation) {
        throw new Error("duplicate_invitation");
      }

      const token = createOpaqueToken();
      const invitation = await repo.createInvitation({
        email,
        expiresAt: new Date(Date.now() + input.ttlMs).toISOString(),
        organizationId: input.organizationId,
        role: roleSchema.parse(input.role),
        tokenHash: hashToken(token, { secret: input.tokenSecret })
      });

      return { invitation, token };
    },
    async acceptInvitation(input) {
      const tokenHash = hashToken(input.token, { secret: input.tokenSecret });
      const invitation = await repo.findInvitationByTokenHash(tokenHash);
      const now = input.now ?? new Date();
      const userEmail = emailSchema.parse(input.userEmail);

      if (
        !invitation ||
        invitation.email !== userEmail ||
        invitation.acceptedAt ||
        invitation.revokedAt ||
        invitation.expiresAt < now.toISOString() ||
        !verifyTokenHash(input.token, tokenHash, { secret: input.tokenSecret })
      ) {
        throw new Error("invalid_invitation");
      }

      const existingMembership = await repo.findMembership({
        organizationId: invitation.organizationId,
        userId: input.userId
      });

      if (existingMembership) {
        await repo.acceptInvitation({
          acceptedAt: now.toISOString(),
          invitationId: invitation.id,
          organizationId: invitation.organizationId
        });

        return existingMembership;
      }

      const membership = await repo.createMembership({
        organizationId: invitation.organizationId,
        role: invitation.role,
        userId: input.userId
      });
      await repo.acceptInvitation({
        acceptedAt: now.toISOString(),
        invitationId: invitation.id,
        organizationId: invitation.organizationId
      });

      return membership;
    },
    listOrganizationsForUser(userId) {
      return repo.listOrganizationsForUser(userId);
    },
    async listOrganizationMembersForUser(input) {
      const membership = await repo.findMembership({
        organizationId: input.organizationId,
        userId: input.userId
      });

      assertRole(membership, ["owner", "admin", "member", "viewer"]);

      return repo.listOrganizationMembers(input.organizationId);
    },
    async listProjectsForUser(input) {
      const membership = await repo.findMembership({
        organizationId: input.organizationId,
        userId: input.userId
      });

      assertRole(membership, ["owner", "admin", "member", "viewer"]);

      return repo.listProjects(input.organizationId);
    },
    async revokeInvitation(input) {
      const membership = await repo.findMembership({
        organizationId: input.organizationId,
        userId: input.userId
      });

      assertRole(membership, ["owner", "admin"]);

      await repo.revokeInvitation({
        organizationId: input.organizationId,
        invitationId: input.invitationId,
        revokedAt: new Date().toISOString()
      });
    },
    async changeOrganizationPlanForUser(input) {
      const membership = await repo.findMembership({
        organizationId: input.organizationId,
        userId: input.userId
      });

      assertRole(membership, ["owner", "admin"]);

      const planId = pricingPlanIdSchema.parse(input.planId);

      await repo.updateOrganizationPlan({
        organizationId: input.organizationId,
        planId
      });

      return {
        organizationId: input.organizationId,
        planId
      };
    },
    async updateOnboardingStateForUser(input) {
      const membership = await repo.findMembership({
        organizationId: input.organizationId,
        userId: input.userId
      });

      assertRole(membership, ["owner", "admin", "member", "viewer"]);

      return repo.saveOrganizationOnboardingState({
        dismissedAt: input.dismissed ? new Date().toISOString() : undefined,
        organizationId: input.organizationId,
        userId: input.userId
      });
    }
  };
}

export function assertRole(
  membership: Membership | undefined,
  allowedRoles: OrganizationRole[]
) {
  if (!membership) {
    throw new Error("forbidden");
  }

  if (!allowedRoles.includes(membership.role)) {
    throw new Error("forbidden");
  }
}
