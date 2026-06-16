import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../src/app.js";

describe("rate limiting", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("limits API routes by default", async () => {
    vi.stubEnv("RATE_LIMIT_MAX", "1");
    vi.stubEnv("RATE_LIMIT_WINDOW", "1 minute");
    vi.stubEnv("API_KEY_PEPPER", "test-api-key-pepper");
    vi.stubEnv(
      "DATABASE_URL",
      "postgres://auditrail:auditrail@localhost:5433/auditrail"
    );
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");

    const app = buildApp();

    await app.inject({
      method: "GET",
      url: "/v1/events"
    });
    const response = await app.inject({
      method: "GET",
      url: "/v1/events"
    });

    expect(response.statusCode).toBe(429);

    await app.close();
  });

  it("does not rate limit health checks", async () => {
    vi.stubEnv("RATE_LIMIT_MAX", "1");
    vi.stubEnv("RATE_LIMIT_WINDOW", "1 minute");
    vi.stubEnv("API_KEY_PEPPER", "test-api-key-pepper");
    vi.stubEnv(
      "DATABASE_URL",
      "postgres://auditrail:auditrail@localhost:5433/auditrail"
    );
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");

    const app = buildApp();

    await app.inject({
      method: "GET",
      url: "/health"
    });
    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);

    await app.close();
  });
});
