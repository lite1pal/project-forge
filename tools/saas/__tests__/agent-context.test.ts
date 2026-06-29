import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { executeSaasCli } from "../cli.js";
import {
  createResourceAgentContextFromFile,
  formatResourceAgentContextMarkdown
} from "../agent-context.js";

describe("saas agent context", () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    for (const root of createdRoots) {
      rmSync(root, {
        force: true,
        recursive: true
      });
    }
  });

  it("emits deterministic markdown context for a valid resource", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/customer.json": readFixture("customer.json")
    });

    const first = createResourceAgentContextFromFile({
      repoRoot,
      specPath: "specs/customer.json"
    });
    const second = createResourceAgentContextFromFile({
      repoRoot,
      specPath: "specs/customer.json"
    });

    expect(formatResourceAgentContextMarkdown(first.bundle)).toEqual(
      formatResourceAgentContextMarkdown(second.bundle)
    );
    expect(formatResourceAgentContextMarkdown(first.bundle)).toContain(
      "# Agent Context: Customer"
    );
  });

  it("emits deterministic JSON context through the CLI", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/customer.json": readFixture("customer.json")
    });

    const first = executeSaasCli({
      args: ["agent", "context", "resource", "specs/customer.json", "--json"],
      repoRoot
    });
    const second = executeSaasCli({
      args: ["agent", "context", "resource", "specs/customer.json", "--json"],
      repoRoot
    });

    expect(first.exitCode).toBe(0);
    expect(first.stdout).toEqual(second.stdout);

    const payload = JSON.parse(first.stdout) as {
      forbiddenPaths: string[];
      requiredChecks: string[];
      taskType: string;
    };

    expect(payload.taskType).toBe("generated-resource");
    expect(payload.requiredChecks).toContain("pnpm saas doctor");
  });

  it("fails before context generation when the spec is invalid", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/customer.json": JSON.stringify(
        {
          fields: [
            {
              name: "status",
              required: true,
              type: "enum"
            }
          ],
          label: "Customer",
          ownership: "organization",
          resource: "customer"
        },
        null,
        2
      )
    });

    const result = executeSaasCli({
      args: ["agent", "context", "resource", "specs/customer.json"],
      repoRoot
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("values");
  });

  it("includes AuditTrail product modules in forbidden paths", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/customer.json": readFixture("customer.json")
    });
    const result = createResourceAgentContextFromFile({
      repoRoot,
      specPath: "specs/customer.json"
    });

    expect(result.bundle.forbiddenPaths).toEqual(
      expect.arrayContaining([
        "apps/api/src/modules/audit-events/**",
        "apps/web/src/features/audit-events/**",
        "packages/domain/src/audit-events/**"
      ])
    );
  });

  it("includes boundary, doctor, planner, generator, typecheck, and verify checks", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/customer.json": readFixture("customer.json")
    });
    const result = createResourceAgentContextFromFile({
      repoRoot,
      specPath: "specs/customer.json"
    });

    expect(result.bundle.requiredChecks).toEqual(
      expect.arrayContaining([
        "pnpm check:boundaries",
        "pnpm saas doctor",
        "pnpm saas plan resource specs/customer.json",
        "pnpm saas add resource specs/customer.json --output .generated/resource-preview/customer",
        "pnpm typecheck",
        "pnpm verify"
      ])
    );
  });

  it("preserves planner manual-review warnings", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/customer.json": readFixture("customer.json")
    });
    const result = createResourceAgentContextFromFile({
      repoRoot,
      specPath: "specs/customer.json"
    });

    expect(result.bundle.manualReviewWarnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "migration-placeholder"
        })
      ])
    );
  });

  it("references docs by path instead of copying large doc contents", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/customer.json": readFixture("customer.json")
    });
    const result = createResourceAgentContextFromFile({
      repoRoot,
      specPath: "specs/customer.json"
    });
    const markdown = formatResourceAgentContextMarkdown(result.bundle);

    expect(markdown).toContain("AGENTS.md");
    expect(markdown).not.toContain("## Task Queue Rule");
    expect(markdown).not.toContain(
      "AuditTrail should be difficult to extend without tests."
    );
  });

  it("keeps context file ordering deterministic", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/customer.json": readFixture("customer.json")
    });
    const result = createResourceAgentContextFromFile({
      repoRoot,
      specPath: "specs/customer.json"
    });
    const ordered = [...result.bundle.relevantContextFiles].sort((left, right) =>
      left.localeCompare(right)
    );

    expect(result.bundle.relevantContextFiles).not.toEqual(ordered);
    expect(result.bundle.relevantContextFiles[0]).toBe("AGENTS.md");
  });

  it("writes optional output files only to safe directories", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/customer.json": readFixture("customer.json")
    });
    const success = executeSaasCli({
      args: [
        "agent",
        "context",
        "resource",
        "specs/customer.json",
        "--output",
        ".generated/agent-context/customer.md"
      ],
      repoRoot
    });
    const failure = executeSaasCli({
      args: [
        "agent",
        "context",
        "resource",
        "specs/customer.json",
        "--output",
        "docs/customer.md"
      ],
      repoRoot
    });

    expect(success.exitCode).toBe(0);
    expect(
      readGenerated(repoRoot, ".generated/agent-context/customer.md")
    ).toContain("# Agent Context: Customer");
    expect(failure.exitCode).toBe(1);
    expect(failure.stderr).toContain("Unsafe extraction output path");
  });
});

function createRepo(createdRoots: string[], files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "auditrail-agent-context-"));

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
