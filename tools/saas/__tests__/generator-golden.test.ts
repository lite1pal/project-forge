import {
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { mkdtempSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

import { executeSaasCli } from "../cli.js";
import {
  formatGeneratorGoldenReport,
  runGeneratorGoldenCheck,
  validateGeneratorFixturePaths
} from "../generator-golden.js";

describe("saas generator golden fixtures", () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    for (const root of createdRoots) {
      rmSync(root, {
        force: true,
        recursive: true
      });
    }
  });

  it("passes for the current generated output", () => {
    const repoRoot = createRepo(createdRoots, {
      "tools/saas/__fixtures__/resources/customer.json": readFixture("customer.json")
    });

    const seeded = runGeneratorGoldenCheck({
      repoRoot,
      update: true
    });
    const report = runGeneratorGoldenCheck({
      repoRoot
    });

    expect(seeded.exitCode).toBe(0);
    expect(report.exitCode).toBe(0);
    expect(report.results[0]?.status).toBe("pass");
  });

  it("fails when an expected golden file is missing from generated output", () => {
    const repoRoot = createSeededRepo(createdRoots);

    writeFileSync(
      resolve(
        repoRoot,
        "tools/saas/__fixtures__/generated/customer/placeholder.txt"
      ),
      "expected only\n"
    );

    const report = runGeneratorGoldenCheck({
      repoRoot
    });

    expect(report.exitCode).toBe(1);
    expect(report.results[0]?.comparison.drift).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "placeholder.txt",
          type: "missing"
        })
      ])
    );
  });

  it("fails when the generator produces an extra file not present in the golden fixture", () => {
    const repoRoot = createSeededRepo(createdRoots);

    unlinkSync(
      resolve(
        repoRoot,
        "tools/saas/__fixtures__/generated/customer/docs/resources/customer.md"
      )
    );

    const report = runGeneratorGoldenCheck({
      repoRoot
    });

    expect(report.exitCode).toBe(1);
    expect(report.results[0]?.comparison.drift).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "docs/resources/customer.md",
          type: "extra"
        })
      ])
    );
  });

  it("fails when golden content drifts", () => {
    const repoRoot = createSeededRepo(createdRoots);
    const path =
      "tools/saas/__fixtures__/generated/customer/packages/domain/src/generated/customer/index.ts";

    writeFileSync(resolve(repoRoot, path), "export const drift = true;\n");

    const report = runGeneratorGoldenCheck({
      repoRoot
    });

    expect(report.exitCode).toBe(1);
    expect(report.results[0]?.comparison.drift).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "packages/domain/src/generated/customer/index.ts",
          type: "changed"
        })
      ])
    );
    expect(formatGeneratorGoldenReport(report)).toContain("@@ packages/domain/src/generated/customer/index.ts:1");
  });

  it("keeps report ordering deterministic", () => {
    const repoRoot = createSeededRepo(createdRoots);
    const first = formatGeneratorGoldenReport(
      runGeneratorGoldenCheck({
        repoRoot
      })
    );
    const second = formatGeneratorGoldenReport(
      runGeneratorGoldenCheck({
        repoRoot
      })
    );

    expect(first).toEqual(second);
  });

  it("update mode restores drifted fixtures", () => {
    const repoRoot = createSeededRepo(createdRoots);
    const path =
      "tools/saas/__fixtures__/generated/customer/packages/domain/src/generated/customer/index.ts";

    writeFileSync(resolve(repoRoot, path), "export const drift = true;\n");

    const updated = runGeneratorGoldenCheck({
      repoRoot,
      update: true
    });
    const report = runGeneratorGoldenCheck({
      repoRoot
    });

    expect(updated.exitCode).toBe(0);
    expect(updated.results[0]?.status).toBe("updated");
    expect(report.exitCode).toBe(0);
    expect(report.results[0]?.status).toBe("pass");
  });

  it("rejects unsafe fixture paths", () => {
    expect(() =>
      validateGeneratorFixturePaths({
        fixture: {
          fixturePath: "docs/generated/customer",
          id: "customer",
          specPath: "tools/saas/__fixtures__/resources/customer.json"
        },
        repoRoot: "/repo"
      })
    ).toThrow(/Unsafe generator fixture path/i);
  });

  it("supports the CLI generator check command", () => {
    const repoRoot = createRepo(createdRoots, {
      "tools/saas/__fixtures__/resources/customer.json": readFixture("customer.json")
    });

    const seed = executeSaasCli({
      args: ["check", "generators", "--update"],
      repoRoot
    });
    const check = executeSaasCli({
      args: ["check", "generators"],
      repoRoot
    });

    expect(seed.exitCode).toBe(0);
    expect(check.exitCode).toBe(0);
    expect(check.stdout).toContain("Generator golden fixture check");
  });
});

function createSeededRepo(createdRoots: string[]) {
  const repoRoot = createRepo(createdRoots, {
    "tools/saas/__fixtures__/resources/customer.json": readFixture("customer.json")
  });

  const seeded = runGeneratorGoldenCheck({
    repoRoot,
    update: true
  });

  expect(seeded.exitCode).toBe(0);

  return repoRoot;
}

function createRepo(createdRoots: string[], files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "auditrail-generator-golden-"));

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
