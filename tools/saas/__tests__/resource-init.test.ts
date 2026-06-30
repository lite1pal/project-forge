import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { executeSaasCli } from "../cli.js";
import { createResourcePlanFromFile } from "../resource-planner.js";

describe("saas resource init", () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    for (const root of createdRoots) {
      rmSync(root, {
        force: true,
        recursive: true
      });
    }
  });

  it("creates a generator-ready resource spec from terminal flags", () => {
    const repoRoot = createRepo(createdRoots, {});

    const result = executeSaasCli({
      args: [
        "init",
        "resource",
        "achievement",
        "--label",
        "Achievement",
        "--field",
        "title:string:required:searchable:sortable",
        "--field",
        "slug:string:required:unique",
        "--field",
        "description:text",
        "--field",
        "status:enum:required:values=draft|published:default=draft",
        "--field",
        "isActive:boolean:required:default=true",
        "--output",
        "specs/achievement.json"
      ],
      repoRoot
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Initialized resource spec: achievement");
    expect(result.stdout).toContain("pnpm saas plan resource specs/achievement.json");

    const writtenSpec = JSON.parse(
      readFileSync(resolve(repoRoot, "specs/achievement.json"), "utf8")
    ) as {
      api: { prefix: string };
      fields: Array<{ default?: unknown; name: string; values?: string[] }>;
      ownership: string;
      resource: string;
      ui: { nav: boolean };
    };

    expect(writtenSpec.resource).toBe("achievement");
    expect(writtenSpec.ownership).toBe("organization");
    expect(writtenSpec.api.prefix).toBe(
      "/v1/organizations/:organizationId/achievements"
    );
    expect(writtenSpec.ui.nav).toBe(false);
    expect(writtenSpec.fields.find((field) => field.name === "status")).toMatchObject({
      default: "draft",
      values: ["draft", "published"]
    });
    expect(
      writtenSpec.fields.find((field) => field.name === "isActive")?.default
    ).toBe(true);

    const plan = createResourcePlanFromFile({
      repoRoot,
      specPath: "specs/achievement.json"
    });

    expect(plan.resource.resource).toBe("achievement");
  });

  it("refuses to overwrite an existing spec without force", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/achievement.json": "{}\n"
    });

    const result = executeSaasCli({
      args: [
        "init",
        "resource",
        "achievement",
        "--field",
        "title:string:required"
      ],
      repoRoot
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/already exists/i);
  });

  it("fails on unsupported field modifiers and types", () => {
    const repoRoot = createRepo(createdRoots, {});

    const invalidModifier = executeSaasCli({
      args: [
        "init",
        "resource",
        "achievement",
        "--field",
        "title:string:banana"
      ],
      repoRoot
    });
    const invalidType = executeSaasCli({
      args: [
        "init",
        "resource",
        "achievement",
        "--field",
        "metadata:json"
      ],
      repoRoot
    });

    expect(invalidModifier.exitCode).toBe(1);
    expect(invalidModifier.stderr).toMatch(/unsupported field modifier/i);
    expect(invalidType.exitCode).toBe(1);
    expect(invalidType.stderr).toMatch(/unsupported field type/i);
  });
});

function createRepo(createdRoots: string[], files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "auditrail-resource-init-"));

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
