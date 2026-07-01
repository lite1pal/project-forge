import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, relative, resolve } from "node:path";

import type { FrameworkResourceSpec } from "../../packages/framework/src/index.js";
import { resolveSafeOutputPath } from "../extraction/output.js";
import {
  generatorGoldenFixtures,
  type GeneratorGoldenFixture
} from "./generator-golden.js";
import {
  type GeneratedResourceSmokeIssue,
  validateGeneratedResourceOutput
} from "./generated-resource-smoke.js";
import {
  generateResourceFromFile,
  type ResourceGeneratorFile,
  type ResourceGeneratorResult
} from "./resource-generator.js";
import { createResourceMigrationWrites } from "./resource-migration.js";
import {
  createResourcePlanFromFile,
  type ResourcePlanAdvisory,
  type ResourcePlanReport
} from "./resource-planner.js";

const applyStageRoot = "tmp/saas-apply-stage";
const allowedApplyTargetPrefixes = [".generated", "tmp"] as const;

export interface ResourceApplyChange {
  action: "create" | "manual-review" | "skip" | "update";
  details: string;
  kind: "central-file" | "generated-file" | "instruction";
  path: string;
}

export interface ResourceApplyResult {
  changes: readonly ResourceApplyChange[];
  generatedSmokeIssues: readonly GeneratedResourceSmokeIssue[];
  goldenFixtureId?: string;
  skippedPlanPaths: readonly string[];
  status: "pass" | "warn";
  targetPath: string;
  validatedGroups: readonly string[];
}

interface PreparedWrite {
  action: "create" | "skip" | "update";
  contents?: string;
  kind: "central-file" | "generated-file";
  path: string;
}

export function applyResourceFromFile(input: {
  afterStage?: (context: {
    repoRoot: string;
    stagePath: string;
  }) => void;
  force?: boolean;
  repoRoot: string;
  specPath: string;
  targetPath: string;
}): ResourceApplyResult {
  const repoRoot = resolve(input.repoRoot);
  const plan = createResourcePlanFromFile({
    repoRoot,
    specPath: input.specPath
  });
  const targetPath = resolveSafeApplyTargetPath({
    repoRoot,
    targetPath: input.targetPath
  });
  const stagePath = resolveSafeOutputPath({
    outputPath: `${applyStageRoot}/${toKebabCase(plan.resource.resource)}`,
    repoRoot
  });
  const goldenFixture = findGoldenFixtureForSpec({
    repoRoot,
    specPath: input.specPath
  });

  try {
    rmSync(resolve(repoRoot, stagePath), {
      force: true,
      recursive: true
    });

    const generated = generateResourceFromFile({
      force: true,
      outputPath: stagePath,
      repoRoot,
      specPath: input.specPath
    });

    input.afterStage?.({
      repoRoot,
      stagePath
    });

    const validation = validateGeneratedResourceOutput({
      expectedGoldenRoot: goldenFixture
        ? resolve(repoRoot, goldenFixture.fixturePath)
        : undefined,
      generatedRoot: resolve(repoRoot, stagePath),
      plannedPaths: generated.writtenFiles.map((file) => file.repoPath)
    });

    if (validation.issues.length > 0) {
      throw new Error(formatApplyValidationFailure(validation.issues));
    }

    const writes = createApplyWrites({
      force: input.force ?? false,
      generated,
      plan,
      repoRoot,
      targetPath
    });
    const blockingIssues = collectBlockingApplyIssues({
      force: input.force ?? false,
      repoRoot,
      targetPath,
      writes
    });

    if (blockingIssues.length > 0) {
      throw new Error(formatApplyBlockingFailure(blockingIssues));
    }

    for (const write of writes) {
      if (write.action === "skip" || !write.contents) {
        continue;
      }

      const absolutePath = resolve(repoRoot, targetPath, write.path);

      mkdirSync(dirname(absolutePath), {
        recursive: true
      });
      writeFileSync(absolutePath, write.contents);
    }

    const manualReview = createApplyManualReview({
      plan,
      repoRoot,
      targetPath
    });
    const changes = [
      ...writes.map<ResourceApplyChange>((write) => ({
        action: write.action,
        details:
          write.kind === "generated-file"
            ? "Generated resource file applied into the target tree."
            : "Deterministic central registration file applied into the target tree.",
        kind: write.kind,
        path: write.path
      })),
      ...manualReview.map<ResourceApplyChange>((item) => ({
        action: "manual-review",
        details: item.message,
        kind: "instruction",
        path: item.relatedPaths?.[0] ?? item.code
      }))
    ].sort((left, right) => left.path.localeCompare(right.path));

    return {
      changes,
      generatedSmokeIssues: validation.issues,
      goldenFixtureId: goldenFixture?.id,
      skippedPlanPaths: generated.skippedPlanPaths,
      status: manualReview.length > 0 ? "warn" : "pass",
      targetPath,
      validatedGroups: validation.validatedGroups
    };
  } finally {
    rmSync(resolve(repoRoot, stagePath), {
      force: true,
      recursive: true
    });
  }
}

export function formatAppliedResourceSummary(result: ResourceApplyResult) {
  const created = result.changes.filter((change) => change.action === "create");
  const updated = result.changes.filter((change) => change.action === "update");
  const skipped = result.changes.filter((change) => change.action === "skip");
  const manualReview = result.changes.filter(
    (change) => change.action === "manual-review"
  );

  const lines = [
    `Applied generated resource target: ${result.targetPath}`,
    "",
    `- status: ${result.status}`,
    `- created: ${created.length}`,
    `- updated: ${updated.length}`,
    `- skipped: ${skipped.length}`,
    `- manual review: ${manualReview.length}`,
    `- validated file groups: ${result.validatedGroups.join(", ") || "none"}`,
    `- skipped planner follow-up paths: ${result.skippedPlanPaths.length}`,
    `- golden fixture parity: ${result.goldenFixtureId ?? "not checked"}`
  ];

  if (created.length > 0) {
    lines.push("", "Created");

    for (const change of created) {
      lines.push(`- ${change.path}`);
    }
  }

  if (updated.length > 0) {
    lines.push("", "Updated");

    for (const change of updated) {
      lines.push(`- ${change.path}`);
    }
  }

  if (skipped.length > 0) {
    lines.push("", "Skipped");

    for (const change of skipped) {
      lines.push(`- ${change.path}`);
    }
  }

  if (manualReview.length > 0) {
    lines.push("", "Manual Review");

    for (const change of manualReview) {
      lines.push(`- ${change.path}: ${change.details}`);
    }
  }

  return lines.join("\n");
}

export function resolveSafeApplyTargetPath(input: {
  repoRoot: string;
  targetPath: string;
}) {
  const repoRoot = resolve(input.repoRoot);
  const requestedPath = input.targetPath.trim();

  if (requestedPath.length === 0) {
    throw new Error("Missing apply target path. Use --target <path>.");
  }

  const absoluteTargetPath = resolve(repoRoot, requestedPath);
  const relativeTargetPath = relative(repoRoot, absoluteTargetPath).replace(
    /\\/g,
    "/"
  );

  if (
    (relativeTargetPath.length > 0 && relativeTargetPath.startsWith("../")) ||
    absoluteTargetPath === resolve("/")
  ) {
    throw new Error(
      `Unsafe apply target path '${input.targetPath}'. Target must stay inside the repository.`
    );
  }

  if (relativeTargetPath === "") {
    return ".";
  }

  const [prefix] = relativeTargetPath.split("/");

  if (!allowedApplyTargetPrefixes.includes(prefix as (typeof allowedApplyTargetPrefixes)[number])) {
    throw new Error(
      `Unsafe apply target path '${input.targetPath}'. Target must be '.' or live under '.generated/' or 'tmp/'.`
    );
  }

  if (relativeTargetPath === prefix) {
    throw new Error(
      `Unsafe apply target path '${input.targetPath}'. Target must use a dedicated subdirectory under '${prefix}/'.`
    );
  }

  return relativeTargetPath;
}

function createApplyWrites(input: {
  force: boolean;
  generated: ResourceGeneratorResult;
  plan: ResourcePlanReport;
  repoRoot: string;
  targetPath: string;
}) {
  const writes: PreparedWrite[] = input.generated.writtenFiles.map((file) =>
    createGeneratedWrite({
      file,
      repoRoot: input.repoRoot,
      stagePath: input.generated.outputPath,
      targetPath: input.targetPath
    })
  );

  writes.push(
    createDomainPackageJsonWrite({
      force: input.force,
      repoRoot: input.repoRoot,
      resource: input.plan.resource,
      targetPath: input.targetPath
    }),
    createExportBarrelWrite({
      exportLine: `export * from "./generated/${toKebabCase(
        input.plan.resource.resource
      )}/index.js";`,
      path: "packages/domain/src/index.ts",
      repoRoot: input.repoRoot,
      targetPath: input.targetPath
    }),
    createExportBarrelWrite({
      exportLine: `export * from "./${toKebabCase(input.plan.resource.resource)}.js";`,
      path: "packages/db/src/schema/index.ts",
      repoRoot: input.repoRoot,
      targetPath: input.targetPath
    })
  );
  writes.push(
    ...createResourceMigrationWrites({
      repoRoot: input.repoRoot,
      resource: input.plan.resource,
      targetPath: input.targetPath
    })
  );

  if (input.targetPath === ".") {
    writes.push(
      createApiAppRegistrationWrite({
        repoRoot: input.repoRoot,
        resource: input.plan.resource,
        targetPath: input.targetPath
      })
    );
  }

  return writes;
}

function createGeneratedWrite(input: {
  file: ResourceGeneratorFile;
  repoRoot: string;
  stagePath: string;
  targetPath: string;
}): PreparedWrite {
  const targetAbsolutePath = resolve(
    input.repoRoot,
    input.targetPath,
    input.file.repoPath
  );
  const currentContents = existsSync(targetAbsolutePath)
    ? readFileSync(targetAbsolutePath, "utf8")
    : undefined;
  const stagedContents = readFileSync(
    resolve(input.repoRoot, input.stagePath, input.file.repoPath),
    "utf8"
  );

  if (currentContents === undefined) {
    return {
      action: "create",
      contents: stagedContents,
      kind: "generated-file",
      path: input.file.repoPath
    };
  }

  if (currentContents === stagedContents) {
    return {
      action: "skip",
      kind: "generated-file",
      path: input.file.repoPath
    };
  }

  return {
    action: "update",
    contents: stagedContents,
    kind: "generated-file",
    path: input.file.repoPath
  };
}

function createDomainPackageJsonWrite(input: {
  force: boolean;
  repoRoot: string;
  resource: FrameworkResourceSpec;
  targetPath: string;
}): PreparedWrite {
  const path = "packages/domain/package.json";
  const absolutePath = resolve(input.repoRoot, input.targetPath, path);
  const generatedSubpath = `./generated/${toKebabCase(input.resource.resource)}`;

  if (!existsSync(absolutePath)) {
    return {
      action: "create",
      contents: `${JSON.stringify(
        {
          exports: {
            ".": {
              import: "./src/index.ts",
              types: "./src/index.ts"
            },
            [generatedSubpath]: {
              import: `./src/generated/${toKebabCase(input.resource.resource)}/index.ts`,
              types: `./src/generated/${toKebabCase(input.resource.resource)}/index.ts`
            }
          },
          name: "@auditrail/domain",
          private: true,
          type: "module",
          version: "0.1.0"
        },
        null,
        2
      )}\n`,
      kind: "central-file",
      path
    };
  }

  let packageJson: {
    exports?: Record<string, unknown>;
    name?: string;
    private?: boolean;
    type?: string;
    version?: string;
  };

  try {
    packageJson = JSON.parse(readFileSync(absolutePath, "utf8")) as typeof packageJson;
  } catch (error) {
    throw new Error(
      `Unsupported central file patch for '${path}'. Existing package JSON is invalid: ${
        error instanceof Error ? error.message : "unknown parse error"
      }.`
    );
  }

  if (
    packageJson.exports &&
    typeof packageJson.exports !== "object"
  ) {
    throw new Error(
      `Unsupported central file patch for '${path}'. The exports field is not an object.`
    );
  }

  const exportsField = {
    ...(packageJson.exports ?? {})
  } as Record<string, unknown>;
  const existing = exportsField[generatedSubpath];
  const expected = {
    import: `./src/generated/${toKebabCase(input.resource.resource)}/index.ts`,
    types: `./src/generated/${toKebabCase(input.resource.resource)}/index.ts`
  };

  if (
    existing &&
    JSON.stringify(existing) !== JSON.stringify(expected)
  ) {
    throw new Error(
      `Unsupported existing generated resource state in '${path}'. Export '${generatedSubpath}' already exists with different contents.`
    );
  }

  exportsField[generatedSubpath] = expected;

  const nextContents = `${JSON.stringify(
    {
      ...packageJson,
      exports: exportsField,
      name: packageJson.name ?? "@auditrail/domain",
      private: packageJson.private ?? true,
      type: packageJson.type ?? "module",
      version: packageJson.version ?? "0.1.0"
    },
    null,
    2
  )}\n`;
  const currentContents = readFileSync(absolutePath, "utf8");

  if (currentContents === nextContents) {
    return {
      action: "skip",
      kind: "central-file",
      path
    };
  }

  return {
    action: "update",
    contents: nextContents,
    kind: "central-file",
    path
  };
}

function createExportBarrelWrite(input: {
  exportLine: string;
  path: string;
  repoRoot: string;
  targetPath: string;
}): PreparedWrite {
  const absolutePath = resolve(input.repoRoot, input.targetPath, input.path);

  if (!existsSync(absolutePath)) {
    return {
      action: "create",
      contents: `${input.exportLine}\n`,
      kind: "central-file",
      path: input.path
    };
  }

  const currentContents = readFileSync(absolutePath, "utf8");

  if (currentContents.includes(input.exportLine)) {
    return {
      action: "skip",
      kind: "central-file",
      path: input.path
    };
  }

  return {
    action: "update",
    contents: ensureTrailingNewline(currentContents) + `${input.exportLine}\n`,
    kind: "central-file",
    path: input.path
  };
}

function createApiAppRegistrationWrite(input: {
  repoRoot: string;
  resource: FrameworkResourceSpec;
  targetPath: string;
}): PreparedWrite {
  const path = "apps/api/src/app.ts";
  const absolutePath = resolve(input.repoRoot, input.targetPath, path);

  if (!existsSync(absolutePath)) {
    throw new Error(
      `Unsupported central file patch for '${path}'. The root install target requires an existing API app bootstrap file.`
    );
  }

  const resourcePath = toKebabCase(input.resource.resource);
  const pascalName = toPascalCase(input.resource.resource);
  const importAnchor =
    'import { registerApiKeyRoutes } from "./modules/api-keys/routes.js";';
  const importLines = [
    `import { createPostgres${pascalName}Repo } from "./modules/generated/${resourcePath}/postgres-repo.js";`,
    `import { register${pascalName}Routes } from "./modules/generated/${resourcePath}/routes.js";`,
    `import { create${pascalName}Service } from "./modules/generated/${resourcePath}/service.js";`
  ];
  const registrationAnchor = [
    "      infrastructureApp.register(registerApiKeyRoutes, {",
    "        prefix: API_VERSION_PREFIX,",
    "        service: apiKeyService,",
    "      });"
  ].join("\n");
  const registrationBlock = [
    `      infrastructureApp.register(register${pascalName}Routes, {`,
    "        access: workspaceAccessService,",
    "        prefix: API_BASE_PATH,",
    `        service: create${pascalName}Service(`,
    `          createPostgres${pascalName}Repo(infrastructureApp.db)`,
    "        )",
    "      });"
  ].join("\n");
  const currentContents = readFileSync(absolutePath, "utf8");
  let nextContents = currentContents;

  for (const importLine of importLines) {
    nextContents = insertAfterAnchor({
      anchor: importAnchor,
      contents: nextContents,
      insertion: importLine
    });
  }

  nextContents = insertAfterAnchor({
    anchor: registrationAnchor,
    contents: nextContents,
    insertion: registrationBlock
  });

  if (currentContents === nextContents) {
    return {
      action: "skip",
      kind: "central-file",
      path
    };
  }

  return {
    action: "update",
    contents: nextContents,
    kind: "central-file",
    path
  };
}

function collectBlockingApplyIssues(input: {
  force: boolean;
  repoRoot: string;
  targetPath: string;
  writes: readonly PreparedWrite[];
}) {
  const issues: string[] = [];

  for (const write of input.writes) {
    const absolutePath = resolve(input.repoRoot, input.targetPath, write.path);

    if (!existsSync(absolutePath)) {
      continue;
    }

    if (!input.force && write.kind === "generated-file") {
      issues.push(
        `Existing target file requires --force before apply can continue: ${write.path}`
      );
    }
  }

  return issues.sort((left, right) => left.localeCompare(right));
}

function createApplyManualReview(input: {
  plan: ResourcePlanReport;
  repoRoot: string;
  targetPath: string;
}) {
  const items: ResourcePlanAdvisory[] = input.plan.manualReview.filter(
    (item) => item.code !== "migration-placeholder"
  );
  const apiAppPath = "apps/api/src/app.ts";
  const apiAppAbsolutePath = resolve(
    input.repoRoot,
    input.targetPath,
    apiAppPath
  );

  if (input.targetPath !== "." && !existsSync(apiAppAbsolutePath)) {
    items.push({
      code: "api-registration-manual-review",
      message: [
        "Add API route registration manually if you want the isolated target tree to run end-to-end.",
        `Wire register${toPascalCase(input.plan.resource.resource)}Routes, create${toPascalCase(
          input.plan.resource.resource
        )}Service, and createPostgres${toPascalCase(
          input.plan.resource.resource
        )}Repo from apps/api/src/modules/generated/${toKebabCase(
          input.plan.resource.resource
        )}/*.`
      ].join(" "),
      relatedPaths: [apiAppPath]
    });
  }

  return items.sort((left, right) => left.code.localeCompare(right.code));
}

function findGoldenFixtureForSpec(input: {
  repoRoot: string;
  specPath: string;
}) {
  const requested = toRepoRelativePath({
    absolutePath: resolve(input.repoRoot, input.specPath),
    repoRoot: input.repoRoot
  });

  return generatorGoldenFixtures.find(
    (fixture) => fixture.specPath === requested
  );
}

function formatApplyValidationFailure(
  issues: readonly GeneratedResourceSmokeIssue[]
) {
  return [
    "Generated resource apply failed validation before writing target files.",
    ...issues.map((issue) => `- ${issue.type}: ${issue.path ?? issue.details ?? "unknown issue"}`)
  ].join("\n");
}

function formatApplyBlockingFailure(issues: readonly string[]) {
  return [
    "Generated resource apply refused to write because the target tree is not safe to patch.",
    ...issues.map((issue) => `- ${issue}`)
  ].join("\n");
}

function ensureTrailingNewline(value: string) {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function insertAfterAnchor(input: {
  anchor: string;
  contents: string;
  insertion: string;
}) {
  if (input.contents.includes(input.insertion)) {
    return input.contents;
  }

  const anchorIndex = input.contents.indexOf(input.anchor);

  if (anchorIndex === -1) {
    throw new Error(
      `Unsupported central file patch. Could not find expected anchor '${input.anchor}'.`
    );
  }

  const anchorEnd = anchorIndex + input.anchor.length;

  return [
    input.contents.slice(0, anchorEnd),
    "\n",
    input.insertion,
    input.contents.slice(anchorEnd)
  ].join("");
}

function toRepoRelativePath(input: {
  absolutePath: string;
  repoRoot: string;
}) {
  return input.absolutePath
    .replace(`${resolve(input.repoRoot)}/`, "")
    .replace(/\\/g, "/");
}

function toKebabCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

function toPascalCase(value: string) {
  return toKebabCase(value)
    .split("-")
    .filter((segment) => segment.length > 0)
    .map((segment) => segment[0]!.toUpperCase() + segment.slice(1))
    .join("");
}
