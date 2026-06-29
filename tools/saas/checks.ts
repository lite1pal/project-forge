import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { FrameworkCheckDefinition } from "../../packages/framework/src/index.js";

export type DoctorCheckStatus = "fail" | "pass" | "warn";

export interface DoctorCheckResult {
  appliesToPaths: readonly string[];
  command: string;
  fix?: string;
  id: string;
  name: string;
  reason: string;
  required: boolean;
  status: DoctorCheckStatus;
}

export interface DoctorReport {
  exitCode: number;
  repoRoot: string;
  results: readonly DoctorCheckResult[];
  summary: {
    fail: number;
    pass: number;
    warn: number;
  };
}

interface DoctorCheckDefinition extends FrameworkCheckDefinition {
  evaluate: (context: DoctorContext) => DoctorCheckResult;
  name: string;
}

interface PackageJsonFile {
  exports?: Record<string, unknown>;
  name?: string;
  scripts?: Record<string, string>;
}

interface DoctorContext {
  domainIndexSource?: string;
  domainPackageJson?: PackageJsonFile;
  extractionManifestSource?: string;
  frameworkPackageJson?: PackageJsonFile;
  gitignoreSource?: string;
  packageJson?: PackageJsonFile;
  repoRoot: string;
}

const requiredQualityGateScripts = [
  "check:boundaries",
  "check:extraction",
  "check:extraction-manifest",
  "check:extraction:placeholder",
  "typecheck",
  "test",
  "verify"
] as const;

const doctorChecks: readonly DoctorCheckDefinition[] = [
  {
    id: "boundary-rules-file",
    name: "Architecture boundary rules file",
    appliesToPaths: ["tools/architecture-boundaries/rules.ts"],
    command: "pnpm check:boundaries",
    required: true,
    evaluate(context) {
      return createExistsCheckResult({
        context,
        command: "pnpm check:boundaries",
        id: "boundary-rules-file",
        name: "Architecture boundary rules file",
        path: "tools/architecture-boundaries/rules.ts",
        required: true,
        fix: "Restore `tools/architecture-boundaries/rules.ts` and keep it wired to the canonical boundary package."
      });
    }
  },
  {
    id: "boundary-scanner-command",
    name: "Boundary scanner command",
    appliesToPaths: ["package.json", "tools/check-architecture-boundaries.ts"],
    command: "pnpm check:boundaries",
    required: true,
    evaluate(context) {
      return createScriptTargetCheckResult({
        context,
        command: "pnpm check:boundaries",
        expectedFile: "tools/check-architecture-boundaries.ts",
        expectedScriptName: "check:boundaries",
        id: "boundary-scanner-command",
        name: "Boundary scanner command",
        required: true,
        fix: "Add the root `check:boundaries` script and point it at `tools/check-architecture-boundaries.ts`."
      });
    }
  },
  {
    id: "extraction-manifest-file",
    name: "Extraction manifest file",
    appliesToPaths: ["tools/extraction/manifest.ts"],
    command: "pnpm check:extraction-manifest",
    required: true,
    evaluate(context) {
      return createExistsCheckResult({
        context,
        command: "pnpm check:extraction-manifest",
        id: "extraction-manifest-file",
        name: "Extraction manifest file",
        path: "tools/extraction/manifest.ts",
        required: true,
        fix: "Restore `tools/extraction/manifest.ts` so extraction ownership stays machine-readable."
      });
    }
  },
  {
    id: "extraction-dry-run-command",
    name: "Extraction dry-run command",
    appliesToPaths: [
      "package.json",
      "tools/extraction/dry-run.ts",
      "tools/check-extraction-manifest.ts"
    ],
    command: "pnpm check:extraction",
    required: true,
    evaluate(context) {
      const script = getScript(context, "check:extraction");
      const hasScript =
        typeof script === "string" &&
        script.includes("tools/extraction/dry-run.ts") &&
        script.includes("check:extraction-manifest");
      const hasDryRunFile = fileExists(context, "tools/extraction/dry-run.ts");
      const hasManifestChecker = fileExists(
        context,
        "tools/check-extraction-manifest.ts"
      );

      return {
        appliesToPaths: [
          "package.json",
          "tools/extraction/dry-run.ts",
          "tools/check-extraction-manifest.ts"
        ],
        command: "pnpm check:extraction",
        id: "extraction-dry-run-command",
        name: "Extraction dry-run command",
        required: true,
        status:
          hasScript && hasDryRunFile && hasManifestChecker ? "pass" : "fail",
        reason:
          hasScript && hasDryRunFile && hasManifestChecker
            ? "Root `check:extraction` is available and still chains manifest validation into the dry-run planner."
            : "The extraction dry-run command is missing its root script or one of the expected tooling entrypoints.",
        fix: hasScript && hasDryRunFile && hasManifestChecker
          ? undefined
          : "Restore the root `check:extraction` script and keep it pointing at both `check:extraction-manifest` and `tools/extraction/dry-run.ts`."
      };
    }
  },
  {
    id: "extraction-output-command",
    name: "Extraction output command",
    appliesToPaths: ["package.json", "tools/extraction/extract.ts"],
    command: "pnpm extract:boilerplate",
    required: true,
    evaluate(context) {
      return createScriptTargetCheckResult({
        context,
        command: "pnpm extract:boilerplate",
        expectedFile: "tools/extraction/extract.ts",
        expectedScriptName: "extract:boilerplate",
        id: "extraction-output-command",
        name: "Extraction output command",
        required: true,
        fix: "Restore the root `extract:boilerplate` script and keep it pointing at `tools/extraction/extract.ts`."
      });
    }
  },
  {
    id: "placeholder-validation-command",
    name: "Placeholder product validation command",
    appliesToPaths: [
      "package.json",
      "tools/extraction/validate-placeholder-product.ts"
    ],
    command: "pnpm check:extraction:placeholder",
    required: true,
    evaluate(context) {
      return createScriptTargetCheckResult({
        context,
        command: "pnpm check:extraction:placeholder",
        expectedFile: "tools/extraction/validate-placeholder-product.ts",
        expectedScriptName: "check:extraction:placeholder",
        id: "placeholder-validation-command",
        name: "Placeholder product validation command",
        required: true,
        fix: "Restore the root `check:extraction:placeholder` script and keep it pointing at `tools/extraction/validate-placeholder-product.ts`."
      });
    }
  },
  {
    id: "generated-resource-smoke-command",
    name: "Generated resource smoke-check command",
    appliesToPaths: ["package.json", "tools/saas/cli.ts", "tools/saas/generated-resource-smoke.ts"],
    command: "pnpm saas check generated-resource",
    required: true,
    evaluate(context) {
      const script = getScript(context, "saas");
      const hasScript =
        typeof script === "string" && script.includes("tools/saas/cli.ts");
      const hasCli = fileExists(context, "tools/saas/cli.ts");
      const hasRunner = fileExists(
        context,
        "tools/saas/generated-resource-smoke.ts"
      );

      return {
        appliesToPaths: [
          "package.json",
          "tools/saas/cli.ts",
          "tools/saas/generated-resource-smoke.ts"
        ],
        command: "pnpm saas check generated-resource",
        id: "generated-resource-smoke-command",
        name: "Generated resource smoke-check command",
        required: true,
        status: hasScript && hasCli && hasRunner ? "pass" : "fail",
        reason:
          hasScript && hasCli && hasRunner
            ? "The SaaS CLI exposes the generated-resource smoke check entrypoint and its runner module exists."
            : "The generated-resource smoke check command is missing its root CLI entrypoint or runner module.",
        fix:
          hasScript && hasCli && hasRunner
            ? undefined
            : "Restore the root `saas` CLI script plus `tools/saas/cli.ts` and `tools/saas/generated-resource-smoke.ts` so `pnpm saas check generated-resource` stays available."
      };
    }
  },
  {
    id: "generated-resource-apply-command",
    name: "Generated resource apply command",
    appliesToPaths: ["package.json", "tools/saas/cli.ts", "tools/saas/resource-apply.ts"],
    command: "pnpm saas apply resource <resource-spec.json> --target <target-dir>",
    required: true,
    evaluate(context) {
      const script = getScript(context, "saas");
      const hasScript =
        typeof script === "string" && script.includes("tools/saas/cli.ts");
      const hasCli = fileExists(context, "tools/saas/cli.ts");
      const hasRunner = fileExists(context, "tools/saas/resource-apply.ts");

      return {
        appliesToPaths: [
          "package.json",
          "tools/saas/cli.ts",
          "tools/saas/resource-apply.ts"
        ],
        command: "pnpm saas apply resource <resource-spec.json> --target <target-dir>",
        id: "generated-resource-apply-command",
        name: "Generated resource apply command",
        required: true,
        status: hasScript && hasCli && hasRunner ? "pass" : "fail",
        reason:
          hasScript && hasCli && hasRunner
            ? "The SaaS CLI exposes the generated-resource apply entrypoint and its runner module exists."
            : "The generated-resource apply command is missing its root CLI entrypoint or runner module.",
        fix:
          hasScript && hasCli && hasRunner
            ? undefined
            : "Restore the root `saas` CLI script plus `tools/saas/cli.ts` and `tools/saas/resource-apply.ts` so `pnpm saas apply resource ... --target ...` stays available."
      };
    }
  },
  {
    id: "framework-contract-package",
    name: "Framework contract package",
    appliesToPaths: [
      "packages/framework/package.json",
      "packages/framework/src/index.ts"
    ],
    command: "pnpm --filter @auditrail/framework typecheck",
    required: true,
    evaluate(context) {
      const packageJson = context.frameworkPackageJson;
      const exportTarget = asExportTarget(packageJson?.exports?.["."]);
      const hasName = packageJson?.name === "@auditrail/framework";
      const hasExport =
        typeof exportTarget?.types === "string" &&
        typeof exportTarget?.import === "string";
      const hasFiles =
        fileExists(context, "packages/framework/package.json") &&
        fileExists(context, "packages/framework/src/index.ts");

      return {
        appliesToPaths: [
          "packages/framework/package.json",
          "packages/framework/src/index.ts"
        ],
        command: "pnpm --filter @auditrail/framework typecheck",
        id: "framework-contract-package",
        name: "Framework contract package",
        required: true,
        status: hasName && hasExport && hasFiles ? "pass" : "fail",
        reason:
          hasName && hasExport && hasFiles
            ? "The framework contract package exists with the expected package name and root export entrypoint."
            : "The framework contract package is missing, misnamed, or no longer exports its root contract module.",
        fix:
          hasName && hasExport && hasFiles
            ? undefined
            : "Restore `packages/framework` with the `@auditrail/framework` package metadata and root `src/index.ts` export."
      };
    }
  },
  {
    id: "product-definition-framework",
    name: "Generic product definition framework",
    appliesToPaths: [
      "packages/domain/package.json",
      "packages/domain/src/product/index.ts",
      "packages/domain/src/product/product-definition.ts"
    ],
    command: "pnpm --filter @auditrail/domain test",
    required: true,
    evaluate(context) {
      const exportTarget = asExportTarget(
        context.domainPackageJson?.exports?.["./product"]
      );
      const hasExport =
        typeof exportTarget?.types === "string" &&
        typeof exportTarget?.import === "string";
      const hasFiles =
        fileExists(context, "packages/domain/src/product/index.ts") &&
        fileExists(context, "packages/domain/src/product/product-definition.ts");

      return {
        appliesToPaths: [
          "packages/domain/package.json",
          "packages/domain/src/product/index.ts",
          "packages/domain/src/product/product-definition.ts"
        ],
        command: "pnpm --filter @auditrail/domain test",
        id: "product-definition-framework",
        name: "Generic product definition framework",
        required: true,
        status: hasExport && hasFiles ? "pass" : "fail",
        reason:
          hasExport && hasFiles
            ? "The generic product-definition seam is present and exported from `@auditrail/domain/product`."
            : "The generic product-definition seam is missing or no longer exported through `@auditrail/domain/product`.",
        fix:
          hasExport && hasFiles
            ? undefined
            : "Restore the `./product` export in `packages/domain/package.json` and the product definition source files."
      };
    }
  },
  {
    id: "audit-product-config-classification",
    name: "Audit product config classification",
    appliesToPaths: [
      "packages/domain/src/audit-events/product.ts",
      "tools/extraction/manifest.ts"
    ],
    command: "pnpm check:extraction-manifest",
    required: true,
    evaluate(context) {
      const manifestSource = context.extractionManifestSource ?? "";
      const hasProductConfig = fileExists(
        context,
        "packages/domain/src/audit-events/product.ts"
      );
      const hasAuditProductEntry = hasManifestPathEntry(
        manifestSource,
        "packages/domain/src/audit-events/**"
      );
      const hasTemplateEntry = hasManifestPathEntry(
        manifestSource,
        "packages/domain/src/audit-events/product.ts"
      );

      return {
        appliesToPaths: [
          "packages/domain/src/audit-events/product.ts",
          "tools/extraction/manifest.ts"
        ],
        command: "pnpm check:extraction-manifest",
        id: "audit-product-config-classification",
        name: "Audit product config classification",
        required: true,
        status:
          hasProductConfig && hasAuditProductEntry && hasTemplateEntry
            ? "pass"
            : "fail",
        reason:
          hasProductConfig && hasAuditProductEntry && hasTemplateEntry
            ? "The concrete AuditTrail product config exists and the extraction manifest still treats audit-event product paths as product-owned or templated."
            : "The AuditTrail product config is missing or the extraction manifest no longer classifies it as product-specific or templated.",
        fix:
          hasProductConfig && hasAuditProductEntry && hasTemplateEntry
            ? undefined
            : "Restore `packages/domain/src/audit-events/product.ts` and keep the extraction manifest entries for `packages/domain/src/audit-events/**` plus the `product.ts` template seam."
      };
    }
  },
  {
    id: "generated-output-ignored",
    name: "Generated extraction output is git-ignored",
    appliesToPaths: [".gitignore"],
    command: "pnpm check:extraction:placeholder",
    required: true,
    evaluate(context) {
      const gitignoreLines = splitLines(context.gitignoreSource);
      const isIgnored = gitignoreLines.includes(".generated/");

      return {
        appliesToPaths: [".gitignore"],
        command: "pnpm check:extraction:placeholder",
        id: "generated-output-ignored",
        name: "Generated extraction output is git-ignored",
        required: true,
        status: isIgnored ? "pass" : "fail",
        reason: isIgnored
          ? "`.generated/` is ignored, so local extraction output stays out of the tracked repo."
          : "`.generated/` is not ignored, so local extraction output could leak into tracked changes.",
        fix: isIgnored
          ? undefined
          : "Add `.generated/` to the repository `.gitignore` so local extraction output remains untracked."
      };
    }
  },
  {
    id: "required-quality-gate-scripts",
    name: "Required quality-gate scripts",
    appliesToPaths: ["package.json"],
    command: "pnpm verify",
    required: true,
    evaluate(context) {
      const missingScripts = requiredQualityGateScripts.filter(
        (scriptName) => typeof getScript(context, scriptName) !== "string"
      );

      return {
        appliesToPaths: ["package.json"],
        command: "pnpm verify",
        id: "required-quality-gate-scripts",
        name: "Required quality-gate scripts",
        required: true,
        status: missingScripts.length === 0 ? "pass" : "fail",
        reason:
          missingScripts.length === 0
            ? "Root quality-gate scripts exist for boundaries, extraction metadata, placeholder validation, typechecking, tests, and full verification."
            : `Root package scripts are missing: ${missingScripts.join(", ")}.`,
        fix:
          missingScripts.length === 0
            ? undefined
            : `Restore the missing root quality-gate scripts in \`package.json\`: ${missingScripts.join(", ")}.`
      };
    }
  },
  {
    id: "domain-root-barrel-product-neutral",
    name: "Domain root barrel stays product-neutral",
    appliesToPaths: ["packages/domain/src/index.ts"],
    command: "pnpm check:boundaries",
    required: true,
    evaluate(context) {
      const source = context.domainIndexSource ?? "";
      const hasBypass = source.includes("audit-events");

      return {
        appliesToPaths: ["packages/domain/src/index.ts"],
        command: "pnpm check:boundaries",
        id: "domain-root-barrel-product-neutral",
        name: "Domain root barrel stays product-neutral",
        required: true,
        status: hasBypass ? "fail" : "pass",
        reason: hasBypass
          ? "The root `@auditrail/domain` barrel appears to re-export audit-product code."
          : "The root `@auditrail/domain` barrel stays free of audit-product re-exports.",
        fix: hasBypass
          ? "Remove audit-product re-exports from `packages/domain/src/index.ts` and keep audit-owned modules behind the `@auditrail/domain/audit-events` subpath."
          : undefined
      };
    }
  },
  {
    id: "saas-tooling-classified-for-extraction",
    name: "SaaS tooling is classified for extraction",
    appliesToPaths: ["tools/saas/**", "tools/extraction/manifest.ts"],
    command: "pnpm check:extraction-manifest",
    required: true,
    evaluate(context) {
      const manifestSource = context.extractionManifestSource ?? "";
      const hasEntry = hasManifestPathEntry(manifestSource, "tools/saas/**");

      return {
        appliesToPaths: ["tools/saas/**", "tools/extraction/manifest.ts"],
        command: "pnpm check:extraction-manifest",
        id: "saas-tooling-classified-for-extraction",
        name: "SaaS tooling is classified for extraction",
        required: true,
        status: hasEntry ? "pass" : "fail",
        reason: hasEntry
          ? "The extraction manifest classifies `tools/saas/**`, so the doctor command is not an unknown tooling path."
          : "The extraction manifest does not classify `tools/saas/**` yet.",
        fix: hasEntry
          ? undefined
          : "Add a `tools/saas/**` entry to `tools/extraction/manifest.ts` so the framework CLI is classified explicitly."
      };
    }
  },
  {
    id: "saas-doctor-shortcut",
    name: "Convenience `saas:doctor` script",
    appliesToPaths: ["package.json"],
    command: "pnpm saas:doctor",
    required: false,
    evaluate(context) {
      const script = getScript(context, "saas:doctor");
      const hasShortcut =
        typeof script === "string" &&
        script.includes("tools/saas/cli.ts") &&
        script.includes("doctor");

      return {
        appliesToPaths: ["package.json"],
        command: "pnpm saas:doctor",
        id: "saas-doctor-shortcut",
        name: "Convenience `saas:doctor` script",
        required: false,
        status: hasShortcut ? "pass" : "warn",
        reason: hasShortcut
          ? "A direct `pnpm saas:doctor` shortcut exists alongside the primary `pnpm saas doctor` entrypoint."
          : "The direct `pnpm saas:doctor` shortcut is missing, although the primary `pnpm saas doctor` entrypoint can still be used.",
        fix: hasShortcut
          ? undefined
          : "Add a `saas:doctor` alias in the root `package.json` if you want a single-command shortcut."
      };
    }
  }
] as const;

export function createDoctorReport(input: {
  repoRoot: string;
}): DoctorReport {
  const context = createDoctorContext(input);
  const results = doctorChecks.map((check) => check.evaluate(context));
  const summary = summarizeResults(results);

  return {
    exitCode: summary.fail > 0 ? 1 : 0,
    repoRoot: resolve(input.repoRoot),
    results,
    summary
  };
}

export function formatDoctorReport(report: DoctorReport) {
  const lines = ["SaaS Doctor", ""];

  for (const result of report.results) {
    lines.push(`${formatStatus(result.status)} ${result.name}`);
    lines.push(`- check: ${result.id}`);
    lines.push(`- status: ${result.status}`);
    lines.push(`- required: ${result.required ? "yes" : "no"}`);
    lines.push(`- reason: ${result.reason}`);
    lines.push(`- command: ${result.command}`);

    if (result.fix) {
      lines.push(`- fix: ${result.fix}`);
    }

    lines.push("");
  }

  lines.push("Summary");
  lines.push(`- pass: ${report.summary.pass}`);
  lines.push(`- warn: ${report.summary.warn}`);
  lines.push(`- fail: ${report.summary.fail}`);
  lines.push(`- exit code: ${report.exitCode}`);

  return lines.join("\n");
}

function createDoctorContext(input: {
  repoRoot: string;
}): DoctorContext {
  const repoRoot = resolve(input.repoRoot);

  return {
    domainIndexSource: readTextIfExists(repoRoot, "packages/domain/src/index.ts"),
    domainPackageJson: readJsonIfExists(repoRoot, "packages/domain/package.json"),
    extractionManifestSource: readTextIfExists(
      repoRoot,
      "tools/extraction/manifest.ts"
    ),
    frameworkPackageJson: readJsonIfExists(
      repoRoot,
      "packages/framework/package.json"
    ),
    gitignoreSource: readTextIfExists(repoRoot, ".gitignore"),
    packageJson: readJsonIfExists(repoRoot, "package.json"),
    repoRoot
  };
}

function createExistsCheckResult(input: {
  command: string;
  context: DoctorContext;
  fix: string;
  id: string;
  name: string;
  path: string;
  required: boolean;
}): DoctorCheckResult {
  const exists = fileExists(input.context, input.path);

  return {
    appliesToPaths: [input.path],
    command: input.command,
    id: input.id,
    name: input.name,
    required: input.required,
    status: exists ? "pass" : "fail",
    reason: exists
      ? `Found \`${input.path}\`.`
      : `Missing required file \`${input.path}\`.`,
    fix: exists ? undefined : input.fix
  };
}

function createScriptTargetCheckResult(input: {
  command: string;
  context: DoctorContext;
  expectedFile: string;
  expectedScriptName: string;
  fix: string;
  id: string;
  name: string;
  required: boolean;
}): DoctorCheckResult {
  const script = getScript(input.context, input.expectedScriptName);
  const filePresent = fileExists(input.context, input.expectedFile);
  const isHealthy =
    typeof script === "string" &&
    script.includes(input.expectedFile) &&
    filePresent;

  return {
    appliesToPaths: ["package.json", input.expectedFile],
    command: input.command,
    id: input.id,
    name: input.name,
    required: input.required,
    status: isHealthy ? "pass" : "fail",
    reason: isHealthy
      ? `Root script \`${input.expectedScriptName}\` points at \`${input.expectedFile}\`.`
      : `Root script \`${input.expectedScriptName}\` is missing or no longer points at \`${input.expectedFile}\`.`,
    fix: isHealthy ? undefined : input.fix
  };
}

function fileExists(context: DoctorContext, relativePath: string) {
  return existsSync(resolve(context.repoRoot, relativePath));
}

function readTextIfExists(repoRoot: string, relativePath: string) {
  const absolutePath = resolve(repoRoot, relativePath);

  if (!existsSync(absolutePath)) {
    return undefined;
  }

  return readFileSync(absolutePath, "utf8");
}

function readJsonIfExists(
  repoRoot: string,
  relativePath: string
): PackageJsonFile | undefined {
  const source = readTextIfExists(repoRoot, relativePath);

  if (!source) {
    return undefined;
  }

  return JSON.parse(source) as PackageJsonFile;
}

function getScript(context: DoctorContext, scriptName: string) {
  return context.packageJson?.scripts?.[scriptName];
}

function asExportTarget(value: unknown) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  return value as {
    import?: string;
    types?: string;
  };
}

function hasManifestPathEntry(source: string, path: string) {
  return source.includes(`path: "${path}"`);
}

function splitLines(source?: string) {
  if (!source) {
    return [];
  }

  return source
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function summarizeResults(results: readonly DoctorCheckResult[]) {
  return results.reduce(
    (summary, result) => {
      summary[result.status] += 1;
      return summary;
    },
    {
      fail: 0,
      pass: 0,
      warn: 0
    }
  );
}

function formatStatus(status: DoctorCheckStatus) {
  return `[${status.toUpperCase()}]`;
}
