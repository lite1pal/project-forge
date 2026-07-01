import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync
} from "node:fs";
import { relative, resolve } from "node:path";

import ts from "typescript";

import { resolveSafeOutputPath } from "../extraction/output.js";
import {
  compareGeneratorFixtureDirectories,
  type GeneratorGoldenComparison,
  type GeneratorGoldenFixture,
  validateGeneratorFixturePaths
} from "./generator-golden.js";
import { generateResourceFromFile } from "./resource-generator.js";
import { createResourcePlanFromFile } from "./resource-planner.js";

const generatedResourceSmokeTempRoot = "tmp/saas-generated-resource-smoke";

const forbiddenImportMatchers = [
  "apps/api/src/modules/audit-events",
  "apps/web/src/features/audit-events",
  "packages/domain/src/audit-events",
  "@auditrail/domain/audit-events",
  "audit-product",
  "auditTrailProduct",
  "app/product-module",
  "getting-started",
  "onboarding",
  "support",
  "billing",
  "entitlements"
] as const;

const unresolvedPlaceholderMatchers = [
  "<next>",
  "<resource>",
  "<plural>",
  "{{",
  "}}"
] as const;

const expectedGroupChecks = [
  {
    id: "domain",
    predicate: (path: string) =>
      path.startsWith("packages/domain/src/generated/")
  },
  {
    id: "db-schema-or-stub",
    predicate: (path: string) => path.startsWith("packages/db/src/schema/")
  },
  {
    id: "api-module",
    predicate: (path: string) =>
      path.startsWith("apps/api/src/modules/generated/")
  },
  {
    id: "api-tests",
    predicate: (path: string) =>
      path.startsWith("apps/api/src/modules/generated/") &&
      path.includes("/__tests__/")
  },
  {
    id: "web-feature",
    predicate: (path: string) =>
      path.startsWith("apps/web/src/features/")
  },
  {
    id: "web-tests-or-stubs",
    predicate: (path: string) =>
      path.startsWith("apps/web/src/features/") &&
      path.includes("/__tests__/")
  },
  {
    id: "docs-customization-guidance",
    predicate: (path: string) =>
      path.startsWith("docs/resources/") && path.endsWith("-customization.md")
  }
] as const;

export interface GeneratedResourceSmokeIssue {
  details?: string;
  path?: string;
  type:
    | "forbidden-import"
    | "golden-drift"
    | "missing-group"
    | "path-safety"
    | "planner-alignment"
    | "runtime-mutation"
    | "syntax"
    | "unresolved-placeholder";
}

export interface GeneratedResourceSmokeResult {
  cleanedUp: boolean;
  comparison: GeneratorGoldenComparison;
  fixture: GeneratorGoldenFixture;
  outputPaths: readonly string[];
  status: "fail" | "pass";
  syntaxCheckedFiles: number;
  validatedGroups: readonly string[];
  issues: readonly GeneratedResourceSmokeIssue[];
}

export interface GeneratedResourceSmokeReport {
  exitCode: number;
  results: readonly GeneratedResourceSmokeResult[];
}

export interface GeneratedResourceOutputValidation {
  comparison?: GeneratorGoldenComparison;
  files: readonly string[];
  issues: readonly GeneratedResourceSmokeIssue[];
  syntaxCheckedFiles: number;
  validatedGroups: readonly string[];
}

export const generatedResourceSmokeFixtures: readonly GeneratorGoldenFixture[] = [
  {
    fixturePath: "tools/saas/__fixtures__/generated/customer",
    id: "customer",
    specPath: "tools/saas/__fixtures__/resources/customer.json"
  }
] as const;

export function runGeneratedResourceSmokeCheck(input: {
  afterGenerate?: (context: {
    fixture: GeneratorGoldenFixture;
    outputPaths: readonly string[];
    repoRoot: string;
  }) => void;
  fixtures?: readonly GeneratorGoldenFixture[];
  repoRoot: string;
}): GeneratedResourceSmokeReport {
  const repoRoot = resolve(input.repoRoot);
  const fixtures = [...(input.fixtures ?? generatedResourceSmokeFixtures)].sort(
    (left, right) => left.id.localeCompare(right.id)
  );
  const results: GeneratedResourceSmokeResult[] = [];

  for (const fixture of fixtures) {
    validateGeneratorFixturePaths({
      fixture,
      repoRoot
    });

    const smokeOutputPaths = [
      resolveSmokeOutputPath({
        fixtureId: fixture.id,
        repoRoot,
        runId: "run-a"
      }),
      resolveSmokeOutputPath({
        fixtureId: fixture.id,
        repoRoot,
        runId: "run-b"
      })
    ];
    const baselineFiles = createRuntimeMutationBaseline({
      repoRoot,
      specPath: fixture.specPath
    });
    const issues: GeneratedResourceSmokeIssue[] = [];
    let comparison: GeneratorGoldenComparison = {
      drift: [],
      expectedFiles: [],
      generatedFiles: [],
      matches: false
    };
    let syntaxCheckedFiles = 0;
    let validatedGroups: string[] = [];

    try {
      for (const outputPath of smokeOutputPaths) {
        rmSync(resolve(repoRoot, outputPath), {
          force: true,
          recursive: true
        });
      }

      const first = generateResourceFromFile({
        allowedWarningCodes: ["existing-module-conflict"],
        force: true,
        outputPath: smokeOutputPaths[0],
        repoRoot,
        specPath: fixture.specPath
      });
      const second = generateResourceFromFile({
        allowedWarningCodes: ["existing-module-conflict"],
        force: true,
        outputPath: smokeOutputPaths[1],
        repoRoot,
        specPath: fixture.specPath
      });

      input.afterGenerate?.({
        fixture,
        outputPaths: smokeOutputPaths,
        repoRoot
      });

      const firstFiles = collectDirectoryFiles(resolve(repoRoot, smokeOutputPaths[0]));
      const secondFiles = collectDirectoryFiles(resolve(repoRoot, smokeOutputPaths[1]));

      issues.push(
        ...collectPlannerAlignmentIssues({
          actualFiles: firstFiles,
          plannedPaths: first.writtenFiles.map((file) => file.repoPath)
        })
      );
      issues.push(
        ...collectDeterminismIssues({
          generatedRoot: resolve(repoRoot, smokeOutputPaths[0]),
          repeatRoot: resolve(repoRoot, smokeOutputPaths[1])
        })
      );

      comparison = compareGeneratorFixtureDirectories({
        expectedRoot: resolve(repoRoot, fixture.fixturePath),
        generatedRoot: resolve(repoRoot, smokeOutputPaths[0])
      });

      if (!comparison.matches) {
        for (const drift of comparison.drift) {
          issues.push({
            details: drift.details,
            path: drift.path,
            type: "golden-drift"
          });
        }
      }

      validatedGroups = collectValidatedGroups(firstFiles);
      issues.push(...collectMissingGroupIssues(validatedGroups));
      issues.push(
        ...collectGeneratedFileContentIssues({
          files: firstFiles,
          generatedRoot: resolve(repoRoot, smokeOutputPaths[0])
        })
      );
      syntaxCheckedFiles = collectSyntaxDiagnostics({
        files: firstFiles,
        generatedRoot: resolve(repoRoot, smokeOutputPaths[0]),
        issues
      });
      issues.push(
        ...collectRuntimeMutationIssues({
          baselineFiles,
          repoRoot
        })
      );

      results.push({
        cleanedUp: true,
        comparison,
        fixture,
        issues,
        outputPaths: smokeOutputPaths,
        status: issues.length === 0 ? "pass" : "fail",
        syntaxCheckedFiles,
        validatedGroups
      });
      void second;
    } finally {
      for (const outputPath of smokeOutputPaths) {
        rmSync(resolve(repoRoot, outputPath), {
          force: true,
          recursive: true
        });
      }

      rmSync(resolve(repoRoot, generatedResourceSmokeTempRoot, fixture.id), {
        force: true,
        recursive: true
      });
    }
  }

  return {
    exitCode: results.some((result) => result.status === "fail") ? 1 : 0,
    results
  };
}

export function formatGeneratedResourceSmokeReport(
  report: GeneratedResourceSmokeReport
) {
  const lines = ["Generated resource smoke check", ""];

  for (const result of report.results) {
    lines.push(
      `[${result.status.toUpperCase()}] ${result.fixture.id}`,
      `- spec: ${result.fixture.specPath}`,
      `- golden fixture: ${result.fixture.fixturePath}`,
      `- temp output root: ${generatedResourceSmokeTempRoot}/${result.fixture.id}`,
      `- repeated generation: ${result.outputPaths.join(", ")}`,
      `- golden drift entries: ${result.comparison.drift.length}`,
      `- syntax-checked files: ${result.syntaxCheckedFiles}`,
      `- validated groups: ${result.validatedGroups.join(", ") || "none"}`,
      `- cleaned up: ${result.cleanedUp ? "yes" : "no"}`
    );

    if (result.issues.length > 0) {
      lines.push("- issues:");

      for (const issue of result.issues) {
        lines.push(
          `  - ${issue.type}${issue.path ? `: ${issue.path}` : ""}${
            issue.details ? ` (${issue.details})` : ""
          }`
        );
      }
    }

    lines.push("");
  }

  lines.push(
    "Summary",
    `- fixtures: ${report.results.length}`,
    `- pass: ${report.results.filter((result) => result.status === "pass").length}`,
    `- fail: ${report.results.filter((result) => result.status === "fail").length}`,
    `- exit code: ${report.exitCode}`
  );

  return lines.join("\n");
}

export function validateGeneratedResourceOutput(input: {
  expectedGoldenRoot?: string;
  generatedRoot: string;
  plannedPaths?: readonly string[];
}): GeneratedResourceOutputValidation {
  const files = collectDirectoryFiles(input.generatedRoot);
  const issues: GeneratedResourceSmokeIssue[] = [];
  let comparison: GeneratorGoldenComparison | undefined;

  if (input.plannedPaths) {
    issues.push(
      ...collectPlannerAlignmentIssues({
        actualFiles: files,
        plannedPaths: input.plannedPaths
      })
    );
  }

  if (input.expectedGoldenRoot) {
    comparison = compareGeneratorFixtureDirectories({
      expectedRoot: input.expectedGoldenRoot,
      generatedRoot: input.generatedRoot
    });

    if (!comparison.matches) {
      for (const drift of comparison.drift) {
        issues.push({
          details: drift.details,
          path: drift.path,
          type: "golden-drift"
        });
      }
    }
  }

  const validatedGroups = collectValidatedGroups(files);

  issues.push(...collectMissingGroupIssues(validatedGroups));
  issues.push(
    ...collectGeneratedFileContentIssues({
      files,
      generatedRoot: input.generatedRoot
    })
  );

  const syntaxCheckedFiles = collectSyntaxDiagnostics({
    files,
    generatedRoot: input.generatedRoot,
    issues
  });

  return {
    comparison,
    files,
    issues,
    syntaxCheckedFiles,
    validatedGroups
  };
}

function resolveSmokeOutputPath(input: {
  fixtureId: string;
  repoRoot: string;
  runId: string;
}) {
  return resolveSafeOutputPath({
    outputPath: `${generatedResourceSmokeTempRoot}/${input.fixtureId}/${input.runId}`,
    repoRoot: input.repoRoot
  });
}

function createRuntimeMutationBaseline(input: {
  repoRoot: string;
  specPath: string;
}) {
  const plan = createResourcePlanFromFile({
    repoRoot: input.repoRoot,
    specPath: input.specPath
  });
  const candidatePaths = [
    ...plan.generatedFiles.map((file) => file.path),
    "apps/api/src/app.ts",
    "packages/db/src/schema/index.ts",
    "packages/domain/src/index.ts",
    "docs/03-api.md",
    "apps/web/app/product-module.ts"
  ];

  return candidatePaths
    .filter((path, index, values) => values.indexOf(path) === index)
    .filter((path) => existsSync(resolve(input.repoRoot, path)))
    .map((path) => ({
      contents: readFileSync(resolve(input.repoRoot, path), "utf8"),
      path
    }));
}

function collectPlannerAlignmentIssues(input: {
  actualFiles: readonly string[];
  plannedPaths: readonly string[];
}) {
  const actual = [...input.actualFiles].sort((left, right) =>
    left.localeCompare(right)
  );
  const planned = [...input.plannedPaths].sort((left, right) =>
    left.localeCompare(right)
  );
  const actualSet = new Set(actual);
  const plannedSet = new Set(planned);
  const issues: GeneratedResourceSmokeIssue[] = [];

  for (const path of planned) {
    if (!actualSet.has(path)) {
      issues.push({
        details: "Planned generated file was not written to the isolated output.",
        path,
        type: "planner-alignment"
      });
    }
  }

  for (const path of actual) {
    if (!plannedSet.has(path)) {
      issues.push({
        details: "Generated file was not present in the planned writable file set.",
        path,
        type: "planner-alignment"
      });
    }
  }

  return issues;
}

function collectDeterminismIssues(input: {
  generatedRoot: string;
  repeatRoot: string;
}) {
  const comparison = compareGeneratorFixtureDirectories({
    expectedRoot: input.generatedRoot,
    generatedRoot: input.repeatRoot
  });

  return comparison.drift.map((drift) => ({
    details: drift.details ?? "Repeated generation changed file structure or content.",
    path: drift.path,
    type: "golden-drift" as const
  }));
}

function collectValidatedGroups(files: readonly string[]) {
  return expectedGroupChecks
    .filter((check) => files.some((path) => check.predicate(path)))
    .map((check) => check.id);
}

function collectMissingGroupIssues(validatedGroups: readonly string[]) {
  const groupSet = new Set(validatedGroups);

  return expectedGroupChecks
    .filter((check) => !groupSet.has(check.id))
    .map((check) => ({
      details: "Expected generated file group is missing from the isolated output.",
      path: check.id,
      type: "missing-group" as const
    }));
}

function collectGeneratedFileContentIssues(input: {
  files: readonly string[];
  generatedRoot: string;
}) {
  const issues: GeneratedResourceSmokeIssue[] = [];

  for (const path of input.files) {
    const contents = readFileSync(resolve(input.generatedRoot, path), "utf8");

    for (const specifier of extractImportSpecifiers(contents)) {
      if (
        forbiddenImportMatchers.some((matcher) =>
          specifier.toLowerCase().includes(matcher.toLowerCase())
        )
      ) {
        issues.push({
          details: `Forbidden import '${specifier}'.`,
          path,
          type: "forbidden-import"
        });
      }
    }

    for (const placeholder of unresolvedPlaceholderMatchers) {
      if (!contents.includes(placeholder)) {
        continue;
      }

      issues.push({
        details: `Unresolved placeholder '${placeholder}' detected.`,
        path,
        type: "unresolved-placeholder"
      });
    }
  }

  return issues;
}

function collectSyntaxDiagnostics(input: {
  files: readonly string[];
  generatedRoot: string;
  issues: GeneratedResourceSmokeIssue[];
}) {
  const typeScriptFiles = input.files.filter((path) =>
    path.endsWith(".ts") || path.endsWith(".tsx")
  );

  for (const path of typeScriptFiles) {
    const diagnostics =
      ts.transpileModule(readFileSync(resolve(input.generatedRoot, path), "utf8"), {
        compilerOptions: {
          jsx: ts.JsxEmit.ReactJSX,
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022
        },
        fileName: path,
        reportDiagnostics: true
      }).diagnostics ?? [];

    for (const diagnostic of diagnostics) {
      if (diagnostic.category !== ts.DiagnosticCategory.Error) {
        continue;
      }

      input.issues.push({
        details: ts.flattenDiagnosticMessageText(
          diagnostic.messageText,
          "\n"
        ),
        path,
        type: "syntax"
      });
    }
  }

  return typeScriptFiles.length;
}

function collectRuntimeMutationIssues(input: {
  baselineFiles: readonly {
    contents: string;
    path: string;
  }[];
  repoRoot: string;
}) {
  const issues: GeneratedResourceSmokeIssue[] = [];

  for (const baseline of input.baselineFiles) {
    const currentContents = readFileSync(
      resolve(input.repoRoot, baseline.path),
      "utf8"
    );

    if (currentContents !== baseline.contents) {
      issues.push({
        details:
          "Real repo source changed while the smoke check was supposed to stay preview-only.",
        path: baseline.path,
        type: "runtime-mutation"
      });
    }
  }

  return issues;
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

function extractImportSpecifiers(source: string) {
  const matches = source.matchAll(
    /(?:import|export)\s+(?:type\s+)?(?:[^"'`]+?\s+from\s+)?["'`]([^"'`]+)["'`]|import\s+["'`]([^"'`]+)["'`]/g
  );

  return Array.from(matches, (match) => match[1] ?? match[2] ?? "").filter(
    (specifier) => specifier.length > 0
  );
}

export function relativeGeneratedResourceSmokePaths(input: {
  outputPaths: readonly string[];
  repoRoot: string;
}) {
  return input.outputPaths.map((path) =>
    relative(input.repoRoot, resolve(input.repoRoot, path)).replace(/\\/g, "/")
  );
}
