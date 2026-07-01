import { describe, expect, it } from "vitest";

import { loadConfig, loadRuntimeConfig } from "../config.js";

describe("api config", () => {
  it("parses required environment values", () => {
    expect(
      loadConfig({
        API_PORT: "4001",
        RATE_LIMIT_MAX: "10",
        RATE_LIMIT_WINDOW: "30 seconds",
        API_KEY_PEPPER: "test-api-key-pepper",
        DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail",
      })
    ).toMatchObject({
      NODE_ENV: "development",
      API_HOST: "0.0.0.0",
      API_PORT: 4001,
      RATE_LIMIT_MAX: 10,
      RATE_LIMIT_WINDOW: "30 seconds",
      API_KEY_PEPPER: "test-api-key-pepper",
      AUTH_MAGIC_LINK_TTL_SECONDS: 900,
      AUTH_SESSION_COOKIE_NAME: "auditrail_session",
      AUTH_SESSION_COOKIE_SECURE: true,
      AUTH_SESSION_TTL_SECONDS: 2592000,
      BILLING_PROVIDER: "stripe",
      DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail"
    });
  });

  it("rejects missing service URLs", () => {
    expect(() => loadConfig({})).toThrow();
  });

  it("falls back to PORT when API_PORT is not set", () => {
    expect(
      loadConfig({
        PORT: "4010",
        API_KEY_PEPPER: "test-api-key-pepper",
        DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail"
      }).API_PORT
    ).toBe(4010);
  });

  it("requires an explicit production sender selection", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        API_KEY_PEPPER: "test-api-key-pepper",
        DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail"
      })
    ).toThrow(/AUTH_MAGIC_LINK_SENDER must be set explicitly in production/);
  });

  it("requires an explicit production cookie domain", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        API_KEY_PEPPER: "test-api-key-pepper",
        AUTH_MAGIC_LINK_SENDER: "resend",
        AUTH_RESEND_API_KEY: "re_test_api_key",
        AUTH_RESEND_FROM_EMAIL: "noreply@example.com",
        DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail"
      })
    ).toThrow(/AUTH_SESSION_COOKIE_DOMAIN must be set explicitly in production/);
  });

  it("requires provider-specific resend settings when resend is selected", () => {
    expect(() =>
      loadConfig({
        AUTH_MAGIC_LINK_SENDER: "resend",
        API_KEY_PEPPER: "test-api-key-pepper",
        DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail"
      })
    ).toThrow(/AUTH_RESEND_API_KEY is required/);
  });

  it("accepts a fully configured resend sender in production", () => {
    expect(
      loadConfig({
        NODE_ENV: "production",
        API_KEY_PEPPER: "test-api-key-pepper",
        AUTH_MAGIC_LINK_SENDER: "resend",
        AUTH_RESEND_API_KEY: "re_test_api_key",
        AUTH_RESEND_FROM_EMAIL: "noreply@example.com",
        AUTH_SESSION_COOKIE_DOMAIN: "example.com",
        DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail"
      }).AUTH_MAGIC_LINK_SENDER
    ).toBe("resend");
  });

  it("requires the full Stripe billing config once any Stripe billing value is set", () => {
    expect(() =>
      loadConfig({
        API_KEY_PEPPER: "test-api-key-pepper",
        BILLING_STRIPE_SECRET_KEY: "sk_test_123",
        DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail"
      })
    ).toThrow(/BILLING_STRIPE_PRICE_ID_STARTER is required/);
  });

  it("accepts a fully configured Stripe billing setup", () => {
    expect(
      loadConfig({
        API_KEY_PEPPER: "test-api-key-pepper",
        BILLING_STRIPE_SECRET_KEY: "sk_test_123",
        BILLING_STRIPE_PRICE_ID_STARTER: "price_starter",
        BILLING_STRIPE_PRICE_ID_GROWTH: "price_growth",
        BILLING_STRIPE_PRICE_ID_SCALE: "price_scale",
        DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail"
      }).BILLING_STRIPE_SECRET_KEY
    ).toBe("sk_test_123");
  });

  it("requires an explicit provider-backed sender for standard runtime startup", () => {
    expect(() =>
      loadRuntimeConfig({
        API_KEY_PEPPER: "test-api-key-pepper",
        DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail"
      })
    ).toThrow(/AUTH_MAGIC_LINK_SENDER must be set explicitly for standard runtime startup/);
  });

  it("accepts standard runtime startup when the provider-backed sender is configured", () => {
    expect(
      loadRuntimeConfig({
        API_KEY_PEPPER: "test-api-key-pepper",
        AUTH_MAGIC_LINK_SENDER: "resend",
        AUTH_RESEND_API_KEY: "re_test_api_key",
        AUTH_RESEND_FROM_EMAIL: "noreply@example.com",
        DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail"
      }).AUTH_MAGIC_LINK_SENDER
    ).toBe("resend");
  });
});
