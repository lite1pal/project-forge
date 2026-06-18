import { z } from "zod";

import { createOpaqueToken } from "../auth/tokens.js";
import { parseApiKey } from "./keys.js";
import type { Membership, OrganizationRole } from "../platform/service.js";

const apiKeyNameSchema = z.string().trim().min(1).max(120);

export interface ManagedApiKey {
  id: string;
  projectId: string;
  keyPrefix: string;
  name: string;
  revoked: boolean;
  createdAt: string;
  lastUsedAt?: string;
}

export interface ApiKeyRepo {
  create(input: {
    keyHash: string;
    keyPrefix: string;
    name: string;
    projectId: string;
  }): Promise<ManagedApiKey>;
  findMembership(input: {
    organizationId: string;
    userId: string;
  }): Promise<Membership | undefined>;
  findProject(input: {
    organizationId: string;
    projectId: string;
  }): Promise<{ id: string } | undefined>;
  listByProject(input: {
    projectId: string;
  }): Promise<ManagedApiKey[]>;
  revoke(input: {
    apiKeyId: string;
    projectId: string;
  }): Promise<boolean>;
}

export interface ApiKeyService {
  createApiKeyForUser(input: {
    name: string;
    organizationId: string;
    projectId: string;
    userId: string;
  }): Promise<{ apiKey: ManagedApiKey; rawKey: string }>;
  listApiKeysForUser(input: {
    organizationId: string;
    projectId: string;
    userId: string;
  }): Promise<ManagedApiKey[]>;
  revokeApiKeyForUser(input: {
    apiKeyId: string;
    organizationId: string;
    projectId: string;
    userId: string;
  }): Promise<void>;
}

export function createApiKeyService(
  repo: ApiKeyRepo,
  options: { pepper: string }
): ApiKeyService {
  return {
    async createApiKeyForUser(input) {
      await assertProjectAccess(repo, input, ["owner", "admin"]);
      const rawKey = generateApiKey();
      const parsed = parseApiKey(rawKey, options.pepper);
      const apiKey = await repo.create({
        keyHash: parsed.hash,
        keyPrefix: parsed.prefix,
        name: apiKeyNameSchema.parse(input.name),
        projectId: input.projectId
      });

      return { apiKey, rawKey };
    },
    async listApiKeysForUser(input) {
      await assertProjectAccess(repo, input, ["owner", "admin", "member", "viewer"]);

      return repo.listByProject({
        projectId: input.projectId
      });
    },
    async revokeApiKeyForUser(input) {
      await assertProjectAccess(repo, input, ["owner", "admin"]);
      const revoked = await repo.revoke({
        apiKeyId: input.apiKeyId,
        projectId: input.projectId
      });

      if (!revoked) {
        throw new Error("api_key_not_found");
      }
    }
  };
}

async function assertProjectAccess(
  repo: ApiKeyRepo,
  input: {
    organizationId: string;
    projectId: string;
    userId: string;
  },
  allowedRoles: OrganizationRole[]
) {
  const membership = await repo.findMembership({
    organizationId: input.organizationId,
    userId: input.userId
  });

  assertRole(membership, allowedRoles);

  const project = await repo.findProject({
    organizationId: input.organizationId,
    projectId: input.projectId
  });

  if (!project) {
    throw new Error("project_not_found");
  }
}

export function assertRole(
  membership: Membership | undefined,
  allowedRoles: OrganizationRole[]
) {
  if (!membership || !allowedRoles.includes(membership.role)) {
    throw new Error("forbidden");
  }
}

export function generateApiKey() {
  const prefix = `atl${createOpaqueToken(6).replace(/[^a-zA-Z0-9]/g, "").slice(0, 10)}`;
  const secret = createOpaqueToken(24);

  return `${prefix}_${secret}`;
}
