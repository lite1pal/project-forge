import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type {
  FrameworkAgentContextDefinition,
  FrameworkAgentTaskDefinition,
  FrameworkResourceSpec
} from "../../packages/framework/src/index.js";
import { resolveSafeOutputPath } from "../extraction/output.js";
import {
  createResourceAgentContextBundle,
  type ResourceAgentContextBundle
} from "./agent-context.js";
import { createResourcePlanFromFile, type ResourcePlanAdvisory } from "./resource-planner.js";
import { createDefaultPreviewOutputPath } from "./resource-generator.js";

const recipeTemplatePath = "tools/saas/recipes/generated-resource-install.md";
const forbiddenPathOrder = [
  "apps/api/src/modules/audit-events/**",
  "apps/web/src/features/audit-events/**",
  "packages/domain/src/audit-events/**",
  "apps/api/src/modules/platform/billing/**",
  "apps/api/src/modules/platform/entitlements/**",
  "apps/api/src/modules/platform/support/**",
  "apps/api/src/modules/jobs/**",
  "apps/web/src/features/organizations/**",
  "packages/domain/src/billing/**",
  "packages/domain/src/entitlements/**",
  "packages/domain/src/internal-support/**",
  "packages/db/src/schema/billing.ts",
  "packages/db/src/schema/jobs.ts",
  "apps/worker/**",
  "tools/extraction/**",
  ".generated/** except the emitted preview/apply targets"
] as const;

export interface ResourceInstallRecipeBundle {
  agentContext: FrameworkAgentContextDefinition;
  applyTargetPath: string;
  allowedPaths: readonly string[];
  forbiddenPaths: readonly string[];
  manualReview: readonly ResourcePlanAdvisory[];
  phaseCommands: {
    apply: readonly string[];
    inspect: readonly string[];
    preview: readonly string[];
    verify: readonly string[];
  };
  plannerWarnings: readonly ResourcePlanAdvisory[];
  previewOutputPath: string;
  recipe: {
    kind: "resource-install";
    templatePath: string;
  };
  relevantContextFiles: readonly string[];
  reportFields: readonly string[];
  reportFormat: string;
  requiredChecks: readonly string[];
  resource: Pick<
    FrameworkResourceSpec,
    "api" | "crud" | "fields" | "label" | "ownership" | "pluralLabel" | "resource"
  >;
  rollbackGuidance: readonly string[];
  safeApplyGuidance: readonly string[];
  safeCustomizationPoints: readonly string[];
  stopConditions: readonly string[];
  task: FrameworkAgentTaskDefinition;
  warnings: readonly ResourcePlanAdvisory[];
}

export interface ResourceInstallRecipeResult {
  bundle: ResourceInstallRecipeBundle;
  outputPath?: string;
}

export function createResourceInstallRecipeFromFile(input: {
  format?: "json" | "markdown";
  outputPath?: string;
  repoRoot: string;
  specPath: string;
}): ResourceInstallRecipeResult {
  const plan = createResourcePlanFromFile({
    repoRoot: input.repoRoot,
    specPath: input.specPath
  });
  const agentContext = createResourceAgentContextBundle({
    plan,
    specPath: plan.source.path
  });
  const previewOutputPath = createDefaultPreviewOutputPath(plan.resource);
  const applyTargetPath = createDefaultApplyTargetPath(plan.resource);
  const bundle = createResourceInstallRecipeBundle({
    agentContext,
    applyTargetPath,
    previewOutputPath,
    specPath: plan.source.path
  });
  const outputPath = input.outputPath
    ? resolveSafeOutputPath({
        outputPath: input.outputPath,
        repoRoot: input.repoRoot
      })
    : undefined;

  if (outputPath) {
    writeRecipeFile({
      contents:
        input.format === "json"
          ? `${JSON.stringify(bundle, null, 2)}\n`
          : formatResourceInstallRecipeMarkdown(bundle),
      outputPath,
      repoRoot: input.repoRoot
    });
  }

  return {
    bundle,
    outputPath
  };
}

export function formatResourceInstallRecipeMarkdown(
  bundle: ResourceInstallRecipeBundle
) {
  const template = readFileSync(resolve(process.cwd(), recipeTemplatePath), "utf8");

  return renderTemplate(template, {
    AGENT_CONTEXT_COMMAND: bundle.phaseCommands.inspect[2] ?? "",
    ALLOWED_PATHS: formatBulletList(bundle.allowedPaths),
    APPLY_TARGET_PATH: bundle.applyTargetPath,
    CUSTOMIZATION_GUIDANCE: formatBulletList(createCustomizationGuidance()),
    FORBIDDEN_PATHS: formatBulletList(bundle.forbiddenPaths),
    MANUAL_REVIEW: formatAdvisories(bundle.manualReview),
    PHASE_FIVE_COMMANDS: bundle.phaseCommands.verify.join("\n"),
    PHASE_FIVE_GUIDANCE: formatBulletList(createPhaseFiveGuidance()),
    PHASE_ONE_COMMANDS: bundle.phaseCommands.inspect.join("\n"),
    PHASE_ONE_GUIDANCE: formatBulletList(createPhaseOneGuidance(bundle)),
    PHASE_THREE_COMMANDS: bundle.phaseCommands.apply.join("\n"),
    PHASE_TWO_COMMANDS: bundle.phaseCommands.preview.join("\n"),
    PHASE_TWO_GUIDANCE: formatBulletList(createPhaseTwoGuidance(bundle)),
    PLANNER_WARNINGS: formatAdvisories(bundle.plannerWarnings),
    PREVIEW_OUTPUT_PATH: bundle.previewOutputPath,
    RELEVANT_CONTEXT_FILES: formatBulletList(bundle.relevantContextFiles.map((path) => `\`${path}\``)),
    REPORT_FORMAT: bundle.reportFormat,
    REQUIRED_CHECKS: formatBulletList(bundle.requiredChecks.map((command) => `\`${command}\``)),
    ROLLBACK_GUIDANCE: formatBulletList(bundle.rollbackGuidance),
    SAFE_APPLY_GUIDANCE: formatBulletList(bundle.safeApplyGuidance),
    SAFE_CUSTOMIZATION_POINTS: formatBulletList(bundle.safeCustomizationPoints.map((path) => `\`${path}\``)),
    SPEC_PATH: bundle.phaseCommands.inspect[1]?.replace("pnpm saas plan resource ", "") ?? "",
    STOP_CONDITIONS: formatBulletList(bundle.stopConditions),
    TEMPLATE_PATH: bundle.recipe.templatePath
  });
}

export function createResourceInstallRecipeBundle(input: {
  agentContext: ResourceAgentContextBundle;
  applyTargetPath: string;
  previewOutputPath: string;
  specPath: string;
}): ResourceInstallRecipeBundle {
  const allowedPaths = deriveAllowedPaths({
    agentContext: input.agentContext,
    applyTargetPath: input.applyTargetPath,
    previewOutputPath: input.previewOutputPath
  });
  const inspectCommands = [
    "pnpm saas doctor",
    `pnpm saas plan resource ${input.specPath}`,
    `pnpm saas agent context resource ${input.specPath}`
  ] as const;
  const previewCommands = [
    `pnpm saas add resource ${input.specPath} --output ${input.previewOutputPath}`,
    "pnpm saas check generators",
    "pnpm saas check generated-resource"
  ] as const;
  const applyCommands = [
    `pnpm saas apply resource ${input.specPath} --target ${input.applyTargetPath}`
  ] as const;
  const verifyCommands = [
    "pnpm --filter @auditrail/framework test",
    "pnpm --filter @auditrail/framework typecheck",
    "pnpm check:boundaries",
    "pnpm typecheck",
    "pnpm verify"
  ] as const;
  const requiredChecks = [
    ...inspectCommands,
    ...previewCommands,
    ...applyCommands,
    ...verifyCommands
  ] as const;
  const stopConditions = [
    "Stop if `pnpm saas plan resource ...` reports blocking warnings or manual-review items beyond the migration placeholder.",
    "Stop if `pnpm saas apply resource ...` would patch unsupported central files such as `apps/api/src/app.ts` or `apps/web/app/product-module.ts`.",
    "Stop if target files already exist unexpectedly and you cannot justify a narrow rerun with `--force`.",
    "Stop if the resource spec uses unsupported ownership, unsupported field types, public API wiring, nav wiring, delete generation, or indexes.",
    "Stop if generated code imports AuditTrail-specific modules or product-owned adapters.",
    "Stop if the implementation requires broad app-shell, route architecture, billing, entitlement, support, worker, extraction, or product-module changes.",
    "Stop if verification requires unrelated refactors outside the generated-resource seam.",
    "Stop if you need to touch more than the expected generated domain, DB, API, web, docs, or safe central-file groups."
  ] as const;

  return {
    agentContext: input.agentContext.agentContext,
    applyTargetPath: input.applyTargetPath,
    allowedPaths,
    forbiddenPaths: [...forbiddenPathOrder],
    manualReview: input.agentContext.manualReviewWarnings,
    phaseCommands: {
      apply: applyCommands,
      inspect: inspectCommands,
      preview: previewCommands,
      verify: verifyCommands
    },
    plannerWarnings: input.agentContext.warnings,
    previewOutputPath: input.previewOutputPath,
    recipe: {
      kind: "resource-install",
      templatePath: recipeTemplatePath
    },
    relevantContextFiles: input.agentContext.relevantContextFiles,
    reportFields: [
      "resource spec used",
      "planner warnings",
      "generated files",
      "central files updated",
      "manual-review items",
      "customizations made",
      "checks run",
      "checks skipped with reasons",
      "boundary result",
      "known risks",
      "next suggested task"
    ],
    reportFormat: createReportFormat({
      applyTargetPath: input.applyTargetPath,
      previewOutputPath: input.previewOutputPath,
      specPath: input.specPath
    }),
    requiredChecks: [...requiredChecks],
    resource: input.agentContext.resource,
    rollbackGuidance: [
      `If preview output is wrong, delete \`${input.previewOutputPath}\` and rerun Phase 2 instead of patching unrelated files.`,
      `If safe apply output is wrong, delete \`${input.applyTargetPath}\` and rerun Phase 3 instead of hand-editing unsupported central files.`,
      "Keep planner manual-review items in the final report when they are not resolved in this task.",
      "Do not promote isolated apply output into real runtime source in this task."
    ],
    safeApplyGuidance: [
      "Apply only after the planner, generator-golden check, and generated-resource smoke check pass.",
      "Do not use `--force` unless the target already contains only prior output for the same resource and you explain the reason in the report.",
      "Treat `packages/domain/package.json`, `packages/domain/src/index.ts`, and `packages/db/src/schema/index.ts` as the only safe central apply paths in this slice.",
      "If apply asks for unsupported central-file patching, stop instead of guessing the patch."
    ],
    safeCustomizationPoints: input.agentContext.safeCustomizationPoints,
    stopConditions,
    task: {
      ...input.agentContext.task,
      allowedPaths,
      forbiddenPaths: [...forbiddenPathOrder],
      reportFields: [
        "resource spec used",
        "planner warnings",
        "generated files",
        "central files updated",
        "manual-review items",
        "customizations made",
        "checks run",
        "checks skipped with reasons",
        "boundary result",
        "known risks",
        "next suggested task"
      ],
      requiredChecks,
      stopConditions
    },
    warnings: input.agentContext.warnings
  };
}

function createDefaultApplyTargetPath(resource: FrameworkResourceSpec) {
  return `.generated/apply-preview/${toKebabCase(resource.resource)}`;
}

function deriveAllowedPaths(input: {
  agentContext: ResourceAgentContextBundle;
  applyTargetPath: string;
  previewOutputPath: string;
}) {
  const resourcePath = toKebabCase(input.agentContext.resource.resource);
  const pluralPath = getPluralPath(input.agentContext.resource);
  const allowedPaths = [
    `packages/domain/src/generated/${resourcePath}/**`,
    "packages/domain/src/index.ts",
    "packages/domain/package.json",
    `packages/db/src/schema/${resourcePath}.ts`,
    "packages/db/src/schema/index.ts",
    `packages/db/src/migrations/<next>_${resourcePath}.sql`,
    `apps/api/src/modules/generated/${resourcePath}/**`,
    `apps/web/src/features/${resourcePath}/**`,
    `apps/web/app/${pluralPath}/**`,
    `docs/resources/${resourcePath}.md`,
    `docs/resources/${resourcePath}-customization.md`,
    `${input.previewOutputPath}/**`,
    `${input.applyTargetPath}/**`
  ];

  return [...new Set(allowedPaths)].sort((left, right) =>
    compareAllowedPath(left, right, {
      pluralPath,
      resourcePath
    })
  );
}

function createCustomizationGuidance() {
  return [
    "Edit only generated resource files plus the documented safe customization points.",
    "Do not edit platform boundaries, billing, support, workers, extraction, or AuditTrail product modules.",
    "Keep organization ownership and authorization checks intact.",
    "Keep the generated resource generic unless the user explicitly asks for product-specific behavior."
  ] as const;
}

function createPhaseOneGuidance(bundle: ResourceInstallRecipeBundle) {
  return [
    "Review planner warnings and manual-review items before generating anything.",
    "Use the agent-context command for bounded file references instead of broad repo reading.",
    bundle.plannerWarnings.length > 0
      ? "Treat the emitted planner warnings as blocking until they are explicitly resolved or accepted by the user."
      : "If new planner warnings appear in your environment, stop and report them before continuing."
  ] as const;
}

function createPhaseTwoGuidance(bundle: ResourceInstallRecipeBundle) {
  return [
    `Inspect \`${bundle.previewOutputPath}/docs/resources/${toKebabCase(bundle.resource.resource)}-customization.md\` for the generated customization notes. The current generator does not emit a top-level \`CUSTOMIZE.md\`.`,
    "Review preview output only inside the emitted preview directory.",
    "Run the generated-resource smoke check before safe apply. It validates current generator readiness, not your preview directory wiring."
  ] as const;
}

function createPhaseFiveGuidance() {
  return [
    "Run the focused framework checks before broad workspace verification.",
    "If a broader check fails for an unrelated existing reason, stop and report it instead of refactoring unrelated modules.",
    "Include every skipped check and the exact reason in the final report."
  ] as const;
}

function createReportFormat(input: {
  applyTargetPath: string;
  previewOutputPath: string;
  specPath: string;
}) {
  return [
    `resource spec used: ${input.specPath}`,
    "planner warnings: <none|summary>",
    `generated files: <paths under ${input.previewOutputPath} or ${input.applyTargetPath}>`,
    "central files updated: <exact paths or none>",
    "manual-review items: <summary>",
    "customizations made: <exact files>",
    "checks run: <exact commands>",
    "checks skipped with reasons: <none|list>",
    "boundary result: <pass|fail>",
    "known risks: <summary>",
    "next suggested task: <single task>"
  ].join("\n");
}

function writeRecipeFile(input: {
  contents: string;
  outputPath: string;
  repoRoot: string;
}) {
  const absolutePath = resolve(input.repoRoot, input.outputPath);

  mkdirSync(dirname(absolutePath), {
    recursive: true
  });
  writeFileSync(absolutePath, input.contents);
}

function renderTemplate(template: string, replacements: Record<string, string>) {
  return `${Object.entries(replacements).reduce(
    (current, [key, value]) => current.replaceAll(`{{${key}}}`, value),
    template
  )}\n`;
}

function formatBulletList(items: readonly string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

function formatAdvisories(advisories: readonly ResourcePlanAdvisory[]) {
  if (advisories.length === 0) {
    return "- none";
  }

  return advisories
    .map((advisory) => {
      const related =
        advisory.relatedPaths && advisory.relatedPaths.length > 0
          ? ` [${advisory.relatedPaths.join(", ")}]`
          : "";

      return `- ${advisory.code}: ${advisory.message}${related}`;
    })
    .join("\n");
}

function getPluralPath(
  resource: Pick<FrameworkResourceSpec, "api" | "resource">
) {
  const segments = resource.api.prefix.split("/").filter(Boolean);

  return segments.at(-1) ?? `${toKebabCase(resource.resource)}s`;
}

function toKebabCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

function compareAllowedPath(
  left: string,
  right: string,
  input: {
    pluralPath: string;
    resourcePath: string;
  }
) {
  const order = [
    `packages/domain/src/generated/${input.resourcePath}/**`,
    "packages/domain/src/index.ts",
    "packages/domain/package.json",
    `packages/db/src/schema/${input.resourcePath}.ts`,
    "packages/db/src/schema/index.ts",
    `packages/db/src/migrations/<next>_${input.resourcePath}.sql`,
    `apps/api/src/modules/generated/${input.resourcePath}/**`,
    `apps/web/src/features/${input.resourcePath}/**`,
    `apps/web/app/${input.pluralPath}/**`,
    `docs/resources/${input.resourcePath}.md`,
    `docs/resources/${input.resourcePath}-customization.md`
  ];
  const leftIndex = order.indexOf(left);
  const rightIndex = order.indexOf(right);

  if (leftIndex >= 0 || rightIndex >= 0) {
    if (leftIndex === -1) {
      return 1;
    }

    if (rightIndex === -1) {
      return -1;
    }

    return leftIndex - rightIndex;
  }

  return left.localeCompare(right);
}
