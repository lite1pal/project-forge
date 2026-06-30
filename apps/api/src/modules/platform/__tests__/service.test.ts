import { describe, expect, it } from "vitest";

import {
  assertRole,
  createPlatformService,
  type Invitation,
  type Membership,
  type OrganizationMember,
  type OrganizationInstalledProduct,
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

  it("installs default products when creating an organization", async () => {
    const repo = createInMemoryPlatformRepo();
    const service = createPlatformService(repo, {
      defaultInstalledProductIds: ["audit-events"]
    });

    await service.createOrganization({
      name: "Acme",
      ownerUserId: "user-1"
    });

    expect(repo.installedProducts).toEqual([
      {
        enabled: true,
        organizationId: "org-1",
        productId: "audit-events"
      }
    ]);
  });

  it("normalizes invitation email", async () => {
    const service = createPlatformService(
      createInMemoryPlatformRepo({
        memberships: [
          {
            id: "membership-1",
            organizationId: "org-1",
            role: "admin",
            userId: "user-1"
          }
        ]
      })
    );

    const result = await service.inviteMember({
      email: "USER@example.com",
      organizationId: "org-1",
      role: "admin",
      tokenSecret: "test-secret",
      ttlMs: 60_000,
      userId: "user-1"
    });

    expect(result.invitation.email).toBe("user@example.com");
    expect(result.token).not.toBe("");
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

  it("allows admins to create projects for their organization", async () => {
    const service = createPlatformService(
      createInMemoryPlatformRepo({
        memberships: [
          {
            id: "membership-1",
            organizationId: "org-1",
            role: "admin",
            userId: "user-1"
          }
        ]
      })
    );

    const project = await service.createProjectForUser({
      name: "Production",
      organizationId: "org-1",
      userId: "user-1"
    });

    expect(project.organizationId).toBe("org-1");
  });

  it("rejects project creation for viewers", async () => {
    const service = createPlatformService(
      createInMemoryPlatformRepo({
        memberships: [
          {
            id: "membership-1",
            organizationId: "org-1",
            role: "viewer",
            userId: "user-1"
          }
        ]
      })
    );

    await expect(
      service.createProjectForUser({
        name: "Production",
        organizationId: "org-1",
        userId: "user-1"
      })
    ).rejects.toThrow("forbidden");
  });

  it("lists organization projects for members", async () => {
    const service = createPlatformService(
      createInMemoryPlatformRepo({
        memberships: [
          {
            id: "membership-1",
            organizationId: "org-1",
            role: "member",
            userId: "user-1"
          }
        ],
        projects: [
          {
            id: "project-1",
            name: "Production",
            organizationId: "org-1"
          }
        ]
      })
    );

    await expect(
      service.listProjectsForUser({
        organizationId: "org-1",
        userId: "user-1"
      })
    ).resolves.toHaveLength(1);
  });

  it("lists organizations for users", async () => {
    const service = createPlatformService(
      createInMemoryPlatformRepo({
        memberships: [
          {
            id: "membership-1",
            organizationId: "org-1",
            role: "owner",
            userId: "user-1"
          }
        ],
        organizations: [
          {
            id: "org-1",
            name: "Acme"
          }
        ]
      })
    );

    await expect(service.listOrganizationsForUser("user-1")).resolves.toEqual([
      {
        id: "org-1",
        name: "Acme"
      }
    ]);
  });

  it("lists organization members for authorized users", async () => {
    const service = createPlatformService(
      createInMemoryPlatformRepo({
        memberships: [
          {
            id: "membership-1",
            organizationId: "org-1",
            role: "member",
            userId: "user-1"
          }
        ],
        organizationMembers: [
          {
            email: "user@example.com",
            id: "user-1",
            role: "member"
          }
        ]
      })
    );

    await expect(
      service.listOrganizationMembersForUser({
        organizationId: "org-1",
        userId: "user-1"
      })
    ).resolves.toEqual([
      {
        email: "user@example.com",
        id: "user-1",
        role: "member"
      }
    ]);
  });

  it("allows admins to change organization plans", async () => {
    const repo = createInMemoryPlatformRepo({
      memberships: [
        {
          id: "membership-1",
          organizationId: "org-1",
          role: "admin",
          userId: "user-1"
        }
      ]
    });
    const service = createPlatformService(repo);

    await expect(
      service.changeOrganizationPlanForUser({
        organizationId: "org-1",
        planId: "growth",
        userId: "user-1"
      })
    ).resolves.toEqual({
      organizationId: "org-1",
      planId: "growth"
    });
    await expect(repo.getOrganizationPlanId("org-1")).resolves.toBe("growth");
  });

  it("rejects plan changes for viewers", async () => {
    const service = createPlatformService(
      createInMemoryPlatformRepo({
        memberships: [
          {
            id: "membership-1",
            organizationId: "org-1",
            role: "viewer",
            userId: "user-1"
          }
        ]
      })
    );

    await expect(
      service.changeOrganizationPlanForUser({
        organizationId: "org-1",
        planId: "growth",
        userId: "user-1"
      })
    ).rejects.toThrow("forbidden");
  });

  it("stores onboarding dismissal state for organization members", async () => {
    const repo = createInMemoryPlatformRepo({
      memberships: [
        {
          id: "membership-1",
          organizationId: "org-1",
          role: "member",
          userId: "user-1"
        }
      ]
    });
    const service = createPlatformService(repo);

    await expect(
      service.updateOnboardingStateForUser({
        dismissed: true,
        organizationId: "org-1",
        userId: "user-1"
      })
    ).resolves.toMatchObject({
      organizationId: "org-1",
      userId: "user-1"
    });
  });

  it("accepts valid invitations", async () => {
    const repo = createInMemoryPlatformRepo({
      memberships: [
        {
          id: "membership-admin",
          organizationId: "org-1",
          role: "admin",
          userId: "admin-1"
        }
      ]
    });
    const service = createPlatformService(repo);
    const result = await service.inviteMember({
      email: "user@example.com",
      organizationId: "org-1",
      role: "member",
      tokenSecret: "test-secret",
      ttlMs: 60_000,
      userId: "admin-1"
    });

    await expect(
      service.acceptInvitation({
        now: new Date("2026-01-01T00:00:00.000Z"),
        token: result.token,
        tokenSecret: "test-secret",
        userEmail: "user@example.com",
        userId: "user-1"
      })
    ).resolves.toMatchObject({
      organizationId: "org-1",
      role: "member",
      userId: "user-1"
    });
  });

  it("returns an existing membership when accepting another invitation", async () => {
    const repo = createInMemoryPlatformRepo({
      memberships: [
        {
          id: "membership-admin",
          organizationId: "org-1",
          role: "admin",
          userId: "admin-1"
        },
        {
          id: "membership-existing",
          organizationId: "org-1",
          role: "member",
          userId: "user-1"
        }
      ]
    });
    const service = createPlatformService(repo);
    const result = await service.inviteMember({
      email: "user@example.com",
      organizationId: "org-1",
      role: "viewer",
      tokenSecret: "test-secret",
      ttlMs: 60_000,
      userId: "admin-1"
    });

    await expect(
      service.acceptInvitation({
        now: new Date("2026-01-01T00:00:00.000Z"),
        token: result.token,
        tokenSecret: "test-secret",
        userEmail: "user@example.com",
        userId: "user-1"
      })
    ).resolves.toMatchObject({
      id: "membership-existing",
      role: "member"
    });
    expect(repo.memberships).toHaveLength(2);
  });

  it("rejects invitations for a different email", async () => {
    const repo = createInMemoryPlatformRepo({
      memberships: [
        {
          id: "membership-admin",
          organizationId: "org-1",
          role: "admin",
          userId: "admin-1"
        }
      ]
    });
    const service = createPlatformService(repo);
    const result = await service.inviteMember({
      email: "invited@example.com",
      organizationId: "org-1",
      role: "member",
      tokenSecret: "test-secret",
      ttlMs: 60_000,
      userId: "admin-1"
    });

    await expect(
      service.acceptInvitation({
        now: new Date("2026-01-01T00:00:00.000Z"),
        token: result.token,
        tokenSecret: "test-secret",
        userEmail: "other@example.com",
        userId: "user-1"
      })
    ).rejects.toThrow("invalid_invitation");
  });

  it("rejects duplicate pending invitations", async () => {
    const repo = createInMemoryPlatformRepo({
      memberships: [
        {
          id: "membership-admin",
          organizationId: "org-1",
          role: "admin",
          userId: "admin-1"
        }
      ]
    });
    const service = createPlatformService(repo);

    await service.inviteMember({
      email: "user@example.com",
      organizationId: "org-1",
      role: "member",
      tokenSecret: "test-secret",
      ttlMs: 60_000,
      userId: "admin-1"
    });

    await expect(
      service.inviteMember({
        email: "user@example.com",
        organizationId: "org-1",
        role: "viewer",
        tokenSecret: "test-secret",
        ttlMs: 60_000,
        userId: "admin-1"
      })
    ).rejects.toThrow("duplicate_invitation");
  });

  it("rejects invalid invitations", async () => {
    const service = createPlatformService(createInMemoryPlatformRepo());

    await expect(
      service.acceptInvitation({
        token: "bad-token",
        tokenSecret: "test-secret",
        userEmail: "user@example.com",
        userId: "user-1"
      })
    ).rejects.toThrow("invalid_invitation");
  });

  it("revokes invitations for admins", async () => {
    const repo = createInMemoryPlatformRepo({
      memberships: [
        {
          id: "membership-1",
          organizationId: "org-1",
          role: "admin",
          userId: "user-1"
        }
      ]
    });
    const service = createPlatformService(repo);

    await service.revokeInvitation({
      invitationId: "invitation-1",
      organizationId: "org-1",
      userId: "user-1"
    });

    expect(repo.revokedInvitations).toEqual(["invitation-1"]);
    expect(repo.revokedInvitationScopes).toEqual([
      {
        invitationId: "invitation-1",
        organizationId: "org-1"
      }
    ]);
  });
});

function createInMemoryPlatformRepo(
  options: {
    memberships?: Membership[];
    organizationMembers?: OrganizationMember[];
    organizations?: Organization[];
    projects?: Project[];
  } = {}
): PlatformRepo & {
  installedProducts: OrganizationInstalledProduct[];
  invitations: Invitation[];
  memberships: Membership[];
  revokedInvitationScopes: Array<{
    invitationId: string;
    organizationId: string;
  }>;
  revokedInvitations: string[];
} {
  const organizations: Organization[] = [...(options.organizations ?? [])];
  const projects: Project[] = [...(options.projects ?? [])];
  const memberships: Membership[] = [...(options.memberships ?? [])];
  const installedProducts: OrganizationInstalledProduct[] = [];
  const organizationMembers: OrganizationMember[] = [
    ...(options.organizationMembers ?? [])
  ];
  const invitations: Invitation[] = [];
  const revokedInvitations: string[] = [];
  const revokedInvitationScopes: Array<{
    invitationId: string;
    organizationId: string;
  }> = [];
  const organizationPlans = new Map<string, "starter" | "growth" | "scale">(
    organizations.map((organization) => [organization.id, "starter"])
  );

  return {
    installedProducts,
    invitations,
    memberships,
    revokedInvitationScopes,
    revokedInvitations,
    async acceptInvitation(input) {
      const invitation = invitations.find(
        (item) =>
          item.id === input.invitationId &&
          item.organizationId === input.organizationId
      );
      if (invitation) {
        invitation.acceptedAt = input.acceptedAt;
      }
    },
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
    async installOrganizationProduct(input) {
      const existingProduct = installedProducts.find(
        (product) =>
          product.organizationId === input.organizationId &&
          product.productId === input.productId
      );

      if (existingProduct) {
        existingProduct.enabled = input.enabled;
        return existingProduct;
      }

      const record = {
        enabled: input.enabled,
        organizationId: input.organizationId,
        productId: input.productId
      };
      installedProducts.push(record);

      return record;
    },
    async createProject(input) {
      const record = { ...input, id: `project-${projects.length + 1}` };
      projects.push(record);
      return record;
    },
    async findMembership(input) {
      return memberships.find(
        (membership) =>
          membership.organizationId === input.organizationId &&
          membership.userId === input.userId
      );
    },
    async getOrganizationPlanId(organizationId) {
      return organizationPlans.get(organizationId);
    },
    async isOrganizationProductInstalled(input) {
      return installedProducts.some(
        (product) =>
          product.organizationId === input.organizationId &&
          product.productId === input.productId &&
          product.enabled
      );
    },
    async listOrganizationInstalledProducts(organizationId) {
      return installedProducts.filter(
        (product) => product.organizationId === organizationId
      );
    },
    async saveOrganizationOnboardingState(input) {
      return {
        dismissedAt: input.dismissedAt,
        organizationId: input.organizationId,
        userId: input.userId
      };
    },
    async findInvitationByTokenHash(tokenHash) {
      return invitations.find(
        (invitation) => "tokenHash" in invitation && invitation.tokenHash === tokenHash
      );
    },
    async findPendingInvitationForEmail(input) {
      return invitations.find(
        (invitation) =>
          invitation.email === input.email &&
          invitation.organizationId === input.organizationId &&
          !invitation.acceptedAt &&
          !invitation.revokedAt
      );
    },
    async listOrganizationsForUser(userId) {
      return organizations.filter((organization) =>
        memberships.some(
          (membership) =>
            membership.organizationId === organization.id &&
            membership.userId === userId
        )
      );
    },
    async listOrganizationMembers() {
      return organizationMembers;
    },
    async listProjects(organizationId) {
      return projects.filter((project) => project.organizationId === organizationId);
    },
    async revokeInvitation(input) {
      revokedInvitations.push(input.invitationId);
      revokedInvitationScopes.push({
        invitationId: input.invitationId,
        organizationId: input.organizationId
      });
    },
    async updateOrganizationPlan(input) {
      organizationPlans.set(input.organizationId, input.planId);
    }
  } as PlatformRepo & {
    installedProducts: OrganizationInstalledProduct[];
    invitations: Invitation[];
    memberships: Membership[];
    revokedInvitationScopes: typeof revokedInvitationScopes;
    revokedInvitations: string[];
  };
}

describe("assertRole", () => {
  it("rejects missing memberships", () => {
    expect(() => assertRole(undefined, ["owner"])).toThrow("forbidden");
  });
});
