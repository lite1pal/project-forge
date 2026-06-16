import { afterAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import { z } from "zod";

import { loadEnvFiles } from "../../src/env-files.js";
import { buildApp } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
import { hashApiKey } from "../../src/modules/api-keys/keys.js";
import { seedDemoProject } from "../../../../packages/db/src/seed.js";

const config = loadConfig(loadEnvFiles());
const integrationEnv = z
  .object({
    TEST_DATABASE_URL: z.string().url()
  })
  .parse(loadEnvFiles());
const databaseUrl = integrationEnv.TEST_DATABASE_URL;
const apiKeyPepper = config.API_KEY_PEPPER;
const apiKey = "atl_integration_test_key";

describe("event API integration", () => {
  const pool = new pg.Pool({
    connectionString: databaseUrl
  });
  const app = buildApp({
    useInfrastructure: true,
    useRateLimit: false,
    infrastructure: {
      databaseUrl
    }
  });

  beforeEach(async () => {
    try {
      await truncateAll();
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "3D000"
      ) {
        throw new Error(
          "TEST_DATABASE_URL database does not exist. Run `pnpm db:create:test && pnpm db:migrate:test` first."
        );
      }

      throw error;
    }
    await seedDemoProject({
      databaseUrl,
      keyPrefix: "atl",
      keyHash: hashApiKey(apiKey, apiKeyPepper)
    });
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it("ingests, lists, summarizes, and returns timeseries with a real API key", async () => {
    const ingestResponse = await app.inject({
      method: "POST",
      url: "/v1/events",
      headers: {
        authorization: `Bearer ${apiKey}`
      },
      payload: {
        event: "user.deleted",
        actor: "admin_123",
        target: "user_456",
        metadata: {
          reason: "GDPR request"
        }
      }
    });

    expect(ingestResponse.statusCode).toBe(202);

    const listResponse = await app.inject({
      method: "GET",
      url: "/v1/events?event=user.deleted",
      headers: {
        authorization: `Bearer ${apiKey}`
      }
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toEqual({
      events: [
        {
          id: expect.any(String),
          event: "user.deleted",
          actor: "admin_123",
          target: "user_456",
          metadata: {
            reason: "GDPR request"
          },
          createdAt: expect.any(String)
        }
      ],
      pageInfo: {
        hasMore: false,
        nextCursor: null
      }
    });

    const statsResponse = await app.inject({
      method: "GET",
      url: "/v1/events/stats?top=5",
      headers: {
        authorization: `Bearer ${apiKey}`
      }
    });

    expect(statsResponse.statusCode).toBe(200);
    expect(statsResponse.json()).toMatchObject({
      totalEvents: 1,
      topEventTypes: [
        {
          event: "user.deleted",
          count: 1
        }
      ]
    });

    const timeseriesResponse = await app.inject({
      method: "GET",
      url: "/v1/events/timeseries?from=2026-01-01T00:00:00.000Z&to=2100-01-01T00:00:00.000Z&bucket=hour",
      headers: {
        authorization: `Bearer ${apiKey}`
      }
    });

    expect(timeseriesResponse.statusCode).toBe(200);
    expect(timeseriesResponse.json().points).toHaveLength(1);
    expect(timeseriesResponse.json().points[0].count).toBe(1);
  });

  it("rejects missing and invalid API keys across the event route family", async () => {
    const missingAuthResponse = await app.inject({
      method: "GET",
      url: "/v1/events/stats?top=5"
    });
    const invalidAuthResponse = await app.inject({
      method: "GET",
      url: "/v1/events/timeseries?from=2026-01-01T00:00:00.000Z&to=2100-01-01T00:00:00.000Z&bucket=hour",
      headers: {
        authorization: "Bearer atl_invalid_key"
      }
    });

    expect(missingAuthResponse.statusCode).toBe(401);
    expect(missingAuthResponse.json()).toEqual({
      error: "missing_api_key"
    });
    expect(invalidAuthResponse.statusCode).toBe(401);
    expect(invalidAuthResponse.json()).toEqual({
      error: "invalid_api_key"
    });
  });

  async function truncateAll() {
    await pool.query(
      "TRUNCATE TABLE audit_events, api_keys, projects, organizations RESTART IDENTITY CASCADE"
    );
  }
});
