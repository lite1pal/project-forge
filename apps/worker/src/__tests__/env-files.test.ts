import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { loadEnvFiles } from "../env-files.js";

describe("worker env file loading", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lets process env override app and root env files", () => {
    const root = join(tmpdir(), `auditrail-worker-env-${Date.now()}`);
    const app = join(root, "apps", "worker");

    mkdirSync(app, {
      recursive: true
    });
    writeFileSync(
      join(root, ".env"),
      "DATABASE_URL='postgres://root'\nWORKER_NAME=root-worker\n"
    );
    writeFileSync(
      join(app, ".env"),
      "DATABASE_URL='postgres://app'\nWORKER_LOG_LEVEL=warn\n"
    );
    vi.stubEnv("DATABASE_URL", "postgres://process");

    expect(loadEnvFiles(app)).toMatchObject({
      DATABASE_URL: "postgres://process",
      WORKER_LOG_LEVEL: "warn",
      WORKER_NAME: "root-worker"
    });
  });

  it("parses keys without values as empty strings", () => {
    const root = join(tmpdir(), `auditrail-worker-empty-${Date.now()}`);
    const app = join(root, "apps", "worker");

    mkdirSync(app, {
      recursive: true
    });
    writeFileSync(join(root, ".env"), "EMPTY\nPLAIN=value\n");

    expect(loadEnvFiles(app)).toMatchObject({
      EMPTY: "",
      PLAIN: "value"
    });
  });
});
