import { describe, expect, it } from "vitest";

import type {
  ApiClient,
  ApiRequestOptions
} from "../../../lib/api/api-client";
import { createApiKeysClient } from "../api/api-keys-client";

describe("createApiKeysClient", () => {
  it("creates API keys through the API client", async () => {
    const requests: unknown[] = [];
    const client = createApiKeysClient(
      createRecordingApiClient(requests, {
        apiKey: {
          createdAt: "2026-06-18T10:00:00.000Z",
          id: "key-1",
          keyPrefix: "atlabc",
          name: "Production ingest",
          projectId: "project-1",
          revoked: false
        },
        rawKey: "atlabc_secret"
      })
    );

    await client.createApiKey("org-1", "project-1", "Production ingest");

    expect(requests).toEqual([
      {
        body: {
          name: "Production ingest"
        },
        method: "POST",
        path: "/api/v1/organizations/org-1/projects/project-1/api-keys"
      }
    ]);
  });

  it("lists and revokes API keys through the API client", async () => {
    const requests: unknown[] = [];
    const client = createApiKeysClient(createRecordingApiClient(requests, { apiKeys: [] }));

    await client.listApiKeys("org-1", "project-1");
    await client.revokeApiKey("org-1", "project-1", "key-1");

    expect(requests).toEqual([
      {
        path: "/api/v1/organizations/org-1/projects/project-1/api-keys"
      },
      {
        method: "POST",
        path: "/api/v1/organizations/org-1/projects/project-1/api-keys/key-1/revoke"
      }
    ]);
  });
});

function createRecordingApiClient(
  requests: unknown[],
  response: unknown
): ApiClient {
  return {
    async raw(options: ApiRequestOptions) {
      requests.push(options);
      return new Response(JSON.stringify(response), {
        headers: {
          "content-type": "application/json"
        },
        status: 200
      });
    },
    async request<TResponse>(options: ApiRequestOptions) {
      requests.push(options);
      return response as TResponse;
    }
  };
}
