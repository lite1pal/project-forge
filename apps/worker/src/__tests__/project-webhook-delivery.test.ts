import { afterAll, beforeEach, describe, expect, it } from "vitest";
import http from "node:http";
import { z } from "zod";

import { createDatabaseClient } from "@auditrail/db";

import { loadEnvFiles } from "../env-files.js";
import { createProjectWebhookDeliveryHandler } from "../project-webhook-delivery.js";

const integrationEnv = z
  .object({
    TEST_DATABASE_URL: z.string().url()
  })
  .parse(loadEnvFiles());
const databaseUrl = integrationEnv.TEST_DATABASE_URL;
const database = createDatabaseClient(databaseUrl);
const pool = database.pool;

describe("createProjectWebhookDeliveryHandler", () => {
  beforeEach(async () => {
    try {
      await pool.query(`
        TRUNCATE TABLE
          "job_outbox",
          "project_webhook_deliveries",
          "project_webhook_endpoints",
          "audit_events",
          "api_keys",
          "projects",
          "organizations",
          "users"
        RESTART IDENTITY CASCADE
      `);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "3D000") {
        throw new Error(
          "TEST_DATABASE_URL database does not exist. Run `pnpm db:create:test && pnpm db:migrate:test` first."
        );
      }

      throw error;
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it("delivers the expected signed request payload to a real HTTP server", async () => {
    const fixture = await seedWebhookDeliveryFixture({
      url: "http://127.0.0.1:0/webhooks/auditrail"
    });
    const received = await createCaptureServer(async (serverUrl) => {
      await pool.query(
        `update "project_webhook_endpoints"
         set "url" = $2
         where "id" = $1`,
        [fixture.endpointId, `${serverUrl}/webhooks/auditrail`]
      );
      const handler = createProjectWebhookDeliveryHandler({
        db: database.db,
        retryDelayMs: 30_000
      });

      await handler.handle({
        id: "job-1",
        name: "project.webhook.deliver",
        payload: {
          deliveryId: fixture.deliveryId
        }
      });
    });

    expect(received.method).toBe("POST");
    expect(received.url).toBe("/webhooks/auditrail");
    expect(received.headers["x-auditrail-webhook-event"]).toBe("audit.event.created");
    expect(received.headers["x-auditrail-webhook-timestamp"]).toMatch(
      /^\d{4}-\d{2}-\d{2}T/
    );
    expect(received.headers["x-auditrail-webhook-signature"]).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.parse(received.body)).toEqual({
      createdAt: "2026-06-30T10:00:00.000Z",
      data: {
        auditEvent: {
          actorId: "billing_job",
          createdAt: "2026-06-30T10:00:00.000Z",
          eventType: "invoice.sent",
          id: fixture.auditEventId,
          metadata: {
            source: "worker-test"
          },
          targetId: "invoice_123"
        }
      },
      id: fixture.auditEventId,
      organizationId: fixture.organizationId,
      projectId: fixture.projectId,
      type: "audit.event.created"
    });
    await expect(selectDelivery(fixture.deliveryId)).resolves.toMatchObject({
      attemptCount: 1,
      deliveredAt: expect.any(String),
      responseStatusCode: 202,
      status: "succeeded"
    });
  });

  it("marks 5xx responses as retryable delivery failures", async () => {
    const fixture = await seedWebhookDeliveryFixture({
      url: "http://127.0.0.1:0/webhooks/auditrail"
    });
    const handler = createProjectWebhookDeliveryHandler({
      db: database.db,
      retryDelayMs: 30_000
    });

    await expect(
      createCaptureServer(async (serverUrl) => {
        await pool.query(
          `update "project_webhook_endpoints"
           set "url" = $2
           where "id" = $1`,
          [fixture.endpointId, `${serverUrl}/webhooks/auditrail?mode=fail`]
        );

        await handler.handle({
          id: "job-1",
          name: "project.webhook.deliver",
          payload: {
            deliveryId: fixture.deliveryId
          }
        });
      }, {
        statusCode: 503
      })
    ).rejects.toThrow("webhook_delivery_failed:503");

    await expect(selectDelivery(fixture.deliveryId)).resolves.toMatchObject({
      attemptCount: 1,
      lastError: "webhook_delivery_failed:503",
      nextRetryAt: expect.any(String),
      responseStatusCode: 503,
      status: "pending"
    });
  });
});

async function createCaptureServer(
  callback: (serverUrl: string) => Promise<void>,
  response: {
    body?: string;
    statusCode?: number;
  } = {}
) {
  let requestBody = "";
  let captured:
    | {
        body: string;
        headers: http.IncomingHttpHeaders;
        method?: string;
        url?: string;
      }
    | undefined;
  const server = http.createServer((request, reply) => {
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      requestBody += chunk;
    });
    request.on("end", () => {
      captured = {
        body: requestBody,
        headers: request.headers,
        method: request.method,
        url: request.url
      };
      reply.statusCode = response.statusCode ?? 202;
      reply.setHeader("content-type", "text/plain");
      reply.end(response.body ?? "accepted");
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();

  try {
    if (!address || typeof address === "string") {
      throw new Error("failed_to_bind_test_server");
    }

    await callback(`http://127.0.0.1:${address.port}`);

    if (!captured) {
      throw new Error("webhook_request_not_received");
    }

    return captured;
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

async function seedWebhookDeliveryFixture(input: { url: string }) {
  const organizationResult = await pool.query<{ id: string }>(
    `insert into "organizations" ("name") values ('AcmeCRM') returning "id"`
  );
  const organizationId = organizationResult.rows[0]!.id;
  const projectResult = await pool.query<{ id: string }>(
    `insert into "projects" ("organization_id", "name", "environment")
     values ($1, 'AcmeCRM Production', 'production')
     returning "id"`,
    [organizationId]
  );
  const projectId = projectResult.rows[0]!.id;
  const auditEventResult = await pool.query<{ id: string }>(
    `insert into "audit_events" ("organization_id", "project_id", "event_type", "actor_id", "target_id", "metadata", "created_at")
     values ($1, $2, 'invoice.sent', 'billing_job', 'invoice_123', $3::jsonb, $4)
     returning "id"`,
    [
      organizationId,
      projectId,
      JSON.stringify({
        source: "worker-test"
      }),
      "2026-06-30T10:00:00.000Z"
    ]
  );
  const auditEventId = auditEventResult.rows[0]!.id;
  const endpointResult = await pool.query<{ id: string }>(
    `insert into "project_webhook_endpoints"
       ("organization_id", "project_id", "url", "secret", "enabled", "subscribed_event_types")
     values ($1, $2, $3, 'whsec_test_123', true, ARRAY['audit.event.created']::text[])
     returning "id"`,
    [organizationId, projectId, input.url]
  );
  const endpointId = endpointResult.rows[0]!.id;
  const deliveryResult = await pool.query<{ id: string }>(
    `insert into "project_webhook_deliveries"
       ("organization_id", "project_id", "endpoint_id", "audit_event_id", "audit_event_type", "payload")
     values ($1, $2, $3, $4, 'invoice.sent', $5::jsonb)
     returning "id"`,
    [
      organizationId,
      projectId,
      endpointId,
      auditEventId,
      JSON.stringify({
        createdAt: "2026-06-30T10:00:00.000Z",
        data: {
          auditEvent: {
            actorId: "billing_job",
            createdAt: "2026-06-30T10:00:00.000Z",
            eventType: "invoice.sent",
            id: auditEventId,
            metadata: {
              source: "worker-test"
            },
            targetId: "invoice_123"
          }
        },
        id: auditEventId,
        organizationId,
        projectId,
        type: "audit.event.created"
      })
    ]
  );

  return {
    auditEventId,
    deliveryId: deliveryResult.rows[0]!.id,
    endpointId,
    organizationId,
    projectId
  };
}

async function selectDelivery(deliveryId: string) {
  const result = await pool.query<{
    attemptCount: number;
    deliveredAt: string | null;
    lastError: string | null;
    nextRetryAt: string | null;
    responseStatusCode: number | null;
    status: string;
  }>(
    `select
       "attempt_count" as "attemptCount",
       to_char("delivered_at", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "deliveredAt",
       "last_error" as "lastError",
       to_char("next_retry_at", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "nextRetryAt",
       "response_status_code" as "responseStatusCode",
       "status"
     from "project_webhook_deliveries"
     where "id" = $1`,
    [deliveryId]
  );

  return result.rows[0];
}
