import { describe, expect, it } from "vitest";

import {
  createPlatformService,
  type Invitation,
  type Membership,
  type Organization,
  type PlatformRepo,
  type Project
} from "../service.js";

describe("createPlatformService", () => {
  it("creates an organization with an owner membership", async () => {
    const service = createPlatformService(createInMemoryPlatformRepo());

    const result = await service.createOrganization({
      name: "Acme",
      ownerUserId: "user-1"
    });

    expect(result.organization.name).toBe("Acme");
    expect(result.membership.role).toBe("owner");
  });

  it("normalizes invitation email", async () => {
    const service = createPlatformService(createInMemoryPlatformRepo());

    const invitation = await service.inviteMember({
      email: "USER@example.com",
      expiresAt: "2026-01-01T00:00:00.000Z",
      organizationId: "org-1",
      role: "admin"
    });

    expect(invitation.email).toBe("user@example.com");
  });

  it("creates projects with normalized names", async () => {
    const service = createPlatformService(createInMemoryPlatformRepo());

    const project = await service.createProject({
      name: " Audit Trail ",
      organizationId: "org-1"
    });

    expect(project).toMatchObject({
      name: "Audit Trail",
      organizationId: "org-1"
    });
  });
});

function createInMemoryPlatformRepo(): PlatformRepo {
  const organizations: Organization[] = [];
  const projects: Project[] = [];
  const memberships: Membership[] = [];
  const invitations: Invitation[] = [];

  return {
    async createInvitation(input) {
      const record = { ...input, id: `invitation-${invitations.length + 1}` };
      invitations.push(record);
      return record;
    },
    async createMembership(input) {
      const record = { ...input, id: `membership-${memberships.length + 1}` };
      memberships.push(record);
      return record;
    },
    async createOrganization(input) {
      const record = { ...input, id: `org-${organizations.length + 1}` };
      organizations.push(record);
      return record;
    },
    async createProject(input) {
      const record = { ...input, id: `project-${projects.length + 1}` };
      projects.push(record);
      return record;
    }
  };
}
