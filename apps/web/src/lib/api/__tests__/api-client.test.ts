import { describe, expect, it } from "vitest";

import { createApiClient } from "../api-client";

describe("createApiClient", () => {
  it("returns undefined for empty responses", async () => {
    const client = createApiClient({
      baseUrl: "http://localhost:4000",
      fetcher: async () => new Response(null, { status: 204 })
    });

    await expect(
      client.request({
        method: "DELETE",
        path: "/api/v1/auth/sessions/current"
      })
    ).resolves.toBeUndefined();
  });

  it("exposes raw responses for cookie exchange", async () => {
    const client = createApiClient({
      baseUrl: "http://localhost:4000",
      fetcher: async () =>
        new Response(JSON.stringify({ ok: true }), {
          headers: {
            "set-cookie": "auditrail_session=session-token; Path=/"
          },
          status: 201
        })
    });

    const response = await client.raw({
      method: "POST",
      path: "/api/v1/auth/sessions"
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("set-cookie")).toContain("auditrail_session");
  });
});
