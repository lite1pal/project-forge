import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, relative, resolve } from "node:path";

import { generateResourceFromFile } from "./resource-generator.js";

const generatorFixtureRoot = "tools/saas/__fixtures__/generated";
const generatorTempRoot = "tmp/saas-generator-check";

export interface GeneratorGoldenFixture {
  fixturePath: string;
  id: string;
  specPath: string;
}

export interface GeneratorGoldenDrift {
  details?: string;
  path: string;
  type: "changed" | "extra" | "missing";
}

export interface GeneratorGoldenComparison {
  expectedFiles: readonly string[];
  generatedFiles: readonly string[];
  matches: boolean;
  drift: readonly GeneratorGoldenDrift[];
}

export interface GeneratorGoldenFixtureResult {
  comparison: GeneratorGoldenComparison;
  fixture: GeneratorGoldenFixture;
  generatedOutputPath: string;
  status: "fail" | "pass" | "updated";
}

export interface GeneratorGoldenReport {
  exitCode: number;
  results: readonly GeneratorGoldenFixtureResult[];
  update: boolean;
}

export const generatorGoldenFixtures: readonly GeneratorGoldenFixture[] = [
  {
    fixturePath: "tools/saas/__fixtures__/generated/customer",
    id: "customer",
    specPath: "tools/saas/__fixtures__/resources/customer.json"
  }
] as const;

export function runGeneratorGoldenCheck(input: {
  fixtures?: readonly GeneratorGoldenFixture[];
  repoRoot: string;
  update?: boolean;
}): GeneratorGoldenReport {
  const fixtures = [...(input.fixtures ?? generatorGoldenFixtures)].sort((left, right) =>
    left.id.localeCompare(right.id)
  );
  const repoRoot = resolve(input.repoRoot);
  const update = input.update ?? false;
  const results: GeneratorGoldenFixtureResult[] = [];

  for (const fixture of fixtures) {
    validateGeneratorFixturePaths({
      fixture,
      repoRoot
    });

    const generatedOutputPath = `${generatorTempRoot}/${fixture.id}`;
    const generatedAbsolutePath = resolve(repoRoot, generatedOutputPath);

    rmSync(generatedAbsolutePath, {
      force: true,
      recursive: true
    });

    generateResourceFromFile({
      allowedWarningCodes: ["existing-module-conflict"],
      force: true,
      outputPath: generatedOutputPath,
      repoRoot,
      specPath: fixture.specPath
    });

    if (update) {
      syncGoldenFixtureDirectory({
        fixturePath: fixture.fixturePath,
        generatedOutputPath,
        repoRoot
      });
    }

    const comparison = compareGeneratorFixtureDirectories({
      expectedRoot: resolve(repoRoot, fixture.fixturePath),
      generatedRoot: generatedAbsolutePath
    });

    results.push({
      comparison,
      fixture,
      generatedOutputPath,
      status: update ? "updated" : comparison.matches ? "pass" : "fail"
    });

    rmSync(generatedAbsolutePath, {
      force: true,
      recursive: true
    });
  }

  return {
    exitCode: results.some((result) => result.status === "fail") ? 1 : 0,
    results,
    update
  };
}

export function compareGeneratorFixtureDirectories(input: {
  expectedRoot: string;
  generatedRoot: string;
}): GeneratorGoldenComparison {
  const expectedFiles = collectDirectoryFiles(input.expectedRoot);
  const generatedFiles = collectDirectoryFiles(input.generatedRoot);
  const drift: GeneratorGoldenDrift[] = [];
  const expectedSet = new Set(expectedFiles);
  const generatedSet = new Set(generatedFiles);

  for (const path of expectedFiles) {
    if (!generatedSet.has(path)) {
      drift.push({
        path,
        type: "missing"
      });
    }
  }

  for (const path of generatedFiles) {
    if (!expectedSet.has(path)) {
      drift.push({
        path,
        type: "extra"
      });
    }
  }

  for (const path of expectedFiles) {
    if (!generatedSet.has(path)) {
      continue;
    }

    const expectedContents = readFileSync(resolve(input.expectedRoot, path), "utf8");
    const generatedContents = readFileSync(resolve(input.generatedRoot, path), "utf8");

    if (expectedContents !== generatedContents) {
      drift.push({
        details: formatContentDrift({
          expectedContents,
          generatedContents,
          path
        }),
        path,
        type: "changed"
      });
    }
  }

  drift.sort((left, right) => {
    if (left.type === right.type) {
      return left.path.localeCompare(right.path);
    }

    return left.type.localeCompare(right.type);
  });

  return {
    drift,
    expectedFiles,
    generatedFiles,
    matches: drift.length === 0
  };
}

export function formatGeneratorGoldenReport(report: GeneratorGoldenReport) {
  const lines = [
    report.update
      ? "Generator golden fixtures updated"
      : "Generator golden fixture check",
    ""
  ];

  for (const result of report.results) {
    lines.push(
      `[${result.status.toUpperCase()}] ${result.fixture.id}`,
      `- spec: ${result.fixture.specPath}`,
      `- fixture: ${result.fixture.fixturePath}`,
      `- generated temp output: ${result.generatedOutputPath}`,
      `- expected files: ${result.comparison.expectedFiles.length}`,
      `- generated files: ${result.comparison.generatedFiles.length}`
    );

    if (result.comparison.drift.length > 0) {
      lines.push("- drift:");

      for (const item of result.comparison.drift) {
        lines.push(`  - ${item.type}: ${item.path}`);

        if (item.details) {
          lines.push(`    ${item.details}`);
        }
      }
    }

    lines.push("");
  }

  lines.push(
    `Summary`,
    `- fixtures: ${report.results.length}`,
    `- updated: ${report.results.filter((result) => result.status === "updated").length}`,
    `- pass: ${report.results.filter((result) => result.status === "pass").length}`,
    `- fail: ${report.results.filter((result) => result.status === "fail").length}`,
    `- exit code: ${report.exitCode}`
  );

  return lines.join("\n");
}

export function validateGeneratorFixturePaths(input: {
  fixture: GeneratorGoldenFixture;
  repoRoot: string;
}) {
  const repoRoot = resolve(input.repoRoot);
  const fixtureAbsolutePath = resolve(repoRoot, input.fixture.fixturePath);
  const fixtureRelativePath = relative(repoRoot, fixtureAbsolutePath).replace(
    /\\/g,
    "/"
  );
  const fixtureRootAbsolutePath = resolve(repoRoot, generatorFixtureRoot);
  const tempRootAbsolutePath = resolve(repoRoot, generatorTempRoot);

  if (
    !fixtureRelativePath.startsWith(`${generatorFixtureRoot}/`) &&
    fixtureRelativePath !== generatorFixtureRoot
  ) {
    throw new Error(
      `Unsafe generator fixture path '${input.fixture.fixturePath}'. Golden fixtures must stay under '${generatorFixtureRoot}/'.`
    );
  }

  if (fixtureAbsolutePath === fixtureRootAbsolutePath) {
    throw new Error(
      `Unsafe generator fixture path '${input.fixture.fixturePath}'. Golden fixtures must target a dedicated subdirectory.`
    );
  }

  if (fixtureAbsolutePath.startsWith(tempRootAbsolutePath)) {
    throw new Error(
      `Unsafe generator fixture path '${input.fixture.fixturePath}'. Golden fixtures must not point into the temp generation root.`
    );
  }
}

function syncGoldenFixtureDirectory(input: {
  fixturePath: string;
  generatedOutputPath: string;
  repoRoot: string;
}) {
  const fixtureAbsolutePath = resolve(input.repoRoot, input.fixturePath);
  const generatedAbsolutePath = resolve(input.repoRoot, input.generatedOutputPath);
  const files = collectDirectoryFiles(generatedAbsolutePath);

  rmSync(fixtureAbsolutePath, {
    force: true,
    recursive: true
  });

  for (const path of files) {
    const destinationPath = resolve(fixtureAbsolutePath, path);

    mkdirSync(dirname(destinationPath), {
      recursive: true
    });
    writeFileSync(destinationPath, readFileSync(resolve(generatedAbsolutePath, path)));
  }
}

function collectDirectoryFiles(root: string) {
  if (!directoryExists(root)) {
    return [];
  }

  return walkDirectory(root).sort((left, right) => left.localeCompare(right));
}

function walkDirectory(root: string, currentPath = ""): string[] {
  const absolutePath = resolve(root, currentPath);
  const entries = readdirSync(absolutePath).sort((left, right) =>
    left.localeCompare(right)
  );
  const files: string[] = [];

  for (const entry of entries) {
    const nextPath = currentPath.length > 0 ? `${currentPath}/${entry}` : entry;
    const nextAbsolutePath = resolve(root, nextPath);

    if (statSync(nextAbsolutePath).isDirectory()) {
      files.push(...walkDirectory(root, nextPath));
      continue;
    }

    files.push(nextPath.replace(/\\/g, "/"));
  }

  return files;
}

function directoryExists(path: string) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function formatContentDrift(input: {
  expectedContents: string;
  generatedContents: string;
  path: string;
}) {
  const expectedLines = input.expectedContents.split("\n");
  const generatedLines = input.generatedContents.split("\n");
  const maxLength = Math.max(expectedLines.length, generatedLines.length);

  for (let index = 0; index < maxLength; index += 1) {
    const expectedLine = expectedLines[index];
    const generatedLine = generatedLines[index];

    if (expectedLine === generatedLine) {
      continue;
    }

    return [
      `@@ ${input.path}:${index + 1}`,
      `- ${expectedLine ?? "<EOF>"}`,
      `+ ${generatedLine ?? "<EOF>"}`
    ].join("\n    ");
  }

  return `@@ ${input.path}: content changed`;
}
