import { describe, expect, it } from "vitest";

import {
  createAuthService,
  type AuthRepo,
  type AuthSession,
  type AuthUser,
  type MagicLinkRecord
} from "../service.js";

describe("createAuthService", () => {
  it("requests and consumes a magic link to create a session", async () => {
    const repo = createInMemoryAuthRepo();
    let sentToken = "";
    const service = createAuthService(
      repo,
      {
        async sendMagicLink(input) {
          sentToken = input.token;
        }
      },
      {
        magicLinkTtlMs: 60_000,
        now: () => new Date("2026-01-01T00:00:00.000Z"),
        sessionTtlMs: 86_400_000,
        tokenSecret: "test-secret"
      }
    );

    await service.requestMagicLink("USER@example.com");
    const result = await service.createSessionFromMagicLink(
      sentToken,
      "user@example.com"
    );

    expect(result.user.email).toBe("user@example.com");
    expect(result.sessionToken).not.toBe("");
    await expect(
      service.createSessionFromMagicLink(sentToken, "user@example.com")
    ).rejects.toThrow("invalid_magic_link");
  });

  it("returns the session user for an active session", async () => {
    const repo = createInMemoryAuthRepo();
    let sentToken = "";
    const service = createAuthService(
      repo,
      {
        async sendMagicLink(input) {
          sentToken = input.token;
        }
      },
      {
        magicLinkTtlMs: 60_000,
        now: () => new Date("2026-01-01T00:00:00.000Z"),
        sessionTtlMs: 86_400_000,
        tokenSecret: "test-secret"
      }
    );

    await service.requestMagicLink("user@example.com");
    const { sessionToken } = await service.createSessionFromMagicLink(
      sentToken,
      "user@example.com"
    );

    await expect(service.getSessionUser(sessionToken)).resolves.toMatchObject({
      email: "user@example.com"
    });
  });

  it("revokes active sessions", async () => {
    const repo = createInMemoryAuthRepo();
    let sentToken = "";
    const service = createAuthService(
      repo,
      {
        async sendMagicLink(input) {
          sentToken = input.token;
        }
      },
      {
        magicLinkTtlMs: 60_000,
        now: () => new Date("2026-01-01T00:00:00.000Z"),
        sessionTtlMs: 86_400_000,
        tokenSecret: "test-secret"
      }
    );

    await service.requestMagicLink("user@example.com");
    const { sessionToken } = await service.createSessionFromMagicLink(
      sentToken,
      "user@example.com"
    );
    await service.revokeSession(sessionToken);

    await expect(service.getSessionUser(sessionToken)).resolves.toBeUndefined();
  });

  it("rejects expired magic links", async () => {
    const repo = createInMemoryAuthRepo();
    let sentToken = "";
    const service = createAuthService(
      repo,
      {
        async sendMagicLink(input) {
          sentToken = input.token;
        }
      },
      {
        magicLinkTtlMs: -1,
        now: () => new Date("2026-01-01T00:00:00.000Z"),
        sessionTtlMs: 86_400_000,
        tokenSecret: "test-secret"
      }
    );

    await service.requestMagicLink("user@example.com");

    await expect(
      service.createSessionFromMagicLink(sentToken, "user@example.com")
    ).rejects.toThrow("invalid_magic_link");
  });

  it("returns undefined for missing sessions", async () => {
    const service = createAuthService(
      createInMemoryAuthRepo(),
      {
        async sendMagicLink() {}
      },
      {
        magicLinkTtlMs: 60_000,
        sessionTtlMs: 86_400_000,
        tokenSecret: "test-secret"
      }
    );

    await expect(service.getSessionUser("missing")).resolves.toBeUndefined();
  });
});

function createInMemoryAuthRepo(): AuthRepo {
  const magicLinks: MagicLinkRecord[] = [];
  const sessions: AuthSession[] = [];
  const users: AuthUser[] = [];

  return {
    async consumeMagicLink(id, consumedAt) {
      const magicLink = magicLinks.find((item) => item.id === id);
      if (magicLink) {
        magicLink.consumedAt = consumedAt;
      }
    },
    async createMagicLink(input) {
      const record = { ...input, id: `magic-link-${magicLinks.length + 1}` };
      magicLinks.push(record);
      return record;
    },
    async createSession(input) {
      const record = { ...input, id: `session-${sessions.length + 1}` };
      sessions.push(record);
      return record;
    },
    async findMagicLinkByEmail(email) {
      return magicLinks.find((item) => item.email === email);
    },
    async findOrCreateUserByEmail(email) {
      const existing = users.find((item) => item.email === email);
      if (existing) {
        return existing;
      }

      const user = { email, id: `user-${users.length + 1}` };
      users.push(user);
      return user;
    },
    async findSessionByHash(tokenHash) {
      return sessions.find((item) => item.tokenHash === tokenHash);
    },
    async findUserById(id) {
      return users.find((item) => item.id === id);
    },
    async revokeSession(id, revokedAt) {
      const session = sessions.find((item) => item.id === id);
      if (session) {
        session.revokedAt = revokedAt;
      }
    }
  };
}
