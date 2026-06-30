import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { executeSaasCli } from "../cli.js";
import { generateResourceFromFile } from "../resource-generator.js";
import { createResourcePlanFromFile } from "../resource-planner.js";

describe("saas resource generator", () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    for (const root of createdRoots) {
      rmSync(root, {
        force: true,
        recursive: true
      });
    }
  });

  it("generates deterministic preview files for a valid organization-owned resource", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/customer.json": readFixture("customer.json")
    });

    const first = generateResourceFromFile({
      outputPath: ".generated/customer-preview",
      repoRoot,
      specPath: "specs/customer.json"
    });
    const second = generateResourceFromFile({
      force: true,
      outputPath: ".generated/customer-preview",
      repoRoot,
      specPath: "specs/customer.json"
    });

    expect(first.writtenFiles.map((file) => file.outputPath)).toEqual(
      second.writtenFiles.map((file) => file.outputPath)
    );
    expect(readGenerated(repoRoot, ".generated/customer-preview/docs/resources/customer.md")).toContain(
      "# Customer Resource Preview"
    );
    expect(
      readGenerated(
        repoRoot,
        ".generated/customer-preview/docs/resources/customer-customization.md"
      )
    ).toContain("# Customer CUSTOMIZE");
  });

  it("reuses the dry-run planner and writes only planned template files", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/customer.json": readFixture("customer.json")
    });
    const plan = createResourcePlanFromFile({
      repoRoot,
      specPath: "specs/customer.json"
    });
    const result = generateResourceFromFile({
      outputPath: ".generated/customer-preview",
      repoRoot,
      specPath: "specs/customer.json"
    });
    const plannedPaths = new Set(plan.generatedFiles.map((file) => file.path));

    for (const writtenFile of result.writtenFiles) {
      expect(plannedPaths.has(writtenFile.repoPath)).toBe(true);
    }
  });

  it("fails for unsupported ownership modes", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/profile.json": resourceSpecJson({
        fields: [{ name: "name", required: true, type: "string" }],
        label: "Profile",
        ownership: "user",
        resource: "profile"
      })
    });

    expect(() =>
      generateResourceFromFile({
        outputPath: ".generated/profile-preview",
        repoRoot,
        specPath: "specs/profile.json"
      })
    ).toThrow(/organization-owned resources only/i);
  });

  it("fails for unsupported field types", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/customer.json": resourceSpecJson({
        fields: [{ name: "metadata", required: false, type: "json" }],
        label: "Customer",
        ownership: "organization",
        resource: "customer"
      })
    });

    expect(() =>
      generateResourceFromFile({
        outputPath: ".generated/customer-preview",
        repoRoot,
        specPath: "specs/customer.json"
      })
    ).toThrow(/unsupported type 'json'/i);
  });

  it("fails when a generated target file already exists without force", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/customer.json": readFixture("customer.json")
    });

    generateResourceFromFile({
      outputPath: ".generated/customer-preview",
      repoRoot,
      specPath: "specs/customer.json"
    });

    expect(() =>
      generateResourceFromFile({
        outputPath: ".generated/customer-preview",
        repoRoot,
        specPath: "specs/customer.json"
      })
    ).toThrow(/without --force/i);
  });

  it("does not generate AuditTrail-specific imports or product copy", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/customer.json": readFixture("customer.json")
    });
    const result = generateResourceFromFile({
      outputPath: ".generated/customer-preview",
      repoRoot,
      specPath: "specs/customer.json"
    });

    for (const file of result.writtenFiles) {
      expect(file.contents).not.toContain("@auditrail/domain/audit-events");
      expect(file.contents).not.toContain("audit-product");
      expect(file.contents).not.toContain("AuditTrail");
    }
  });

  it("keeps written file ordering deterministic", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/customer.json": readFixture("customer.json")
    });
    const result = generateResourceFromFile({
      outputPath: ".generated/customer-preview",
      repoRoot,
      specPath: "specs/customer.json"
    });
    const orderedPaths = [...result.writtenFiles.map((file) => file.outputPath)].sort();

    expect(result.writtenFiles.map((file) => file.outputPath)).toEqual(orderedPaths);
  });

  it("keeps preview generation isolated from real app source", () => {
    const repoRoot = createRepo(createdRoots, {
      "apps/api/src/app.ts": "export const untouched = true;\n",
      "specs/customer.json": readFixture("customer.json")
    });

    generateResourceFromFile({
      outputPath: ".generated/customer-preview",
      repoRoot,
      specPath: "specs/customer.json"
    });

    expect(readGenerated(repoRoot, "apps/api/src/app.ts")).toBe(
      "export const untouched = true;\n"
    );
    expect(
      readGenerated(
        repoRoot,
        ".generated/customer-preview/apps/api/src/modules/generated/customer/routes.ts"
      )
    ).toContain("registerCustomerRoutes");
  });

  it("fails before writing when the planner reports blocking warnings", () => {
    const repoRoot = createRepo(createdRoots, {
      "apps/api/src/modules/customer/existing.ts": "export const existing = true;\n",
      "specs/customer.json": resourceSpecJson({
        fields: [{ name: "name", required: true, type: "string" }],
        label: "Customer",
        ownership: "organization",
        resource: "customer"
      })
    });

    expect(() =>
      generateResourceFromFile({
        outputPath: ".generated/customer-preview",
        repoRoot,
        specPath: "specs/customer.json"
      })
    ).toThrow(/blocking issues/i);
  });

  it("allows explicitly approved planner warnings for fixture-style generation", () => {
    const repoRoot = createRepo(createdRoots, {
      "apps/web/src/features/customer/index.ts": "export const existing = true;\n",
      "specs/customer.json": readFixture("customer.json")
    });

    expect(() =>
      generateResourceFromFile({
        allowedWarningCodes: ["existing-module-conflict"],
        outputPath: ".generated/customer-preview",
        repoRoot,
        specPath: "specs/customer.json"
      })
    ).not.toThrow();
  });

  it("supports the CLI add resource command with --output", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/customer.json": readFixture("customer.json")
    });

    const result = executeSaasCli({
      args: [
        "add",
        "resource",
        "specs/customer.json",
        "--output",
        ".generated/customer-preview"
      ],
      repoRoot
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Generated resource preview: customer");
  });

  it("generates a working Postgres repo template instead of TODO stubs", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/customer.json": readFixture("customer.json")
    });

    generateResourceFromFile({
      outputPath: ".generated/customer-preview",
      repoRoot,
      specPath: "specs/customer.json"
    });

    const postgresRepo = readGenerated(
      repoRoot,
      ".generated/customer-preview/apps/api/src/modules/generated/customer/postgres-repo.ts"
    );

    expect(postgresRepo).toContain("db.insert(customerTable)");
    expect(postgresRepo).toContain("db.select().from(customerTable)");
    expect(postgresRepo).toContain("db.update(customerTable)");
    expect(postgresRepo).not.toContain("TODO: implement customer");
  });
});

function createRepo(createdRoots: string[], files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "auditrail-resource-generator-"));

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

function readFixture(name: string) {
  return readFileSync(
    resolve(
      process.cwd(),
      "tools/saas/__fixtures__/resources",
      name
    ),
    "utf8"
  );
}

function readGenerated(repoRoot: string, path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

function resourceSpecJson(spec: Record<string, unknown>) {
  return JSON.stringify(
    {
      ui: {
        nav: false
      },
      ...spec
    },
    null,
    2
  );
}
