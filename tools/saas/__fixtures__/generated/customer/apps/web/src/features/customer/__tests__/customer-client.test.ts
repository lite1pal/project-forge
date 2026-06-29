import { describe, expect, it } from "vitest";

import type { ApiClient, ApiRequestOptions } from "@/src/lib/api/api-client";
import { createResourceClient } from "../api/customer-client.js";

describe("createResourceClient", () => {
  it("loads customers through the API client", async () => {
    const requests: unknown[] = [];
    const client = createResourceClient(createRecordingApiClient(requests, { items: [] }));

    await client.list("00000000-0000-0000-0000-000000000001");

    expect(requests).toHaveLength(1);
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
        headers: { "content-type": "application/json" },
        status: 200
      });
    },
    async request<TResponse>(options: ApiRequestOptions) {
      requests.push(options);
      return response as TResponse;
    }
  };
}
