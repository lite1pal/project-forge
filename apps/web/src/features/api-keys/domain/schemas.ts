import { z } from "zod";

export const managedApiKeySchema = z.object({
  createdAt: z.string(),
  id: z.string(),
  keyPrefix: z.string(),
  lastUsedAt: z.string().optional(),
  name: z.string(),
  projectId: z.string(),
  revoked: z.boolean()
});

export const listApiKeysResponseSchema = z.object({
  apiKeys: z.array(managedApiKeySchema)
});

export const createApiKeyResponseSchema = z.object({
  apiKey: managedApiKeySchema,
  rawKey: z.string()
});

export type ManagedApiKey = z.infer<typeof managedApiKeySchema>;
