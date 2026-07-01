import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { executeSaasCli } from "../cli.js";
import {
  createResourcePlan,
  createResourcePlanFromFile
} from "../resource-planner.js";

describe("saas resource planner", () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    for (const root of createdRoots) {
      rmSync(root, {
        force: true,
        recursive: true
      });
    }
  });

  it("produces a deterministic plan for a valid resource", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/customer.resource.json": resourceSpecJson({
        fields: [
          {
            name: "name",
            required: true,
            type: "string"
          },
          {
            name: "email",
            required: true,
            type: "email"
          }
        ],
        label: "Customer",
        ownership: "organization",
        resource: "customer"
      })
    });

    const firstPlan = createResourcePlanFromFile({
      repoRoot,
      specPath: "specs/customer.resource.json"
    });
    const secondPlan = createResourcePlanFromFile({
      repoRoot,
      specPath: "specs/customer.resource.json"
    });

    expect(firstPlan).toEqual(secondPlan);
    expect(firstPlan.summary.totalEntries).toBeGreaterThan(10);
    expect(firstPlan.groups.domain.map((entry) => entry.path)).toEqual([
      "packages/domain/src/generated/customer",
      "packages/domain/src/generated/customer/index.ts",
      "packages/domain/src/index.ts"
    ]);
  });

  it("omits disabled CRUD pages and form files", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/report.resource.json": resourceSpecJson({
        crud: {
          create: false,
          delete: false,
          list: true,
          read: false,
          update: false
        },
        fields: [
          {
            name: "title",
            required: true,
            type: "string"
          }
        ],
        label: "Report",
        ownership: "organization",
        resource: "report"
      })
    });

    const plan = createResourcePlanFromFile({
      repoRoot,
      specPath: "specs/report.resource.json"
    });
    const webPaths = plan.groups.web.map((entry) => entry.path);

    expect(webPaths).toContain("apps/web/app/reports/page.tsx");
    expect(webPaths).not.toContain("apps/web/app/reports/create/page.tsx");
    expect(webPaths).not.toContain("apps/web/app/reports/[id]/page.tsx");
    expect(webPaths).not.toContain("apps/web/app/reports/[id]/edit/page.tsx");
    expect(
      webPaths.some((path) => path.endsWith("report-form.tsx"))
    ).toBe(false);
  });

  it("includes organization ownership assumptions", () => {
    const plan = createResourcePlan({
      repoRoot: "/repo",
      sourcePath: "/repo/specs/customer.json",
      spec: resourceSpec({
        fields: [
          {
            name: "name",
            required: true,
            type: "string"
          }
        ],
        label: "Customer",
        ownership: "organization",
        resource: "customer"
      })
    });

    expect(plan.assumptions).toContain(
      "Organization-owned resources assume organization-scoped API authorization and workspace-aware web routing."
    );
  });

  it("adds a nav adapter manual-review entry when ui.nav is enabled", () => {
    const plan = createResourcePlan({
      repoRoot: "/repo",
      sourcePath: "/repo/specs/customer.json",
      spec: resourceSpec({
        fields: [
          {
            name: "name",
            required: true,
            type: "string"
          }
        ],
        label: "Customer",
        ownership: "organization",
        resource: "customer",
        ui: {
          nav: true
        }
      })
    });

    expect(
      plan.groups.web.find(
        (entry) => entry.path === "apps/web/app/product-module.ts"
      )
    ).toMatchObject({
      action: "manual-review"
    });
    expect(plan.manualReview.some((item) => item.code === "product-navigation-review")).toBe(true);
  });

  it("marks existing planned files as updates", () => {
    const repoRoot = createRepo(createdRoots, {
      "packages/domain/src/generated/customer/index.ts": "export {};\n",
      "specs/customer.resource.json": resourceSpecJson({
        fields: [
          {
            name: "name",
            required: true,
            type: "string"
          }
        ],
        label: "Customer",
        ownership: "organization",
        resource: "customer"
      })
    });

    const plan = createResourcePlanFromFile({
      repoRoot,
      specPath: "specs/customer.resource.json"
    });

    expect(
      plan.groups.domain.find(
        (entry) =>
          entry.path === "packages/domain/src/generated/customer/index.ts"
      )
    ).toMatchObject({
      action: "update",
      exists: true
    });
  });

  it("fails before planning when the spec is invalid", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/customer.resource.json": JSON.stringify(
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
      args: ["plan", "resource", "specs/customer.resource.json"],
      repoRoot
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("values");
  });

  it("returns stable JSON output", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/customer.resource.json": resourceSpecJson({
        fields: [
          {
            name: "name",
            required: true,
            type: "string"
          }
        ],
        label: "Customer",
        ownership: "organization",
        resource: "customer"
      })
    });

    const result = executeSaasCli({
      args: [
        "plan",
        "resource",
        "specs/customer.resource.json",
        "--json"
      ],
      repoRoot
    });

    expect(result.exitCode).toBe(0);

    const payload = JSON.parse(result.stdout) as {
      groups: Record<string, Array<{ path: string }>>;
      source: { format: string; path: string };
      summary: { byAction: Record<string, number> };
    };

    expect(payload.source).toEqual({
      format: "json",
      path: "specs/customer.resource.json"
    });
    expect(payload.summary.byAction.create).toBeGreaterThan(0);
    expect(payload.groups.domain[0]?.path).toBe(
      "packages/domain/src/generated/customer"
    );
  });

  it("keeps entry ordering deterministic across groups", () => {
    const plan = createResourcePlan({
      repoRoot: "/repo",
      sourcePath: "/repo/specs/customer.json",
      spec: resourceSpec({
        fields: [
          {
            name: "name",
            required: true,
            type: "string"
          }
        ],
        label: "Customer",
        ownership: "organization",
        resource: "customer"
      })
    });

    expect(Object.keys(plan.groups)).toEqual([
      "api",
      "db",
      "docs",
      "domain",
      "web"
    ]);
    expect(plan.groups.api[0]?.path).toBe(
      "apps/api/src/modules/generated/customer"
    );
    expect(plan.groups.api.at(-1)?.path).toBe("apps/api/src/app.ts");
  });
});

function createRepo(createdRoots: string[], files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "auditrail-resource-plan-"));

  createdRoots.push(root);

  for (const [path, contents] of Object.entries(files)) {
    const absolutePath = join(root, path);
    const directory = join(absolutePath, "..");

    mkdirSync(directory, {
      recursive: true
    });
    writeFileSync(absolutePath, contents);
  }

  return root;
}

function resourceSpec(input: Record<string, unknown>) {
  return input;
}

function resourceSpecJson(input: Record<string, unknown>) {
  return JSON.stringify(resourceSpec(input), null, 2);
}
