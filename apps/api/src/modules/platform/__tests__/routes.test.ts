import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerPlatformRoutes } from "../routes.js";
import type { PlatformService } from "../service.js";

describe("registerPlatformRoutes", () => {
  it("lists organizations for the current user", async () => {
    const app = buildTestApp({
      async listOrganizationsForUser(userId) {
        expect(userId).toBe("user-1");

        return [{ id: "org-1", name: "Acme" }];
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/organizations"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      organizations: [{ id: "org-1", name: "Acme" }]
    });
  });

  it("creates organizations for the current user", async () => {
    const app = buildTestApp({
      async createOrganization(input) {
        expect(input).toEqual({
          name: "Acme",
          ownerUserId: "user-1"
        });

        return {
          membership: {
            id: "membership-1",
            organizationId: "org-1",
            role: "owner",
            userId: "user-1"
          },
          organization: { id: "org-1", name: "Acme" }
        };
      }
    });

    const response = await app.inject({
      method: "POST",
      payload: { name: "Acme" },
      url: "/organizations"
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().organization).toEqual({ id: "org-1", name: "Acme" });
  });

  it("lists projects for organization members", async () => {
    const app = buildTestApp({
      async listProjectsForUser(input) {
        expect(input).toEqual({
          organizationId: "org-1",
          userId: "user-1"
        });

        return [{ id: "project-1", name: "Production", organizationId: "org-1" }];
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/organizations/org-1/projects"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      projects: [{ id: "project-1", name: "Production", organizationId: "org-1" }]
    });
  });

  it("creates projects for admins", async () => {
    const app = buildTestApp({
      async createProjectForUser(input) {
        expect(input).toEqual({
          name: "Production",
          organizationId: "org-1",
          userId: "user-1"
        });

        return { id: "project-1", name: "Production", organizationId: "org-1" };
      }
    });

    const response = await app.inject({
      method: "POST",
      payload: { name: "Production" },
      url: "/organizations/org-1/projects"
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      project: { id: "project-1", name: "Production", organizationId: "org-1" }
    });
  });

  it("lists organization members for organization members", async () => {
    const app = buildTestApp({
      async listOrganizationMembersForUser(input) {
        expect(input).toEqual({
          organizationId: "org-1",
          userId: "user-1"
        });

        return [
          {
            email: "user@example.com",
            id: "user-1",
            name: "Casey",
            role: "owner"
          }
        ];
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/organizations/org-1/members"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      members: [
        {
          email: "user@example.com",
          id: "user-1",
          name: "Casey",
          role: "owner"
        }
      ]
    });
  });

  it("requires a session", async () => {
    const app = buildTestApp({}, { session: false });

    const response = await app.inject({
      method: "GET",
      url: "/organizations"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "missing_session" });
  });

  it("requires a session when creating organizations", async () => {
    const app = buildTestApp({}, { session: false });

    const response = await app.inject({
      method: "POST",
      payload: { name: "Acme" },
      url: "/organizations"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "missing_session" });
  });

  it("rejects invalid organization creation bodies", async () => {
    const app = buildTestApp({});

    const response = await app.inject({
      method: "POST",
      payload: { name: "" },
      url: "/organizations"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "invalid_organization_request" });
  });

  it("requires a session when listing projects", async () => {
    const app = buildTestApp({}, { session: false });

    const response = await app.inject({
      method: "GET",
      url: "/organizations/org-1/projects"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "missing_session" });
  });

  it("requires a session when listing organization members", async () => {
    const app = buildTestApp({}, { session: false });

    const response = await app.inject({
      method: "GET",
      url: "/organizations/org-1/members"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "missing_session" });
  });

  it("requires a session when creating projects", async () => {
    const app = buildTestApp({}, { session: false });

    const response = await app.inject({
      method: "POST",
      payload: { name: "Production" },
      url: "/organizations/org-1/projects"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "missing_session" });
  });

  it("rejects invalid project creation bodies", async () => {
    const app = buildTestApp({});

    const response = await app.inject({
      method: "POST",
      payload: { name: "" },
      url: "/organizations/org-1/projects"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "invalid_project_request" });
  });

  it("maps forbidden project access to 403", async () => {
    const app = buildTestApp({
      async listProjectsForUser() {
        throw new Error("forbidden");
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/organizations/org-1/projects"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
  });

  it("maps forbidden project creation to 403", async () => {
    const app = buildTestApp({
      async createProjectForUser() {
        throw new Error("forbidden");
      }
    });

    const response = await app.inject({
      method: "POST",
      payload: { name: "Production" },
      url: "/organizations/org-1/projects"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
  });

  it("maps forbidden member reads to 403", async () => {
    const app = buildTestApp({
      async listOrganizationMembersForUser() {
        throw new Error("forbidden");
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/organizations/org-1/members"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
  });

  it("creates invitations for organization admins", async () => {
    const app = buildTestApp({
      async inviteMember(input) {
        expect(input).toMatchObject({
          email: "user@example.com",
          organizationId: "org-1",
          role: "member",
          userId: "user-1"
        });

        return {
          invitation: {
            email: "user@example.com",
            expiresAt: "2026-01-01T00:00:00.000Z",
            id: "invitation-1",
            organizationId: "org-1",
            role: "member"
          },
          token: "token"
        };
      }
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        email: "user@example.com",
        role: "member"
      },
      url: "/organizations/org-1/invitations"
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().token).toBe("token");
  });

  it("changes organization plans for owners and admins", async () => {
    const app = buildTestApp({
      async changeOrganizationPlanForUser(input) {
        expect(input).toEqual({
          organizationId: "org-1",
          planId: "growth",
          userId: "user-1"
        });

        return {
          organizationId: "org-1",
          planId: "growth"
        };
      }
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        planId: "growth"
      },
      url: "/organizations/org-1/plan"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      organizationId: "org-1",
      planId: "growth"
    });
  });

  it("rejects invalid plan change bodies", async () => {
    const app = buildTestApp({});

    const response = await app.inject({
      method: "POST",
      payload: {
        planId: "enterprise"
      },
      url: "/organizations/org-1/plan"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "invalid_plan_change_request" });
  });

  it("maps forbidden plan changes to 403", async () => {
    const app = buildTestApp({
      async changeOrganizationPlanForUser() {
        throw new Error("forbidden");
      }
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        planId: "growth"
      },
      url: "/organizations/org-1/plan"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
  });

  it("requires a session when creating invitations", async () => {
    const app = buildTestApp({}, { session: false });

    const response = await app.inject({
      method: "POST",
      payload: {
        email: "user@example.com",
        role: "member"
      },
      url: "/organizations/org-1/invitations"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "missing_session" });
  });

  it("rejects invalid invitation creation bodies", async () => {
    const app = buildTestApp({});

    const response = await app.inject({
      method: "POST",
      payload: {
        email: "not-an-email",
        role: "member"
      },
      url: "/organizations/org-1/invitations"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "invalid_invitation_request" });
  });

  it("maps forbidden invitation creation to 403", async () => {
    const app = buildTestApp({
      async inviteMember() {
        throw new Error("forbidden");
      }
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        email: "user@example.com",
        role: "member"
      },
      url: "/organizations/org-1/invitations"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
  });

  it("accepts invitations for the current user", async () => {
    const app = buildTestApp({
      async acceptInvitation(input) {
        expect(input).toMatchObject({
          token: "token",
          userId: "user-1"
        });

        return {
          id: "membership-1",
          organizationId: "org-1",
          role: "member",
          userId: "user-1"
        };
      }
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        token: "token"
      },
      url: "/invitations/accept"
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().membership.role).toBe("member");
  });

  it("requires a session when accepting invitations", async () => {
    const app = buildTestApp({}, { session: false });

    const response = await app.inject({
      method: "POST",
      payload: {
        token: "token"
      },
      url: "/invitations/accept"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "missing_session" });
  });

  it("rejects invalid invitation acceptance bodies", async () => {
    const app = buildTestApp({});

    const response = await app.inject({
      method: "POST",
      payload: {},
      url: "/invitations/accept"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "invalid_invitation_request" });
  });

  it("revokes invitations for organization admins", async () => {
    const revoked: string[] = [];
    const app = buildTestApp({
      async revokeInvitation(input) {
        revoked.push(input.invitationId);
      }
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        organizationId: "org-1"
      },
      url: "/invitations/invitation-1/revoke"
    });

    expect(response.statusCode).toBe(204);
    expect(revoked).toEqual(["invitation-1"]);
  });

  it("requires a session when revoking invitations", async () => {
    const app = buildTestApp({}, { session: false });

    const response = await app.inject({
      method: "POST",
      payload: {
        organizationId: "org-1"
      },
      url: "/invitations/invitation-1/revoke"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "missing_session" });
  });

  it("rejects invalid invitation revoke bodies", async () => {
    const app = buildTestApp({});

    const response = await app.inject({
      method: "POST",
      payload: {},
      url: "/invitations/invitation-1/revoke"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "invalid_invitation_request" });
  });

  it("maps forbidden invitation revocation to 403", async () => {
    const app = buildTestApp({
      async revokeInvitation() {
        throw new Error("forbidden");
      }
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        organizationId: "org-1"
      },
      url: "/invitations/invitation-1/revoke"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
  });

  it("maps invalid invitation tokens to 401", async () => {
    const app = buildTestApp({
      async acceptInvitation() {
        throw new Error("invalid_invitation");
      }
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        token: "bad-token"
      },
      url: "/invitations/accept"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "invalid_invitation" });
  });

  it("surfaces unexpected invitation acceptance failures as 500 responses", async () => {
    const app = buildTestApp({
      async acceptInvitation() {
        throw new Error("boom");
      }
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        token: "ok-token"
      },
      url: "/invitations/accept"
    });

    expect(response.statusCode).toBe(500);
  });

  it("updates onboarding state for organization members", async () => {
    const app = buildTestApp({
      async updateOnboardingStateForUser(input) {
        expect(input).toEqual({
          dismissed: true,
          organizationId: "org-1",
          userId: "user-1"
        });

        return {
          dismissedAt: "2026-06-25T12:00:00.000Z",
          organizationId: "org-1",
          userId: "user-1"
        };
      }
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        dismissed: true
      },
      url: "/organizations/org-1/onboarding-state"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      onboardingState: {
        dismissedAt: "2026-06-25T12:00:00.000Z",
        organizationId: "org-1",
        userId: "user-1"
      }
    });
  });

  it("requires a session when updating onboarding state", async () => {
    const app = buildTestApp({}, { session: false });

    const response = await app.inject({
      method: "POST",
      payload: {
        dismissed: true
      },
      url: "/organizations/org-1/onboarding-state"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "missing_session" });
  });

  it("maps forbidden onboarding state updates to 403", async () => {
    const app = buildTestApp({
      async updateOnboardingStateForUser() {
        throw new Error("forbidden");
      }
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        dismissed: false
      },
      url: "/organizations/org-1/onboarding-state"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
  });

  it("rejects invalid onboarding state bodies", async () => {
    const app = buildTestApp({});

    const response = await app.inject({
      method: "POST",
      payload: {},
      url: "/organizations/org-1/onboarding-state"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "invalid_onboarding_state_request"
    });
  });

  it("surfaces unexpected onboarding state failures as 500 responses", async () => {
    const app = buildTestApp({
      async updateOnboardingStateForUser() {
        throw new Error("boom");
      }
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        dismissed: true
      },
      url: "/organizations/org-1/onboarding-state"
    });

    expect(response.statusCode).toBe(500);
  });
});

function buildTestApp(
  overrides: Partial<PlatformService>,
  options: { session?: boolean } = {}
) {
  const app = Fastify();
  app.decorateRequest("sessionUser");
  app.addHook("preHandler", async (request) => {
    if (options.session === false) {
      return;
    }

    request.sessionUser = {
      email: "user@example.com",
      id: "user-1"
    };
  });
  app.register(registerPlatformRoutes, {
    service: createPlatformServiceStub(overrides)
  });

  return app;
}

function createPlatformServiceStub(
  overrides: Partial<PlatformService>
): PlatformService {
  return {
    async acceptInvitation() {
      throw new Error("not implemented");
    },
    async backfillInstalledProducts() {
      return {
        changedInstallations: 0,
        organizationCount: 0,
        productIds: [],
        unchangedInstallations: 0
      };
    },
    async createOrganization() {
      throw new Error("not implemented");
    },
    async createProject() {
      throw new Error("not implemented");
    },
    async createProjectForUser() {
      throw new Error("not implemented");
    },
    async inviteMember() {
      throw new Error("not implemented");
    },
    async changeOrganizationPlanForUser() {
      throw new Error("not implemented");
    },
    async listOrganizationMembersForUser() {
      return [];
    },
    async listOrganizationsForUser() {
      return [];
    },
    async listProjectsForUser() {
      return [];
    },
    async revokeInvitation() {},
    async updateOnboardingStateForUser() {
      return {
        organizationId: "org-1",
        userId: "user-1"
      };
    },
    ...overrides
  };
}
