import { describe, expect, it } from "vitest";

import { createRuntimeMagicLinkSender } from "../../../app.js";
import { loadConfig } from "../../../config.js";
import { buildApp } from "../../../app.js";

describe("createRuntimeMagicLinkSender", () => {
  it("selects the Resend sender in production", async () => {
    const app = buildApp({
      useRateLimit: false
    });
    const calls: Array<{
      init?: RequestInit;
      url: string;
    }> = [];
    const sender = createRuntimeMagicLinkSender(
      app,
      loadConfig({
        NODE_ENV: "production",
        API_KEY_PEPPER: "test-api-key-pepper",
        AUTH_MAGIC_LINK_SENDER: "resend",
        AUTH_RESEND_API_KEY: "re_test_api_key",
        AUTH_RESEND_FROM_EMAIL: "noreply@example.com",
        DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail",
        REDIS_URL: "redis://localhost:6379",
        WEB_PUBLIC_URL: "https://app.example.com"
      }),
      {
        fetch: async (url, init) => {
          calls.push({
            init,
            url: String(url)
          });

          return new Response(null, {
            status: 202
          });
        }
      }
    );

    await sender.sendMagicLink({
      email: "user@example.com",
      token: "token-1"
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.resend.com/emails");
    expect(calls[0]?.init?.body).toContain("user@example.com");

    await app.close();
  });

  it("falls back to the local sender outside production", async () => {
    const app = buildApp({
      useRateLimit: false
    });
    const sender = createRuntimeMagicLinkSender(
      app,
      loadConfig({
        NODE_ENV: "development",
        API_KEY_PEPPER: "test-api-key-pepper",
        DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail",
        REDIS_URL: "redis://localhost:6379",
        WEB_PUBLIC_URL: "http://localhost:3000"
      })
    );

    await expect(
      sender.sendMagicLink({
        email: "user@example.com",
        token: "token-1"
      })
    ).resolves.toBeUndefined();

    await app.close();
  });

  it("rejects invalid production sender config at startup", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        API_KEY_PEPPER: "test-api-key-pepper",
        AUTH_MAGIC_LINK_SENDER: "resend",
        DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail",
        REDIS_URL: "redis://localhost:6379",
        WEB_PUBLIC_URL: "https://app.example.com"
      })
    ).toThrow(/AUTH_RESEND_API_KEY is required/);
  });
});
