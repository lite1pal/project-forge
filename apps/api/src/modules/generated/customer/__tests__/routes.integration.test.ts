import { afterAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import { z } from "zod";

import { API_VERSION_PREFIX } from "../../../../api-version.js";
import { buildApp } from "../../../../app.js";
import { loadConfig } from "../../../../config.js";
import { loadEnvFiles } from "../../../../env-files.js";
import { hashToken } from "../../../auth/tokens.js";
import { seedDemoProject } from "../../../../../../../packages/db/src/seed.js";

const config = loadConfig(loadEnvFiles());
const integrationEnv = z
  .object({
    TEST_DATABASE_URL: z.string().url()
  })
  .parse(loadEnvFiles());
const databaseUrl = integrationEnv.TEST_DATABASE_URL;
const authTokenSecret = config.AUTH_TOKEN_SECRET!;

describe("customer generated resource integration", () => {
  const pool = new pg.Pool({
    connectionString: databaseUrl
  });
  const app = buildApp({
    infrastructure: {
      databaseUrl
    },
    useInfrastructure: true,
    useRateLimit: false
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
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it("creates, lists, reads, and updates customers through the installed API routes", async () => {
    const session = await createSessionMember();
    const createResponse = await app.inject({
      method: "POST",
      headers: {
        cookie: session.cookie
      },
      payload: {
        name: "name value",
        email: "person@example.com",
        isActive: true,
        status: "active",
        externalId: "11111111-1111-4111-8111-111111111111",
        lastContactedAt: "2026-06-29T00:00:00.000Z",
      },
      url: `${API_VERSION_PREFIX}/organizations/${session.organizationId}/customers`
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json()).toMatchObject({
      createdAt: expect.any(String),
      name: "name value",
      email: "person@example.com",
      isActive: true,
      status: "active",
      externalId: "11111111-1111-4111-8111-111111111111",
      lastContactedAt: "2026-06-29T00:00:00.000Z",
      id: expect.any(String),
      organizationId: session.organizationId,
      updatedAt: expect.any(String)
    });

    const createdId = createResponse.json().id as string;

    const listResponse = await app.inject({
      method: "GET",
      headers: {
        cookie: session.cookie
      },
      url: `${API_VERSION_PREFIX}/organizations/${session.organizationId}/customers`
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toEqual({
      items: [
        {
          createdAt: expect.any(String),
      name: "name value",
      email: "person@example.com",
      isActive: true,
      status: "active",
      externalId: "11111111-1111-4111-8111-111111111111",
      lastContactedAt: "2026-06-29T00:00:00.000Z",
          id: createdId,
          organizationId: session.organizationId,
          updatedAt: expect.any(String)
        }
      ]
    });

    const getResponse = await app.inject({
      method: "GET",
      headers: {
        cookie: session.cookie
      },
      url: `${API_VERSION_PREFIX}/organizations/${session.organizationId}/customers/${createdId}`
    });

    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json()).toMatchObject({
      name: "name value",
      email: "person@example.com",
      isActive: true,
      status: "active",
      externalId: "11111111-1111-4111-8111-111111111111",
      lastContactedAt: "2026-06-29T00:00:00.000Z",
      id: createdId,
      organizationId: session.organizationId
    });

    const updateResponse = await app.inject({
      method: "PATCH",
      headers: {
        cookie: session.cookie
      },
      payload: {
        name: "updated name value"
      },
      url: `${API_VERSION_PREFIX}/organizations/${session.organizationId}/customers/${createdId}`
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json()).toMatchObject({
      name: "updated name value",
      email: "person@example.com",
      isActive: true,
      status: "active",
      externalId: "11111111-1111-4111-8111-111111111111",
      lastContactedAt: "2026-06-29T00:00:00.000Z",
      id: createdId,
      organizationId: session.organizationId
    });
  });

  it("does not expose customers across organizations", async () => {
    const session = await createSessionMember();
    const otherOrganization = await createOrganization("OtherCo");

    const response = await app.inject({
      method: "GET",
      headers: {
        cookie: session.cookie
      },
      url: `${API_VERSION_PREFIX}/organizations/${otherOrganization.id}/customers`
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
  });

  async function truncateAll() {
    await pool.query(`
      TRUNCATE TABLE
        customers,
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
        organization_installed_products,
        projects,
        organizations,
        users
      RESTART IDENTITY CASCADE
    `);
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
      userId
    };
  }

  async function createOrganization(name: string) {
    const result = await pool.query<{ id: string }>(
      `insert into "organizations" ("name")
       values ($1)
       returning "id"`,
      [name]
    );

    return {
      id: result.rows[0]!.id
    };
  }
});
