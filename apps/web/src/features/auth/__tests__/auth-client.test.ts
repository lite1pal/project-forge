import { describe, expect, it } from "vitest";

import type {
  ApiClient,
  ApiRequestOptions
} from "../../../lib/api/api-client";
import { createAuthClient, getCurrentUser } from "../api/auth-client";

describe("createAuthClient", () => {
  it("requests magic links through the API client", async () => {
    const requests: unknown[] = [];
    const client = createAuthClient(createRecordingApiClient(requests, {}));

    await client.requestMagicLink("user@example.com");

    expect(requests).toEqual([
      {
        body: {
          email: "user@example.com"
        },
        method: "POST",
        path: "/api/v1/auth/magic-links"
      }
    ]);
  });

  it("validates the current user response", async () => {
    const user = await getCurrentUser({
      async createSession() {
        return new Response(null, {
          status: 201
        });
      },
      async getCurrentUser() {
        return {
          memberships: [],
          user: {
            email: "user@example.com",
            id: "user-1"
          }
        };
      },
      async logout() {},
      async requestMagicLink() {}
    });

    expect(user.user.email).toBe("user@example.com");
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
