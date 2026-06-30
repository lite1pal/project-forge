import { afterAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import { z } from "zod";

import { API_VERSION_PREFIX } from "../../../api-version.js";
import { loadEnvFiles } from "../../../env-files.js";
import { buildApp } from "../../../app.js";
import { loadConfig } from "../../../config.js";
import { hashApiKey } from "../../api-keys/keys.js";
import { hashToken } from "../../auth/tokens.js";
import { seedDemoProject } from "../../../../../../packages/db/src/seed.js";

const config = loadConfig(loadEnvFiles());
const integrationEnv = z
  .object({
    TEST_DATABASE_URL: z.string().url()
  })
  .parse(loadEnvFiles());
const databaseUrl = integrationEnv.TEST_DATABASE_URL;
const apiKeyPepper = config.API_KEY_PEPPER;
const authTokenSecret = config.AUTH_TOKEN_SECRET!;
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
      apiKey: {
        keyPrefix: "atl",
        keyHash: hashApiKey(apiKey, apiKeyPepper)
      }
    });
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it("ingests, lists, summarizes, and returns timeseries with a real API key", async () => {
    const ingestResponse = await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
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
    await expect(selectOutboxJobs()).resolves.toEqual([
      {
        name: "audit-event.created",
        payload: {
          createdAt: expect.any(String),
          eventId: ingestResponse.json().id,
          organizationId: expect.any(String),
          projectId: expect.any(String)
        },
        status: "pending"
      }
    ]);

    const listResponse = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/events?event=user.deleted`,
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
      url: `${API_VERSION_PREFIX}/events/stats?top=5`,
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
      url: `${API_VERSION_PREFIX}/events/timeseries?from=2026-01-01T00:00:00.000Z&to=2100-01-01T00:00:00.000Z&bucket=hour`,
      headers: {
        authorization: `Bearer ${apiKey}`
      }
    });

    expect(timeseriesResponse.statusCode).toBe(200);
    expect(timeseriesResponse.json().points).toHaveLength(1);
    expect(timeseriesResponse.json().points[0].count).toBe(1);
  });

  it("creates project webhook deliveries and outbox jobs only for enabled subscribed endpoints", async () => {
    const session = await createSessionMember();
    const createWebhookResponse = await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/organizations/${session.organizationId}/projects/${session.projectId}/webhooks`,
      headers: {
        cookie: session.cookie
      },
      payload: {
        subscribedEventTypes: ["audit.event.created"],
        url: "https://example.com/hooks/primary"
      }
    });

    expect(createWebhookResponse.statusCode).toBe(201);
    const disabledWebhookId = await insertWebhookEndpoint({
      enabled: false,
      organizationId: session.organizationId,
      projectId: session.projectId,
      subscribedEventTypes: ["audit.event.created"],
      url: "https://example.com/hooks/disabled"
    });
    const unsubscribedWebhookId = await insertWebhookEndpoint({
      enabled: true,
      organizationId: session.organizationId,
      projectId: session.projectId,
      subscribedEventTypes: [],
      url: "https://example.com/hooks/unsubscribed"
    });

    const ingestResponse = await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      headers: {
        authorization: `Bearer ${apiKey}`
      },
      payload: {
        event: "invoice.sent",
        actor: "billing_job",
        metadata: {
          source: "integration"
        },
        target: "invoice_123"
      }
    });

    expect(ingestResponse.statusCode).toBe(202);
    await expect(selectWebhookDeliveries()).resolves.toEqual([
      {
        auditEventId: ingestResponse.json().id,
        auditEventType: "invoice.sent",
        endpointId: createWebhookResponse.json().endpoint.id,
        status: "pending"
      }
    ]);
    await expect(selectOutboxJobs()).resolves.toEqual([
      {
        name: "audit-event.created",
        payload: {
          createdAt: expect.any(String),
          eventId: ingestResponse.json().id,
          organizationId: session.organizationId,
          projectId: session.projectId
        },
        status: "pending"
      },
      {
        name: "project.webhook.deliver",
        payload: {
          deliveryId: expect.any(String)
        },
        status: "pending"
      }
    ]);
    await expect(countWebhookDeliveriesForEndpoint(disabledWebhookId)).resolves.toBe(0);
    await expect(countWebhookDeliveriesForEndpoint(unsubscribedWebhookId)).resolves.toBe(0);
  });

  it("rejects missing and invalid API keys across the event route family", async () => {
    const missingAuthResponse = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/events/stats?top=5`
    });
    const invalidAuthResponse = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/events/timeseries?from=2026-01-01T00:00:00.000Z&to=2100-01-01T00:00:00.000Z&bucket=hour`,
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
    await expect(countOutboxJobs()).resolves.toBe(0);
  });

  it("does not enqueue an outbox job when ingest is rejected by quota", async () => {
    const currentMonthStart = new Date();

    currentMonthStart.setUTCDate(1);
    currentMonthStart.setUTCHours(0, 0, 0, 0);

    await pool.query(
      `insert into "organization_monthly_usage"
         ("organization_id", "month_start", "meter_key", "quantity", "created_at", "updated_at")
       select "id", $1, 'events', 100000, now(), now()
       from "organizations"
       limit 1`,
      [currentMonthStart.toISOString()]
    );

    const response = await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      headers: {
        authorization: `Bearer ${apiKey}`
      },
      payload: {
        event: "user.deleted",
        metadata: {}
      }
    });

    expect(response.statusCode).toBe(402);
    await expect(countAuditEvents()).resolves.toBe(0);
    await expect(countOutboxJobs()).resolves.toBe(0);
  });

  it("creates and revokes an API key through the real session flow, and revoked keys can no longer ingest", async () => {
    const session = await createSessionMember();
    const createResponse = await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/organizations/${session.organizationId}/projects/${session.projectId}/api-keys`,
      headers: {
        cookie: session.cookie
      },
      payload: {
        name: "Hosted ingest"
      }
    });

    expect(createResponse.statusCode).toBe(201);

    const createPayload = createResponse.json();
    const rawKey = createPayload.rawKey as string;

    expect(createPayload.apiKey).toMatchObject({
      id: expect.any(String),
      name: "Hosted ingest",
      projectId: session.projectId,
      revoked: false
    });
    expect(rawKey).toMatch(/^atl[a-zA-Z0-9]+_/);

    const listResponse = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/organizations/${session.organizationId}/projects/${session.projectId}/api-keys`,
      headers: {
        cookie: session.cookie
      }
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toEqual({
      apiKeys: [
        {
          createdAt: expect.any(String),
          id: createPayload.apiKey.id,
          keyPrefix: createPayload.apiKey.keyPrefix,
          name: "Hosted ingest",
          projectId: session.projectId,
          revoked: false
        },
        {
          createdAt: expect.any(String),
          id: expect.any(String),
          keyPrefix: "atl",
          name: "Seeded API key",
          projectId: session.projectId,
          revoked: false
        }
      ]
    });

    const ingestResponse = await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      headers: {
        authorization: `Bearer ${rawKey}`
      },
      payload: {
        event: "api_key.created",
        actor: "user_1",
        metadata: {
          source: "integration"
        }
      }
    });

    expect(ingestResponse.statusCode).toBe(202);

    const revokeResponse = await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/organizations/${session.organizationId}/projects/${session.projectId}/api-keys/${createPayload.apiKey.id}/revoke`,
      headers: {
        cookie: session.cookie
      }
    });

    expect(revokeResponse.statusCode).toBe(204);

    const revokedListResponse = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/organizations/${session.organizationId}/projects/${session.projectId}/api-keys`,
      headers: {
        cookie: session.cookie
      }
    });

    expect(revokedListResponse.statusCode).toBe(200);
    expect(revokedListResponse.json()).toEqual({
      apiKeys: [
        {
          createdAt: expect.any(String),
          id: createPayload.apiKey.id,
          keyPrefix: createPayload.apiKey.keyPrefix,
          name: "Hosted ingest",
          projectId: session.projectId,
          revoked: true
        },
        {
          createdAt: expect.any(String),
          id: expect.any(String),
          keyPrefix: "atl",
          name: "Seeded API key",
          projectId: session.projectId,
          revoked: false
        }
      ]
    });

    const revokedIngestResponse = await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      headers: {
        authorization: `Bearer ${rawKey}`
      },
      payload: {
        event: "api_key.revoked",
        metadata: {
          source: "integration"
        }
      }
    });

    expect(revokedIngestResponse.statusCode).toBe(401);
    expect(revokedIngestResponse.json()).toEqual({
      error: "invalid_api_key"
    });
    await expect(countAuditEvents()).resolves.toBe(1);
    await expect(countOutboxJobs()).resolves.toBe(1);
  });

  it("returns only the requested project's events for session-scoped reads", async () => {
    const session = await createSessionMember();
    const secondProject = await createProject({
      environment: "staging",
      name: "AcmeCRM Staging",
      organizationId: session.organizationId
    });
    const firstKey = await createApiKeyForProject(session.projectId, "Acme prod key");
    const secondKey = await createApiKeyForProject(secondProject.id, "Acme staging key");

    await ingestEvent(firstKey.rawKey, {
      actor: "admin_prod",
      event: "user.deleted",
      metadata: {
        project: "production"
      },
      target: "user_prod"
    });
    await ingestEvent(secondKey.rawKey, {
      actor: "admin_stage",
      event: "user.created",
      metadata: {
        project: "staging"
      },
      target: "user_stage"
    });

    const projectEventsResponse = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/organizations/${session.organizationId}/projects/${session.projectId}/events`,
      headers: {
        cookie: session.cookie
      }
    });

    expect(projectEventsResponse.statusCode).toBe(200);
    expect(projectEventsResponse.json()).toEqual({
      events: [
        {
          actor: "admin_prod",
          createdAt: expect.any(String),
          event: "user.deleted",
          id: expect.any(String),
          metadata: {
            project: "production"
          },
          target: "user_prod"
        }
      ],
      pageInfo: {
        hasMore: false,
        nextCursor: null
      }
    });

    const projectStatsResponse = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/organizations/${session.organizationId}/projects/${session.projectId}/events/stats?top=5`,
      headers: {
        cookie: session.cookie
      }
    });

    expect(projectStatsResponse.statusCode).toBe(200);
    expect(projectStatsResponse.json()).toMatchObject({
      totalEvents: 1,
      topEventTypes: [
        {
          count: 1,
          event: "user.deleted"
        }
      ]
    });

    const secondProjectEventsResponse = await app.inject({
      method: "GET",
      url: `${API_VERSION_PREFIX}/organizations/${session.organizationId}/projects/${secondProject.id}/events`,
      headers: {
        cookie: session.cookie
      }
    });

    expect(secondProjectEventsResponse.statusCode).toBe(200);
    expect(secondProjectEventsResponse.json()).toEqual({
      events: [
        {
          actor: "admin_stage",
          createdAt: expect.any(String),
          event: "user.created",
          id: expect.any(String),
          metadata: {
            project: "staging"
          },
          target: "user_stage"
        }
      ],
      pageInfo: {
        hasMore: false,
        nextCursor: null
      }
    });
  });

  async function truncateAll() {
    await pool.query(`
      TRUNCATE TABLE
        "job_outbox",
        project_webhook_deliveries,
        project_webhook_endpoints,
        audit_events,
        api_keys,
        auth_sessions,
        auth_magic_links,
        organization_memberships,
        organization_invitations,
        user_organization_onboarding_states,
        projects,
        organizations,
        users
      RESTART IDENTITY CASCADE
    `);
  }

  async function countOutboxJobs() {
    const result = await pool.query<{ count: string }>(
      'select cast(count(*) as text) as "count" from "job_outbox"'
    );

    return Number(result.rows[0]?.count ?? "0");
  }

  async function countAuditEvents() {
    const result = await pool.query<{ count: string }>(
      'select cast(count(*) as text) as "count" from "audit_events"'
    );

    return Number(result.rows[0]?.count ?? "0");
  }

  async function selectOutboxJobs() {
    const result = await pool.query<{
      name: string;
      payload: Record<string, unknown>;
      status: string;
    }>(
      'select "name", "payload", "status" from "job_outbox" order by "created_at" asc'
    );

    return result.rows;
  }

  async function selectWebhookDeliveries() {
    const result = await pool.query<{
      auditEventId: string;
      auditEventType: string;
      endpointId: string;
      status: string;
    }>(
      `select
         "audit_event_id" as "auditEventId",
         "audit_event_type" as "auditEventType",
         "endpoint_id" as "endpointId",
         "status"
       from "project_webhook_deliveries"
       order by "created_at" asc`
    );

    return result.rows;
  }

  async function countWebhookDeliveriesForEndpoint(endpointId: string) {
    const result = await pool.query<{ count: string }>(
      `select cast(count(*) as text) as "count"
       from "project_webhook_deliveries"
       where "endpoint_id" = $1`,
      [endpointId]
    );

    return Number(result.rows[0]?.count ?? "0");
  }

  async function createSessionMember() {
    const seeded = await seedDemoProject({
      databaseUrl
    });
    const user = await pool.query<{ id: string }>(
      `insert into "users" ("email")
       values ($1)
       returning "id"`,
      ["integration-owner@example.com"]
    );
    const userId = user.rows[0]!.id;

    await pool.query(
      `insert into "organization_memberships" ("organization_id", "user_id", "role")
       values ($1, $2, 'owner')`,
      [seeded.organizationId, userId]
    );

    const sessionToken = "integration-session-token";

    await pool.query(
      `insert into "auth_sessions" ("user_id", "token_hash", "expires_at")
       values ($1, $2, now() + interval '30 day')`,
      [userId, hashToken(sessionToken, { secret: authTokenSecret })]
    );

    return {
      cookie: `${config.AUTH_SESSION_COOKIE_NAME}=${sessionToken}`,
      organizationId: seeded.organizationId,
      projectId: seeded.projectId,
      userId
    };
  }

  async function createProject(input: {
    environment: string;
    name: string;
    organizationId: string;
  }) {
    const result = await pool.query<{ id: string }>(
      `insert into "projects" ("organization_id", "name", "environment")
       values ($1, $2, $3)
       returning "id"`,
      [input.organizationId, input.name, input.environment]
    );

    return {
      id: result.rows[0]!.id
    };
  }

  async function createApiKeyForProject(projectId: string, name: string) {
    const rawKey = `${apiKey}_${projectId.replace(/-/g, "").slice(0, 8)}`;
    const keyHash = hashApiKey(rawKey, apiKeyPepper);

    await pool.query(
      `insert into "api_keys" ("project_id", "key_hash", "key_prefix", "name")
       values ($1, $2, $3, $4)`,
      [projectId, keyHash, rawKey.split("_")[0], name]
    );

    return {
      rawKey
    };
  }

  async function insertWebhookEndpoint(input: {
    enabled: boolean;
    organizationId: string;
    projectId: string;
    subscribedEventTypes: string[];
    url: string;
  }) {
    const result = await pool.query<{ id: string }>(
      `insert into "project_webhook_endpoints"
         ("organization_id", "project_id", "url", "secret", "enabled", "subscribed_event_types")
       values ($1, $2, $3, $4, $5, $6)
       returning "id"`,
      [
        input.organizationId,
        input.projectId,
        input.url,
        "whsec_test_integration",
        input.enabled,
        input.subscribedEventTypes
      ]
    );

    return result.rows[0]!.id;
  }

  async function ingestEvent(
    rawKey: string,
    payload: {
      actor?: string;
      event: string;
      metadata: Record<string, unknown>;
      target?: string;
    }
  ) {
    const response = await app.inject({
      method: "POST",
      url: `${API_VERSION_PREFIX}/events`,
      headers: {
        authorization: `Bearer ${rawKey}`
      },
      payload
    });

    expect(response.statusCode).toBe(202);
  }
});
