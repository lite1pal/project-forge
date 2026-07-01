import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { executeSaasCli } from "../cli.js";
import {
  createProductPlanFromFile,
  formatProductPlanReport
} from "../product-planner.js";

describe("saas product planner", () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    for (const root of createdRoots) {
      rmSync(root, {
        force: true,
        recursive: true
      });
    }
  });

  it("produces a deterministic dry-run plan for a todo product spec", () => {
    const repoRoot = createSeededRepo(createdRoots);
    const initResult = executeSaasCli({
      args: [
        "init",
        "product",
        "todo",
        "--template",
        "todo",
        "--output",
        "specs/todo.product.json"
      ],
      repoRoot
    });

    expect(initResult.exitCode).toBe(0);

    const firstPlan = createProductPlanFromFile({
      repoRoot,
      specPath: "specs/todo.product.json"
    });
    const secondPlan = createProductPlanFromFile({
      repoRoot,
      specPath: "specs/todo.product.json"
    });

    expect(firstPlan).toEqual(secondPlan);
    expect(firstPlan.product).toMatchObject({
      homeRoute: "/todo",
      id: "todo",
      name: "Todo"
    });
    expect(firstPlan.product.resources).toEqual([
      expect.objectContaining({
        id: "todo",
        installCommand:
          "pnpm saas install resource tmp/saas-product-install/todo/todo.json",
        listPath: "/todo/todos",
        navLabel: "Todos",
        ownership: "organization"
      })
    ]);
    expect(firstPlan.rootPatches.map((entry) => entry.path)).toEqual([
      "packages/domain/src/index.ts",
      "packages/domain/package.json",
      "apps/api/src/product-module.ts",
      "apps/web/app/product-module.ts",
      "apps/api/src/__tests__/product-module.test.ts"
    ]);
    expect(formatProductPlanReport(firstPlan)).toContain(
      "Shared Root Patches"
    );
  });

  it("prints a readable CLI report and supports json output", () => {
    const repoRoot = createSeededRepo(createdRoots);

    executeSaasCli({
      args: [
        "init",
        "product",
        "todo",
        "--template",
        "todo",
        "--output",
        "specs/todo.product.json"
      ],
      repoRoot
    });

    const reportResult = executeSaasCli({
      args: ["plan", "product", "specs/todo.product.json"],
      repoRoot
    });
    const jsonResult = executeSaasCli({
      args: ["plan", "product", "specs/todo.product.json", "--json"],
      repoRoot
    });

    expect(reportResult.exitCode).toBe(0);
    expect(reportResult.stdout).toContain("Generated product plan: todo");
    expect(reportResult.stdout).toContain(
      "todo: /todo/todos via pnpm saas install resource tmp/saas-product-install/todo/todo.json"
    );
    expect(reportResult.stdout).toContain(
      "apps/api/src/product-module.ts: Register the generated product module in the API product runtime."
    );

    expect(jsonResult.exitCode).toBe(0);
    expect(JSON.parse(jsonResult.stdout)).toMatchObject({
      product: {
        id: "todo"
      },
      specPath: "specs/todo.product.json",
      summary: {
        resourceCount: 1
      }
    });
  });

  it("fails cleanly when the product spec path is missing", () => {
    const result = executeSaasCli({
      args: ["plan", "product"],
      repoRoot: "/repo"
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe(
      "Missing product spec path. Usage: pnpm saas plan product <path-to-product-spec.json> [--json]"
    );
  });
});

function createSeededRepo(createdRoots: string[]) {
  const root = mkdtempSync(join(tmpdir(), "auditrail-product-plan-"));

  createdRoots.push(root);

  const requiredFiles = [
    "apps/api/src/app.ts",
    "apps/api/src/product-module.ts",
    "apps/api/src/__tests__/product-module.test.ts",
    "apps/web/app/product-module.ts",
    "packages/db/src/migrations/meta/_journal.json",
    "packages/db/src/schema/index.ts",
    "packages/domain/package.json",
    "packages/domain/src/index.ts"
  ] as const;

  for (const filePath of requiredFiles) {
    writeRepoFile(root, filePath, readGenerated(process.cwd(), filePath));
  }

  return root;
}

function writeRepoFile(repoRoot: string, filePath: string, contents: string) {
  const absolutePath = resolve(repoRoot, filePath);

  mkdirSync(join(absolutePath, ".."), {
    recursive: true
  });
  writeFileSync(absolutePath, contents);
}

function readGenerated(repoRoot: string, filePath: string) {
  return readFileSync(resolve(repoRoot, filePath), "utf8");
}
