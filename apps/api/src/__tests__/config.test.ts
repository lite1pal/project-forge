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
        REDIS_URL: "redis://localhost:6379"
      })
    ).toEqual({
      NODE_ENV: "development",
      API_HOST: "0.0.0.0",
      API_PORT: 4001,
      RATE_LIMIT_MAX: 10,
      RATE_LIMIT_WINDOW: "30 seconds",
      API_KEY_PEPPER: "test-api-key-pepper",
      AUTH_MAGIC_LINK_TTL_SECONDS: 900,
      AUTH_MAGIC_LINK_SENDER: undefined,
      AUTH_RESEND_API_KEY: undefined,
      AUTH_RESEND_FROM_EMAIL: undefined,
      AUTH_SESSION_COOKIE_NAME: "auditrail_session",
      AUTH_SESSION_COOKIE_SECURE: true,
      AUTH_SESSION_TTL_SECONDS: 2592000,
      DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail",
      REDIS_URL: "redis://localhost:6379"
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
        DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail",
        REDIS_URL: "redis://localhost:6379"
      }).API_PORT
    ).toBe(4010);
  });

  it("requires an explicit production sender selection", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        API_KEY_PEPPER: "test-api-key-pepper",
        DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail",
        REDIS_URL: "redis://localhost:6379"
      })
    ).toThrow(/AUTH_MAGIC_LINK_SENDER must be set explicitly in production/);
  });

  it("rejects the logging sender in production", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        API_KEY_PEPPER: "test-api-key-pepper",
        AUTH_MAGIC_LINK_SENDER: "log",
        DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail",
        REDIS_URL: "redis://localhost:6379"
      })
    ).toThrow(/AUTH_MAGIC_LINK_SENDER=log is not allowed in production/);
  });

  it("requires provider-specific resend settings when resend is selected", () => {
    expect(() =>
      loadConfig({
        AUTH_MAGIC_LINK_SENDER: "resend",
        API_KEY_PEPPER: "test-api-key-pepper",
        DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail",
        REDIS_URL: "redis://localhost:6379"
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
        DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail",
        REDIS_URL: "redis://localhost:6379"
      }).AUTH_MAGIC_LINK_SENDER
    ).toBe("resend");
  });

  it("requires an explicit provider-backed sender for standard runtime startup", () => {
    expect(() =>
      loadRuntimeConfig({
        API_KEY_PEPPER: "test-api-key-pepper",
        DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail",
        REDIS_URL: "redis://localhost:6379"
      })
    ).toThrow(/AUTH_MAGIC_LINK_SENDER must be set explicitly for standard runtime startup/);
  });

  it("rejects the local logging sender for standard runtime startup", () => {
    expect(() =>
      loadRuntimeConfig({
        API_KEY_PEPPER: "test-api-key-pepper",
        AUTH_MAGIC_LINK_SENDER: "log",
        DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail",
        REDIS_URL: "redis://localhost:6379"
      })
    ).toThrow(/AUTH_MAGIC_LINK_SENDER=log is not allowed in standard runtime/);
  });
});
