import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type {
  FrameworkAgentContextDefinition,
  FrameworkAgentTaskDefinition,
  FrameworkCheckDefinition,
  FrameworkResourceSpec
} from "../../packages/framework/src/index.js";
import { resolveSafeOutputPath } from "../extraction/output.js";
import {
  createDefaultPreviewOutputPath,
  getResourceGeneratorSupportMetadata
} from "./resource-generator.js";
import {
  createResourcePlanFromFile,
  type ResourcePlanAdvisory,
  type ResourcePlanReport
} from "./resource-planner.js";

const defaultAgentContextRoot = ".generated/agent-context";

const architectureConstraints = [
  "`platform-core` and `platform-extension` code must not import `audit-product` code.",
  "Do not mutate real app source files for this workflow unless the task explicitly allows promotion from preview output.",
  "Keep generic generated-resource work out of AuditTrail-owned product modules.",
  "Reuse the canonical resource schema, dry-run planner, and preview-only generator metadata instead of inventing parallel conventions."
] as const;

const contextFileOrder = [
  "AGENTS.md",
  "docs/08-agent-quickstart.md",
  "docs/01-agent-engineering-rules.md",
  "docs/02-architecture.md",
  "docs/04-quality-gates.md",
  "tools/architecture-boundaries/rules.ts",
  "packages/framework/src/index.ts",
  "tools/saas/resource-planner.ts",
  "tools/saas/resource-generator.ts",
  "apps/api/src/modules/platform/README.md",
  "apps/web/src/features/organizations/README.md"
] as const;

const forbiddenPathOrder = [
  "apps/api/src/modules/audit-events/**",
  "apps/web/src/features/audit-events/**",
  "packages/domain/src/audit-events/**",
  "apps/api/src/modules/platform/billing/**",
  "apps/api/src/modules/platform/entitlements/**",
  "apps/api/src/modules/platform/support/**",
  "apps/worker/**",
  "tools/extraction/**",
  ".generated/saas-boilerplate/**"
] as const;

const reportFields = [
  "files changed",
  "generated files",
  "manual edits made",
  "checks run",
  "checks skipped",
  "boundary result",
  "generator limitations encountered",
  "known risks",
  "next suggested task"
] as const;

export interface ResourceAgentContextBundle {
  agentContext: FrameworkAgentContextDefinition;
  architectureConstraints: readonly string[];
  filePlanSummary: {
    byAction: ResourcePlanReport["summary"]["byAction"];
    byGroup: ResourcePlanReport["summary"]["byGroup"];
    totalEntries: number;
  };
  forbiddenPaths: readonly string[];
  generatorLimitations: readonly string[];
  generatorScope: {
    outputMode: "preview-only";
    previewCommand: string;
    previewOutputPath: string;
    requiredCrud: readonly string[];
    supportedFieldTypes: readonly string[];
    supportedOwnership: string;
  };
  goal: string;
  manualReviewWarnings: readonly ResourcePlanAdvisory[];
  outputTarget?: string;
  relevantContextFiles: readonly string[];
  reportFields: readonly string[];
  requiredChecks: readonly string[];
  resource: Pick<
    FrameworkResourceSpec,
    "api" | "crud" | "fields" | "label" | "ownership" | "pluralLabel" | "resource"
  >;
  safeCustomizationPoints: readonly string[];
  stopConditions: readonly string[];
  suggestedPrompt: string;
  task: FrameworkAgentTaskDefinition;
  taskType: "generated-resource";
  warnings: readonly ResourcePlanAdvisory[];
}

export interface ResourceAgentContextResult {
  bundle: ResourceAgentContextBundle;
  outputPath?: string;
}

export function createResourceAgentContextFromFile(input: {
  format?: "json" | "markdown";
  outputPath?: string;
  repoRoot: string;
  specPath: string;
}): ResourceAgentContextResult {
  const plan = createResourcePlanFromFile({
    repoRoot: input.repoRoot,
    specPath: input.specPath
  });
  const previewOutputPath = createDefaultPreviewOutputPath(plan.resource);
  const bundle = createResourceAgentContextBundle({
    plan,
    specPath: plan.source.path
  });
  const outputPath = input.outputPath
    ? resolveSafeOutputPath({
        outputPath: input.outputPath,
        repoRoot: input.repoRoot
      })
    : undefined;

  if (outputPath) {
    writeAgentContextFile({
      contents:
        input.format === "json"
          ? `${JSON.stringify(bundle, null, 2)}\n`
          : formatResourceAgentContextMarkdown(bundle),
      outputPath,
      repoRoot: input.repoRoot
    });
  }

  return {
    bundle: {
      ...bundle,
      generatorScope: {
        ...bundle.generatorScope,
        previewOutputPath
      },
      outputTarget: outputPath
    },
    outputPath
  };
}

export function formatResourceAgentContextMarkdown(
  bundle: ResourceAgentContextBundle
) {
  const lines = [
    `# Agent Context: ${bundle.resource.label}`,
    "",
    `- task type: ${bundle.taskType}`,
    `- resource: ${bundle.resource.resource}`,
    `- ownership: ${bundle.resource.ownership}`,
    `- api prefix: ${bundle.resource.api.prefix}`,
    `- goal: ${bundle.goal}`,
    "",
    "## Generator Scope",
    "",
    `- supported ownership: ${bundle.generatorScope.supportedOwnership}`,
    `- supported CRUD: ${bundle.generatorScope.requiredCrud.join(", ")}`,
    `- supported field types: ${bundle.generatorScope.supportedFieldTypes.join(", ")}`,
    `- preview command: \`${bundle.generatorScope.previewCommand}\``,
    `- preview output: \`${bundle.generatorScope.previewOutputPath}\``,
    "",
    "## File Plan Summary",
    "",
    `- total entries: ${bundle.filePlanSummary.totalEntries}`,
    `- create: ${bundle.filePlanSummary.byAction.create}`,
    `- update: ${bundle.filePlanSummary.byAction.update}`,
    `- skip: ${bundle.filePlanSummary.byAction.skip}`,
    `- manual-review: ${bundle.filePlanSummary.byAction["manual-review"]}`,
    `- domain: ${bundle.filePlanSummary.byGroup.domain}`,
    `- db: ${bundle.filePlanSummary.byGroup.db}`,
    `- api: ${bundle.filePlanSummary.byGroup.api}`,
    `- web: ${bundle.filePlanSummary.byGroup.web}`,
    `- docs: ${bundle.filePlanSummary.byGroup.docs}`,
    "",
    "## Allowed Paths",
    "",
    ...bundle.task.allowedPaths.map((path) => `- \`${path}\``),
    "",
    "## Forbidden Paths",
    "",
    ...bundle.forbiddenPaths.map((path) => `- \`${path}\``),
    "",
    "## Relevant Context Files",
    "",
    ...bundle.relevantContextFiles.map((path) => `- \`${path}\``),
    "",
    "## Required Checks",
    "",
    ...bundle.requiredChecks.map((command) => `- \`${command}\``),
    "",
    "## Stop Conditions",
    "",
    ...bundle.stopConditions.map((condition) => `- ${condition}`),
    "",
    "## Architecture Constraints",
    "",
    ...bundle.architectureConstraints.map((constraint) => `- ${constraint}`),
    "",
    "## Generator Limitations",
    "",
    ...bundle.generatorLimitations.map((limitation) => `- ${limitation}`),
    "",
    "## Safe Customization Points",
    "",
    ...bundle.safeCustomizationPoints.map((path) => `- \`${path}\``),
    "",
    "## Planner Warnings",
    "",
    ...(bundle.warnings.length > 0
      ? bundle.warnings.map((warning) => `- ${formatAdvisory(warning)}`)
      : ["- none"]),
    "",
    "## Manual Review",
    "",
    ...(bundle.manualReviewWarnings.length > 0
      ? bundle.manualReviewWarnings.map((item) => `- ${formatAdvisory(item)}`)
      : ["- none"]),
    "",
    "## Report Fields",
    "",
    ...bundle.reportFields.map((field) => `- ${field}`),
    "",
    "## Suggested Prompt",
    "",
    bundle.suggestedPrompt
  ];

  return `${lines.join("\n")}\n`;
}

export function createResourceAgentContextBundle(input: {
  plan: ResourcePlanReport;
  specPath: string;
}): ResourceAgentContextBundle {
  const generatorSupport = getResourceGeneratorSupportMetadata();
  const resourcePath = toKebabCase(input.plan.resource.resource);
  const pluralPath = getPluralPath(input.plan.resource);
  const previewOutputPath = createDefaultPreviewOutputPath(input.plan.resource);
  const previewCommand = `pnpm saas add resource ${input.specPath} --output ${previewOutputPath}`;
  const requiredChecks = createRequiredChecks({
    planChecks: input.plan.checks,
    previewCommand,
    specPath: input.specPath
  });
  const allowedPaths = [
    `tools/saas/**`,
    `packages/framework/**`,
    `packages/domain/src/generated/${resourcePath}/**`,
    `packages/db/src/schema/${resourcePath}.ts`,
    `apps/api/src/modules/generated/${resourcePath}/**`,
    `apps/web/src/features/${resourcePath}/**`,
    `apps/web/app/${pluralPath}/**`,
    `docs/resources/${resourcePath}.md`,
    `docs/resources/${resourcePath}-customization.md`,
    `${previewOutputPath}/**`,
    "tasks/workflow.txt"
  ] as const;
  const stopConditions = [
    "Stop if the validated plan requires modifying central app files such as `apps/api/src/app.ts`, package barrels, or product navigation unexpectedly.",
    "Stop if the resource spec requires unsupported ownership, unsupported field types, public API generation, nav wiring, delete generation, or indexes.",
    "Stop if the work would make `platform-core` or `platform-extension` code import `audit-product` code.",
    "Stop if existing target files would be overwritten without an explicit force or promotion decision.",
    "Stop if the task expands into billing, entitlement, support, worker, extraction, or AuditTrail product-module changes.",
    "Stop if verification requires broad unrelated refactors outside the generated-resource seam."
  ] as const;
  const relevantContextFiles = [...contextFileOrder];
  const task: FrameworkAgentTaskDefinition = {
    allowedPaths,
    contextFiles: relevantContextFiles,
    forbiddenPaths: [...forbiddenPathOrder],
    goal: `Implement, review, or customize the generated-resource scaffold for \`${input.plan.resource.resource}\` without touching AuditTrail product modules or unrelated runtime seams.`,
    id: `generated-resource-${resourcePath}`,
    reportFields,
    requiredChecks,
    stopConditions,
    taskType: "generated-resource"
  };

  return {
    agentContext: {
      checkIds: ["boundaries", "saas-doctor", "resource-plan", "resource-preview"],
      contextFiles: relevantContextFiles,
      moduleIds: [
        `generated-domain-${resourcePath}`,
        `generated-api-${resourcePath}`,
        `generated-web-${resourcePath}`
      ],
      resourceIds: [input.plan.resource.resource],
      summary: `Concise AI-agent context for the preview-only generated-resource workflow for ${input.plan.resource.label}.`,
      taskIds: [task.id]
    },
    architectureConstraints,
    filePlanSummary: {
      byAction: input.plan.summary.byAction,
      byGroup: input.plan.summary.byGroup,
      totalEntries: input.plan.summary.totalEntries
    },
    forbiddenPaths: [...forbiddenPathOrder],
    generatorLimitations: [
      "No new CRUD generation behavior belongs in this task.",
      "The current generator is preview-only and must not mutate runtime source automatically.",
      "Manual review remains required for migration numbering and central file registration.",
      ...generatorSupport.unsupportedBehaviors.map(
        (item) => `Unsupported in the first generator: ${item}.`
      )
    ],
    generatorScope: {
      outputMode: "preview-only",
      previewCommand,
      previewOutputPath,
      requiredCrud: [...generatorSupport.requiredCrud],
      supportedFieldTypes: [...generatorSupport.supportedFieldTypes],
      supportedOwnership: generatorSupport.supportedOwnership
    },
    goal: `Produce a small, safe implementation context bundle for ${input.plan.resource.label} generated-resource work.`,
    manualReviewWarnings: input.plan.manualReview,
    relevantContextFiles,
    reportFields,
    requiredChecks,
    resource: {
      api: input.plan.resource.api,
      crud: input.plan.resource.crud,
      fields: input.plan.resource.fields,
      label: input.plan.resource.label,
      ownership: input.plan.resource.ownership,
      pluralLabel: input.plan.resource.pluralLabel,
      resource: input.plan.resource.resource
    },
    safeCustomizationPoints: generatorSupport.safeCustomizationPoints.map((path) =>
      path.replaceAll("<resource>", resourcePath)
    ),
    stopConditions,
    suggestedPrompt: createSuggestedPrompt({
      allowedPaths,
      previewCommand,
      resource: input.plan.resource,
      specPath: input.specPath
    }),
    task,
    taskType: "generated-resource",
    warnings: input.plan.warnings
  };
}

function createRequiredChecks(input: {
  planChecks: readonly FrameworkCheckDefinition[];
  previewCommand: string;
  specPath: string;
}) {
  const commands = [
    "pnpm check:boundaries",
    "pnpm saas doctor",
    `pnpm saas plan resource ${input.specPath}`,
    input.previewCommand,
    ...input.planChecks.map((check) => check.command)
  ];

  return [...new Set(commands)];
}

function createSuggestedPrompt(input: {
  allowedPaths: readonly string[];
  previewCommand: string;
  resource: FrameworkResourceSpec;
  specPath: string;
}) {
  return [
    `Implement or review the generated-resource seam for \`${input.resource.resource}\` only.`,
    `Start from \`${input.specPath}\`, reuse \`pnpm saas plan resource\` and \`${input.previewCommand}\`, and keep changes inside these paths: ${input.allowedPaths.join(", ")}.`,
    "Do not touch AuditTrail product modules, billing, entitlements, support, workers, extraction, or unrelated central app wiring.",
    "Stop if the work requires unsupported generator behavior, central runtime registration, or overwriting existing files unexpectedly.",
    "Report files changed, manual edits, checks run, skipped checks, boundary result, generator limitations, known risks, and the next suggested task."
  ].join("\n");
}

function writeAgentContextFile(input: {
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

function getPluralPath(resource: FrameworkResourceSpec) {
  const segments = resource.api.prefix.split("/").filter(Boolean);

  return segments.at(-1) ?? `${toKebabCase(resource.resource)}s`;
}

function formatAdvisory(advisory: ResourcePlanAdvisory) {
  const relatedPaths =
    advisory.relatedPaths && advisory.relatedPaths.length > 0
      ? ` [${advisory.relatedPaths.join(", ")}]`
      : "";

  return `${advisory.code}: ${advisory.message}${relatedPaths}`;
}

function toKebabCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}
