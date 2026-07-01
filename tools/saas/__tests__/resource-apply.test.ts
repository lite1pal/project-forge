import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { executeSaasCli } from "../cli.js";
import {
  applyResourceFromFile,
  formatAppliedResourceSummary
} from "../resource-apply.js";

describe("saas resource apply", () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    for (const root of createdRoots) {
      rmSync(root, {
        force: true,
        recursive: true
      });
    }
  });

  it("writes generated files to an isolated apply target", () => {
    const repoRoot = createSeededRepo(createdRoots);

    const result = applyResourceFromFile({
      repoRoot,
      specPath: "tools/saas/__fixtures__/resources/customer.json",
      targetPath: ".generated/apply-preview/customer"
    });

    expect(result.status).toBe("warn");
    expect(
      readGenerated(
        repoRoot,
        ".generated/apply-preview/customer/packages/domain/src/generated/customer/index.ts"
      )
    ).toContain("export const customerFieldSchema");
    expect(
      readGenerated(
        repoRoot,
        ".generated/apply-preview/customer/packages/domain/package.json"
      )
    ).toContain('"./generated/customer"');
    expect(
      readGenerated(
        repoRoot,
        ".generated/apply-preview/customer/packages/db/src/migrations/0000_customer.sql"
      )
    ).toContain('create table if not exists "customers"');
    expect(
      readGenerated(
        repoRoot,
        ".generated/apply-preview/customer/packages/db/src/migrations/meta/_journal.json"
      )
    ).toContain('"tag": "0000_customer"');
  });

  it("keeps preview mode as the default add behavior", () => {
    const repoRoot = createSeededRepo(createdRoots, {
      "packages/domain/src/index.ts": "export const untouched = true;\n"
    });

    const result = executeSaasCli({
      args: [
        "add",
        "resource",
        "tools/saas/__fixtures__/resources/customer.json",
        "--output",
        ".generated/resource-preview/customer"
      ],
      repoRoot
    });

    expect(result.exitCode).toBe(0);
    expect(readGenerated(repoRoot, "packages/domain/src/index.ts")).toBe(
      "export const untouched = true;\n"
    );
  });

  it("fails when an existing target file is present without force", () => {
    const repoRoot = createSeededRepo(createdRoots, {
      ".generated/apply-preview/customer/packages/domain/src/generated/customer/index.ts":
        "conflict\n"
    });

    expect(() =>
      applyResourceFromFile({
        repoRoot,
        specPath: "tools/saas/__fixtures__/resources/customer.json",
        targetPath: ".generated/apply-preview/customer"
      })
    ).toThrow(/requires --force/i);
  });

  it("fails safely when repo-root install cannot patch the app bootstrap shape", () => {
    const repoRoot = createSeededRepo(createdRoots, {
      "apps/api/src/app.ts": "export const app = true;\n",
      "packages/db/src/schema/index.ts": 'export * from "./identity.js";\n',
      "packages/domain/package.json": JSON.stringify(
        {
          exports: {
            ".": {
              import: "./src/index.ts",
              types: "./src/index.ts"
            }
          },
          name: "@auditrail/domain",
          private: true,
          type: "module",
          version: "0.1.0"
        },
        null,
        2
      ) + "\n",
      "packages/domain/src/index.ts": 'export * from "./product/index.js";\n'
    });

    expect(() =>
      applyResourceFromFile({
        force: true,
        repoRoot,
        specPath: "tools/saas/__fixtures__/resources/customer.json",
        targetPath: "."
      })
    ).toThrow(/Unsupported central file patch/i);
    expect(() =>
      statSync(
        resolve(repoRoot, "packages/domain/src/generated/customer/index.ts")
      )
    ).toThrow();
  });

  it("patches supported central files deterministically with force", () => {
    const repoRoot = createSeededRepo(createdRoots, {
      ".generated/apply-preview/customer/packages/db/src/migrations/0003_alpha.sql":
        "create table if not exists alpha ();\n",
      ".generated/apply-preview/customer/packages/db/src/migrations/meta/_journal.json":
        migrationJournal([
          {
            idx: 3,
            tag: "0003_alpha",
            when: 1781716827000
          }
        ]),
      ".generated/apply-preview/customer/packages/db/src/schema/index.ts":
        'export * from "./identity.js";\n',
      ".generated/apply-preview/customer/packages/domain/package.json": JSON.stringify(
        {
          exports: {
            ".": {
              import: "./src/index.ts",
              types: "./src/index.ts"
            }
          },
          name: "@auditrail/domain",
          private: true,
          type: "module",
          version: "0.1.0"
        },
        null,
        2
      ) + "\n",
      ".generated/apply-preview/customer/packages/domain/src/index.ts":
        'export * from "./product/index.js";\n'
    });

    const first = applyResourceFromFile({
      force: true,
      repoRoot,
      specPath: "tools/saas/__fixtures__/resources/customer.json",
      targetPath: ".generated/apply-preview/customer"
    });
    const firstDomainPackage = readGenerated(
      repoRoot,
      ".generated/apply-preview/customer/packages/domain/package.json"
    );
    const firstDomainIndex = readGenerated(
      repoRoot,
      ".generated/apply-preview/customer/packages/domain/src/index.ts"
    );
    const firstDbIndex = readGenerated(
      repoRoot,
      ".generated/apply-preview/customer/packages/db/src/schema/index.ts"
    );
    const firstMigration = readGenerated(
      repoRoot,
      ".generated/apply-preview/customer/packages/db/src/migrations/0004_customer.sql"
    );
    const firstJournal = readGenerated(
      repoRoot,
      ".generated/apply-preview/customer/packages/db/src/migrations/meta/_journal.json"
    );
    const second = applyResourceFromFile({
      force: true,
      repoRoot,
      specPath: "tools/saas/__fixtures__/resources/customer.json",
      targetPath: ".generated/apply-preview/customer"
    });

    expect(first.changes.some((change) => change.action === "update")).toBe(true);
    expect(
      readGenerated(
        repoRoot,
        ".generated/apply-preview/customer/packages/domain/package.json"
      )
    ).toBe(firstDomainPackage);
    expect(
      readGenerated(
        repoRoot,
        ".generated/apply-preview/customer/packages/domain/src/index.ts"
      )
    ).toBe(firstDomainIndex);
    expect(
      readGenerated(
        repoRoot,
        ".generated/apply-preview/customer/packages/db/src/schema/index.ts"
      )
    ).toBe(firstDbIndex);
    expect(
      readGenerated(
        repoRoot,
        ".generated/apply-preview/customer/packages/db/src/migrations/0004_customer.sql"
      )
    ).toBe(firstMigration);
    expect(
      readGenerated(
        repoRoot,
        ".generated/apply-preview/customer/packages/db/src/migrations/meta/_journal.json"
      )
    ).toBe(firstJournal);
    expect(second.changes.some((change) => change.action === "skip")).toBe(true);
  });

  it("rejects target paths outside the repo", () => {
    const repoRoot = createSeededRepo(createdRoots);

    expect(() =>
      applyResourceFromFile({
        repoRoot,
        specPath: "tools/saas/__fixtures__/resources/customer.json",
        targetPath: "../outside"
      })
    ).toThrow(/Unsafe apply target path/i);
  });

  it("rejects generated output that contains AuditTrail-specific imports", () => {
    const repoRoot = createSeededRepo(createdRoots);

    expect(() =>
      applyResourceFromFile({
        afterStage({ repoRoot: currentRepoRoot, stagePath }) {
          const path = resolve(
            currentRepoRoot,
            stagePath,
            "apps/api/src/modules/generated/customer/routes.ts"
          );

          writeFileSync(
            path,
            'import "packages/domain/src/audit-events/product.js";\n' +
              readFileSync(path, "utf8")
          );
        },
        repoRoot,
        specPath: "tools/saas/__fixtures__/resources/customer.json",
        targetPath: ".generated/apply-preview/customer"
      })
    ).toThrow(/failed validation/i);
  });

  it("fails before writing when the planner reports blocking warnings", () => {
    const repoRoot = createSeededRepo(createdRoots, {
      "apps/api/src/modules/customer/existing.ts": "export const existing = true;\n"
    });

    expect(() =>
      applyResourceFromFile({
        repoRoot,
        specPath: "tools/saas/__fixtures__/resources/customer.json",
        targetPath: ".generated/apply-preview/customer"
      })
    ).toThrow(/blocking issues/i);
  });

  it("formats created and manual-review changes in the summary", () => {
    const repoRoot = createSeededRepo(createdRoots);

    const summary = formatAppliedResourceSummary(
      applyResourceFromFile({
        repoRoot,
        specPath: "tools/saas/__fixtures__/resources/customer.json",
        targetPath: ".generated/apply-preview/customer"
      })
    );

    expect(summary).toContain("Created");
    expect(summary).toContain("Manual Review");
    expect(summary).toContain("packages/domain/package.json");
    expect(summary).toContain("apps/api/src/app.ts");
  });

  it("fails safely on repeated apply without force", () => {
    const repoRoot = createSeededRepo(createdRoots);

    applyResourceFromFile({
      repoRoot,
      specPath: "tools/saas/__fixtures__/resources/customer.json",
      targetPath: ".generated/apply-preview/customer"
    });

    expect(() =>
      applyResourceFromFile({
        repoRoot,
        specPath: "tools/saas/__fixtures__/resources/customer.json",
        targetPath: ".generated/apply-preview/customer"
      })
    ).toThrow(/requires --force/i);
  });

  it("does not mutate real repo source during isolated apply tests", () => {
    const repoRoot = createSeededRepo(createdRoots, {
      "apps/api/src/app.ts": "export const untouched = true;\n"
    });

    applyResourceFromFile({
      repoRoot,
      specPath: "tools/saas/__fixtures__/resources/customer.json",
      targetPath: ".generated/apply-preview/customer"
    });

    expect(readGenerated(repoRoot, "apps/api/src/app.ts")).toBe(
      "export const untouched = true;\n"
    );
  });

  it("installs a generated resource into the repo root and patches app wiring", () => {
    const repoRoot = createSeededRepo(createdRoots, {
      "apps/api/src/app.ts": seededApiAppSource(),
      "packages/db/src/migrations/0010_project_webhooks.sql": "select 1;\n",
      "packages/db/src/migrations/meta/_journal.json": migrationJournal([
        {
          idx: 10,
          tag: "0010_project_webhooks",
          when: 1782835200000
        }
      ]),
      "packages/db/src/schema/index.ts": 'export * from "./identity.js";\n',
      "packages/domain/package.json": JSON.stringify(
        {
          exports: {
            ".": {
              import: "./src/index.ts",
              types: "./src/index.ts"
            }
          },
          name: "@auditrail/domain",
          private: true,
          type: "module",
          version: "0.1.0"
        },
        null,
        2
      ) + "\n",
      "packages/domain/src/index.ts": 'export * from "./product/index.js";\n'
    });

    const result = applyResourceFromFile({
      repoRoot,
      specPath: "tools/saas/__fixtures__/resources/customer.json",
      targetPath: "."
    });

    expect(result.status).toBe("pass");
    expect(readGenerated(repoRoot, "apps/api/src/app.ts")).toContain(
      'import { createPostgresCustomerRepo } from "./modules/generated/customer/postgres-repo.js";'
    );
    expect(readGenerated(repoRoot, "apps/api/src/app.ts")).toContain(
      "infrastructureApp.register(registerCustomerRoutes, {"
    );
    expect(readGenerated(repoRoot, "apps/api/src/app.ts")).toContain(
      "prefix: API_BASE_PATH,"
    );
    expect(
      readGenerated(repoRoot, "packages/domain/src/generated/customer/index.ts")
    ).toContain("export const customerFieldSchema");
    expect(
      readGenerated(repoRoot, "packages/db/src/migrations/0011_customer.sql")
    ).toContain('create table if not exists "customers"');
    expect(
      readGenerated(repoRoot, "packages/db/src/migrations/meta/_journal.json")
    ).toContain('"tag": "0011_customer"');
  });

  it("supports the CLI apply command", () => {
    const repoRoot = createSeededRepo(createdRoots);

    const result = executeSaasCli({
      args: [
        "apply",
        "resource",
        "tools/saas/__fixtures__/resources/customer.json",
        "--target",
        ".generated/apply-preview/customer"
      ],
      repoRoot
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Applied generated resource target");
  });

  it("supports the CLI install command", () => {
    const repoRoot = createSeededRepo(createdRoots, {
      "apps/api/src/app.ts": seededApiAppSource(),
      "packages/db/src/schema/index.ts": 'export * from "./identity.js";\n',
      "packages/domain/package.json": JSON.stringify(
        {
          exports: {
            ".": {
              import: "./src/index.ts",
              types: "./src/index.ts"
            }
          },
          name: "@auditrail/domain",
          private: true,
          type: "module",
          version: "0.1.0"
        },
        null,
        2
      ) + "\n",
      "packages/domain/src/index.ts": 'export * from "./product/index.js";\n'
    });

    const result = executeSaasCli({
      args: [
        "install",
        "resource",
        "tools/saas/__fixtures__/resources/customer.json"
      ],
      repoRoot
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Applied generated resource target: .");
    expect(readGenerated(repoRoot, "apps/api/src/app.ts")).toContain(
      "registerCustomerRoutes"
    );
  });
});

function createSeededRepo(
  createdRoots: string[],
  extraFiles: Record<string, string> = {}
) {
  return createRepo(createdRoots, {
    "tools/saas/__fixtures__/resources/customer.json": readFixtureResource(
      "customer.json"
    ),
    ...readFixtureDirectory("customer"),
    ...extraFiles
  });
}

function createRepo(createdRoots: string[], files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "auditrail-resource-apply-"));

  createdRoots.push(root);

  for (const [path, contents] of Object.entries(files)) {
    const absolutePath = join(root, path);

    mkdirSync(join(absolutePath, ".."), {
      recursive: true
    });
    writeFileSync(absolutePath, contents);
  }

  return root;
}

function readFixtureResource(name: string) {
  return readFileSync(
    resolve(process.cwd(), "tools/saas/__fixtures__/resources", name),
    "utf8"
  );
}

function readFixtureDirectory(name: string) {
  const root = resolve(process.cwd(), "tools/saas/__fixtures__/generated", name);
  const files = walkFixtureDirectory(root);

  return Object.fromEntries(
    files.map((path) => [
      `tools/saas/__fixtures__/generated/${name}/${path}`,
      readFileSync(resolve(root, path), "utf8")
    ])
  );
}

function walkFixtureDirectory(root: string, currentPath = ""): string[] {
  const absolutePath = resolve(root, currentPath);
  const entries = readdirSync(absolutePath).sort((left, right) =>
    left.localeCompare(right)
  );
  const files: string[] = [];

  for (const entry of entries) {
    const nextPath = currentPath.length > 0 ? `${currentPath}/${entry}` : entry;
    const nextAbsolutePath = resolve(root, nextPath);

    if (statSync(nextAbsolutePath).isDirectory()) {
      files.push(...walkFixtureDirectory(root, nextPath));
      continue;
    }

    files.push(nextPath.replace(/\\/g, "/"));
  }

  return files;
}

function readGenerated(repoRoot: string, path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

function migrationJournal(
  entries: Array<{ idx: number; tag: string; when: number }>
) {
  return `${JSON.stringify(
    {
      version: "7",
      dialect: "postgresql",
      entries: entries.map((entry) => ({
        ...entry,
        breakpoints: true,
        version: "7"
      }))
    },
    null,
    2
  )}\n`;
}

function seededApiAppSource() {
  return [
    'import { API_BASE_PATH, API_VERSION_PREFIX } from "./api-version.js";',
    'import { registerApiKeyRoutes } from "./modules/api-keys/routes.js";',
    "",
    "export function buildApp() {",
    "  const infrastructureApp = {",
    "    db: {},",
    "    register() {}",
    "  };",
    "  const apiKeyService = {};",
    "  const workspaceAccessService = {};",
    "      infrastructureApp.register(registerApiKeyRoutes, {",
    "        prefix: API_VERSION_PREFIX,",
    "        service: apiKeyService,",
    "      });",
    "}",
    ""
  ].join("\n");
}
