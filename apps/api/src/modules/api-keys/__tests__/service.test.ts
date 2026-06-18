import { describe, expect, it } from "vitest";

import { createApiKeyService } from "../service.js";
import type { ApiKeyRepo } from "../service.js";

describe("createApiKeyService", () => {
  it("creates an API key for admins", async () => {
    const repo = createRepo();
    const service = createApiKeyService(repo, {
      pepper: "test-api-key-pepper"
    });

    const result = await service.createApiKeyForUser({
      name: "Production ingest",
      organizationId: "org-1",
      projectId: "project-1",
      userId: "user-1"
    });

    expect(result.apiKey.name).toBe("Production ingest");
    expect(result.apiKey.projectId).toBe("project-1");
    expect(result.rawKey).toMatch(/^atl[a-zA-Z0-9]+_/);
    expect(repo.created[0]?.keyHash).toHaveLength(64);
  });

  it("lists API keys for viewers", async () => {
    const repo = createRepo({
      apiKeys: [
        {
          createdAt: "2026-06-18T10:00:00.000Z",
          id: "key-1",
          keyPrefix: "atlabc",
          name: "Production",
          projectId: "project-1",
          revoked: false
        }
      ],
      membershipRole: "viewer"
    });
    const service = createApiKeyService(repo, {
      pepper: "test-api-key-pepper"
    });

    await expect(
      service.listApiKeysForUser({
        organizationId: "org-1",
        projectId: "project-1",
        userId: "user-1"
      })
    ).resolves.toEqual(repo.apiKeys);
  });

  it("revokes API keys for admins", async () => {
    const repo = createRepo();
    const service = createApiKeyService(repo, {
      pepper: "test-api-key-pepper"
    });

    await service.revokeApiKeyForUser({
      apiKeyId: "key-1",
      organizationId: "org-1",
      projectId: "project-1",
      userId: "user-1"
    });

    expect(repo.revocations).toEqual([
      {
        apiKeyId: "key-1",
        projectId: "project-1"
      }
    ]);
  });

  it("rejects users without access", async () => {
    const service = createApiKeyService(
      createRepo({
        membershipRole: null
      }),
      {
        pepper: "test-api-key-pepper"
      }
    );

    await expect(
      service.createApiKeyForUser({
        name: "Production ingest",
        organizationId: "org-1",
        projectId: "project-1",
        userId: "user-1"
      })
    ).rejects.toThrow("forbidden");
  });

  it("rejects missing projects", async () => {
    const service = createApiKeyService(
      createRepo({
        project: null
      }),
      {
        pepper: "test-api-key-pepper"
      }
    );

    await expect(
      service.listApiKeysForUser({
        organizationId: "org-1",
        projectId: "project-1",
        userId: "user-1"
      })
    ).rejects.toThrow("project_not_found");
  });
});

function createRepo(
  overrides: {
    apiKeys?: Awaited<ReturnType<ApiKeyRepo["listByProject"]>>;
    membershipRole?: "owner" | "admin" | "member" | "viewer" | null;
    project?: { id: string } | null;
  } = {}
) {
  const created: Array<{
    keyHash: string;
    keyPrefix: string;
    name: string;
    projectId: string;
  }> = [];
  const revocations: Array<{
    apiKeyId: string;
    projectId: string;
  }> = [];
  const apiKeys = overrides.apiKeys ?? [];

  const repo: ApiKeyRepo & {
    apiKeys: typeof apiKeys;
    created: typeof created;
    revocations: typeof revocations;
  } = {
    apiKeys,
    created,
    async create(input) {
      created.push(input);

      return {
        createdAt: "2026-06-18T10:00:00.000Z",
        id: "key-1",
        keyPrefix: input.keyPrefix,
        name: input.name,
        projectId: input.projectId,
        revoked: false
      };
    },
    async findMembership() {
      if (overrides.membershipRole === null) {
        return undefined;
      }

      const role = overrides.membershipRole ?? "owner";

      return {
        id: "membership-1",
        organizationId: "org-1",
        role,
        userId: "user-1"
      };
    },
    async findProject() {
      if (overrides.project === null) {
        return undefined;
      }

      return overrides.project ?? { id: "project-1" };
    },
    async listByProject() {
      return apiKeys;
    },
    async revoke(input) {
      revocations.push(input);
      return true;
    },
    revocations
  };

  return repo;
}
