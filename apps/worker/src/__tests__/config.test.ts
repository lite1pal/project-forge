import { describe, expect, it } from "vitest";

import { loadConfig } from "../config.js";

describe("worker config", () => {
  it("parses required worker settings and defaults", () => {
    expect(
      loadConfig({
        DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail"
      })
    ).toEqual({
      DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail",
      NODE_ENV: "development",
      WORKER_LOG_LEVEL: "info",
      WORKER_NAME: "auditrail-worker",
      WORKER_SHUTDOWN_TIMEOUT_MS: 5000
    });
  });

  it("rejects missing explicit service URLs", () => {
    expect(() => loadConfig({})).toThrow();
  });

  it("accepts explicit runtime overrides", () => {
    expect(
      loadConfig({
        DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail",
        NODE_ENV: "production",
        WORKER_LOG_LEVEL: "warn",
        WORKER_NAME: "worker-a",
        WORKER_SHUTDOWN_TIMEOUT_MS: "9000"
      })
    ).toMatchObject({
      NODE_ENV: "production",
      WORKER_LOG_LEVEL: "warn",
      WORKER_NAME: "worker-a",
      WORKER_SHUTDOWN_TIMEOUT_MS: 9000
    });
  });
});
