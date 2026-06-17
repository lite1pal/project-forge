import { z } from "zod";

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

export interface Invitation {
  id: string;
  email: string;
  organizationId: string;
  role: OrganizationRole;
  expiresAt: string;
  acceptedAt?: string;
  revokedAt?: string;
}

export interface PlatformRepo {
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
  }): Promise<Invitation>;
}

export interface PlatformService {
  createOrganization(input: {
    name: string;
    ownerUserId: string;
  }): Promise<{ membership: Membership; organization: Organization }>;
  createProject(input: { name: string; organizationId: string }): Promise<Project>;
  inviteMember(input: {
    email: string;
    expiresAt: string;
    organizationId: string;
    role: OrganizationRole;
  }): Promise<Invitation>;
}

export function createPlatformService(repo: PlatformRepo): PlatformService {
  return {
    async createOrganization(input) {
      const organization = await repo.createOrganization({
        name: nameSchema.parse(input.name)
      });
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
    inviteMember(input) {
      return repo.createInvitation({
        email: emailSchema.parse(input.email),
        expiresAt: input.expiresAt,
        organizationId: input.organizationId,
        role: roleSchema.parse(input.role)
      });
    }
  };
}
