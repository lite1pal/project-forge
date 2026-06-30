import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerAuthRoutes } from "../routes.js";
import type { AuthService } from "../service.js";

describe("registerAuthRoutes", () => {
  it("requests magic links without leaking account state", async () => {
    const calls: string[] = [];
    const app = buildTestApp({
      service: createAuthServiceStub({
        async requestMagicLink(email) {
          calls.push(email);
        }
      })
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        email: "user@example.com"
      },
      url: "/auth/magic-links"
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({
      accepted: true
    });
    expect(calls).toEqual(["user@example.com"]);
  });

  it("rejects invalid magic-link requests", async () => {
    const app = buildTestApp({
      service: createAuthServiceStub()
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        email: "not-an-email"
      },
      url: "/auth/magic-links"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "invalid_auth_request"
    });
  });

  it("creates sessions and sets an HttpOnly cookie", async () => {
    const app = buildTestApp({
      service: createAuthServiceStub({
        async createSessionFromMagicLink() {
          return {
            session: {
              expiresAt: "2026-01-02T00:00:00.000Z",
              id: "session-1",
              tokenHash: "hash",
              userId: "user-1"
            },
            sessionToken: "session-token",
            user: {
              email: "user@example.com",
              id: "user-1"
            }
          };
        }
      })
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        email: "user@example.com",
        token: "magic-token"
      },
      url: "/auth/sessions"
    });

    expect(response.statusCode).toBe(201);
    expect(response.headers["set-cookie"]).toContain(
      "auditrail_session=session-token"
    );
    expect(response.headers["set-cookie"]).toContain("HttpOnly");
    expect(response.json()).toEqual({
      user: {
        email: "user@example.com",
        id: "user-1"
      }
    });
  });

  it("uses secure session cookies by default", async () => {
    const app = Fastify();
    app.register(registerAuthRoutes, {
      service: createAuthServiceStub({
        async createSessionFromMagicLink() {
          return {
            session: {
              expiresAt: "2026-01-02T00:00:00.000Z",
              id: "session-1",
              tokenHash: "hash",
              userId: "user-1"
            },
            sessionToken: "session-token",
            user: {
              email: "user@example.com",
              id: "user-1"
            }
          };
        }
      })
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        email: "user@example.com",
        token: "magic-token"
      },
      url: "/auth/sessions"
    });

    expect(response.headers["set-cookie"]).toContain("Secure");
  });

  it("confirms a session and redirects back to the web app", async () => {
    const app = buildTestApp({
      cookie: {
        domain: "example.com",
        secure: false
      },
      service: createAuthServiceStub({
        async createSessionFromMagicLink(token, email) {
          expect(token).toBe("magic-token");
          expect(email).toBe("user@example.com");

          return {
            session: {
              expiresAt: "2026-01-02T00:00:00.000Z",
              id: "session-1",
              tokenHash: "hash",
              userId: "user-1"
            },
            sessionToken: "session-token",
            user: {
              email: "user@example.com",
              id: "user-1"
            }
          };
        }
      }),
      webPublicUrl: "https://app.example.com"
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/sessions/confirm?email=user%40example.com&token=magic-token&redirectTo=%2Fsettings%3ForganizationId%3Dorg-1"
    });

    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toBe(
      "https://app.example.com/settings?organizationId=org-1"
    );
    expect(response.headers["set-cookie"]).toContain("Domain=example.com");
    expect(response.headers["set-cookie"]).toContain(
      "auditrail_session=session-token"
    );
  });

  it("accepts browser form posts for confirmation redirects", async () => {
    const app = buildTestApp({
      cookie: {
        secure: false
      },
      service: createAuthServiceStub({
        async createSessionFromMagicLink(token, email) {
          expect(token).toBe("magic-token");
          expect(email).toBe("user@example.com");

          return {
            session: {
              expiresAt: "2026-01-02T00:00:00.000Z",
              id: "session-1",
              tokenHash: "hash",
              userId: "user-1"
            },
            sessionToken: "session-token",
            user: {
              email: "user@example.com",
              id: "user-1"
            }
          };
        }
      }),
      webPublicUrl: "https://app.example.com"
    });

    const response = await app.inject({
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      method: "POST",
      payload: "",
      url: "/auth/sessions/confirm?email=user%40example.com&token=magic-token&redirectTo=%2F"
    });

    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toBe("https://app.example.com/");
    expect(response.headers["set-cookie"]).toContain("auditrail_session=session-token");
  });

  it("redirects invalid confirmation attempts to sign-in", async () => {
    const app = buildTestApp({
      service: createAuthServiceStub({
        async createSessionFromMagicLink() {
          throw new Error("invalid_magic_link");
        }
      }),
      webPublicUrl: "https://app.example.com"
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/sessions/confirm?email=user%40example.com&token=bad-token"
    });

    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toBe(
      "https://app.example.com/auth/sign-in?error=invalid_magic_link"
    );
  });

  it("redirects malformed confirmation requests to sign-in", async () => {
    const app = buildTestApp({
      service: createAuthServiceStub(),
      webPublicUrl: "https://app.example.com"
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/sessions/confirm?email=user%40example.com"
    });

    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toBe(
      "https://app.example.com/auth/sign-in?error=invalid_magic_link"
    );
  });

  it("rejects invalid magic links", async () => {
    const app = buildTestApp({
      service: createAuthServiceStub({
        async createSessionFromMagicLink() {
          throw new Error("invalid_magic_link");
        }
      })
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        email: "user@example.com",
        token: "bad-token"
      },
      url: "/auth/sessions"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "invalid_magic_link"
    });
  });

  it("rethrows unexpected session creation failures", async () => {
    const app = buildTestApp({
      service: createAuthServiceStub({
        async createSessionFromMagicLink() {
          throw new Error("boom");
        }
      })
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        email: "user@example.com",
        token: "magic-token"
      },
      url: "/auth/sessions"
    });

    expect(response.statusCode).toBe(500);
  });

  it("rethrows unexpected confirmation failures", async () => {
    const app = buildTestApp({
      service: createAuthServiceStub({
        async createSessionFromMagicLink() {
          throw new Error("boom");
        }
      }),
      webPublicUrl: "https://app.example.com"
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/sessions/confirm?email=user%40example.com&token=magic-token"
    });

    expect(response.statusCode).toBe(500);
  });

  it("rejects invalid session requests", async () => {
    const app = buildTestApp({
      service: createAuthServiceStub()
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        email: "user@example.com"
      },
      url: "/auth/sessions"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "invalid_auth_request"
    });
  });

  it("returns the current session user", async () => {
    const app = buildTestApp({
      currentUserContext: {
        async getCurrentUserContext(user) {
          return {
            memberships: [
              {
                installedProducts: [
                  {
                    enabled: true,
                    productId: "audit-events"
                  }
                ],
                membership: {
                  id: "membership-1",
                  organizationId: "org-1",
                  role: "owner",
                  userId: user.id
                },
                onboarding: {
                  completedRequiredSteps: 0,
                  isComplete: false,
                  isDismissed: false,
                  steps: [
                    {
                      id: "project_created",
                      required: true,
                      status: "pending"
                    },
                    {
                      id: "api_key_created",
                      required: true,
                      status: "pending"
                    },
                    {
                      id: "first_event_ingested",
                      required: true,
                      status: "pending"
                    },
                    {
                      id: "member_invited",
                      required: false,
                      status: "pending"
                    }
                  ],
                  totalRequiredSteps: 3
                },
                organization: {
                  id: "org-1",
                  name: "Acme"
                },
                plan: {
                  id: "starter",
                  includedEvents: 100000,
                  name: "Starter",
                  periodEnd: "2026-07-01T00:00:00.000Z",
                  periodStart: "2026-06-01T00:00:00.000Z",
                  remainingEvents: 99999,
                  usedEvents: 1
                },
                planId: "starter",
                projects: [
                  {
                    id: "project-1",
                    name: "Production",
                    organizationId: "org-1"
                  }
                ],
                usedEvents: 1
              }
            ],
            user
          };
        }
      },
      service: createAuthServiceStub({
        async getSessionUser(sessionToken) {
          expect(sessionToken).toBe("session-token");

          return {
            email: "user@example.com",
            id: "user-1"
          };
        }
      })
    });

    const response = await app.inject({
      headers: {
        cookie: "auditrail_session=session-token"
      },
      method: "GET",
      url: "/me"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      memberships: [
        {
          installedProducts: [
            {
              enabled: true,
              productId: "audit-events"
            }
          ],
          onboarding: {
            completedRequiredSteps: 0,
            isComplete: false,
            isDismissed: false,
            steps: [
              {
                id: "project_created",
                required: true,
                status: "pending"
              },
              {
                id: "api_key_created",
                required: true,
                status: "pending"
              },
              {
                id: "first_event_ingested",
                required: true,
                status: "pending"
              },
              {
                id: "member_invited",
                required: false,
                status: "pending"
              }
            ],
            totalRequiredSteps: 3
          },
          organization: {
            id: "org-1",
            name: "Acme"
          },
          organizationId: "org-1",
          plan: {
            id: "starter",
            includedEvents: 100000,
            name: "Starter",
            periodEnd: "2026-07-01T00:00:00.000Z",
            periodStart: "2026-06-01T00:00:00.000Z",
            remainingEvents: 99999,
            usedEvents: 1
          },
          projectIds: ["project-1"],
          projects: [
            {
              id: "project-1",
              name: "Production",
              organizationId: "org-1"
            }
          ],
          role: "owner"
        }
      ],
      user: {
        email: "user@example.com",
        id: "user-1"
      }
    });
  });

  it("rejects missing sessions", async () => {
    const app = buildTestApp({
      service: createAuthServiceStub()
    });

    const response = await app.inject({
      method: "GET",
      url: "/me"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "missing_session"
    });
  });

  it("revokes the current session and expires the cookie", async () => {
    const revokedTokens: string[] = [];
    const app = buildTestApp({
      service: createAuthServiceStub({
        async revokeSession(sessionToken) {
          revokedTokens.push(sessionToken);
        }
      })
    });

    const response = await app.inject({
      headers: {
        cookie: "auditrail_session=session-token"
      },
      method: "DELETE",
      url: "/auth/sessions/current"
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["set-cookie"]).toContain("Max-Age=0");
    expect(revokedTokens).toEqual(["session-token"]);
  });

  it("expires the session cookie even when no session is present", async () => {
    const app = buildTestApp({
      service: createAuthServiceStub()
    });

    const response = await app.inject({
      method: "DELETE",
      url: "/auth/sessions/current"
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["set-cookie"]).toContain("Max-Age=0");
  });

  it("logs out through the redirect endpoint and expires the shared cookie", async () => {
    const revokedTokens: string[] = [];
    const app = buildTestApp({
      cookie: {
        domain: "example.com",
        secure: false
      },
      service: createAuthServiceStub({
        async revokeSession(sessionToken) {
          revokedTokens.push(sessionToken);
        }
      }),
      webPublicUrl: "https://app.example.com"
    });

    const response = await app.inject({
      headers: {
        cookie: "auditrail_session=session-token"
      },
      method: "POST",
      url: "/auth/sessions/current/logout?redirectTo=%2Fauth%2Fsign-in"
    });

    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toBe("https://app.example.com/auth/sign-in");
    expect(response.headers["set-cookie"]).toContain("Domain=example.com");
    expect(response.headers["set-cookie"]).toContain("Max-Age=0");
    expect(revokedTokens).toEqual(["session-token"]);
  });

  it("accepts browser form posts for logout redirects", async () => {
    const revokedTokens: string[] = [];
    const app = buildTestApp({
      service: createAuthServiceStub({
        async revokeSession(sessionToken) {
          revokedTokens.push(sessionToken);
        }
      }),
      webPublicUrl: "https://app.example.com"
    });

    const response = await app.inject({
      headers: {
        cookie: "auditrail_session=session-token",
        "content-type": "application/x-www-form-urlencoded"
      },
      method: "POST",
      payload: "",
      url: "/auth/sessions/current/logout?redirectTo=%2Fauth%2Fsign-in"
    });

    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toBe("https://app.example.com/auth/sign-in");
    expect(response.headers["set-cookie"]).toContain("Max-Age=0");
    expect(revokedTokens).toEqual(["session-token"]);
  });

  it("falls back to the sign-in page when logout receives an unsafe redirect", async () => {
    const app = buildTestApp({
      service: createAuthServiceStub(),
      webPublicUrl: "https://app.example.com"
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/sessions/current/logout?redirectTo=%2Fauth%2Fsign-in&redirectTo=%2Fsettings"
    });

    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toBe("https://app.example.com/auth/sign-in");
  });
});

function buildTestApp(options: Parameters<typeof registerAuthRoutes>[1]) {
  const app = Fastify();
  app.register(registerAuthRoutes, {
    cookie: {
      secure: false
    },
    webPublicUrl: "http://localhost:3000",
    ...options
  });
  return app;
}

function createAuthServiceStub(
  overrides: Partial<AuthService> = {}
): AuthService {
  return {
    async createSessionFromMagicLink() {
      throw new Error("not implemented");
    },
    async getSessionUser() {
      return undefined;
    },
    async requestMagicLink() {},
    async revokeSession() {},
    ...overrides
  };
}
