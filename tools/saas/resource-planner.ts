import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";

import {
  frameworkResourceSpecSchema,
  type FrameworkCheckDefinition,
  type FrameworkGeneratedFileAction,
  type FrameworkGeneratedFilePlan,
  type FrameworkModuleKind,
  type FrameworkResourceSpec
} from "../../packages/framework/src/index.js";

export type ResourcePlanAction =
  | "create"
  | "manual-review"
  | "skip"
  | "update";

export type ResourcePlanEntryKind = "directory" | "file";

export type ResourcePlanGroup = "api" | "db" | "docs" | "domain" | "web";

export interface ResourcePlanEntry {
  action: ResourcePlanAction;
  exists: boolean;
  group: ResourcePlanGroup;
  kind: ResourcePlanEntryKind;
  moduleKind: FrameworkModuleKind;
  path: string;
  reason: string;
  templateId?: string;
}

export interface ResourcePlanAdvisory {
  code: string;
  message: string;
  relatedPaths?: readonly string[];
}

export interface ResourcePlanReport {
  assumptions: readonly string[];
  checks: readonly FrameworkCheckDefinition[];
  generatedFiles: readonly FrameworkGeneratedFilePlan[];
  generationSupported: false;
  groups: Readonly<Record<ResourcePlanGroup, readonly ResourcePlanEntry[]>>;
  manualReview: readonly ResourcePlanAdvisory[];
  resource: FrameworkResourceSpec;
  source: {
    format: "json";
    path: string;
  };
  summary: {
    byAction: Readonly<Record<ResourcePlanAction, number>>;
    byGroup: Readonly<Record<ResourcePlanGroup, number>>;
    totalEntries: number;
  };
  warnings: readonly ResourcePlanAdvisory[];
}

export interface ResourcePlanFileInput {
  repoRoot: string;
  specPath: string;
}

interface PlannedEntryTemplate {
  existsAction?: Extract<ResourcePlanAction, "manual-review" | "skip" | "update">;
  group: ResourcePlanGroup;
  include?: (resource: FrameworkResourceSpec) => boolean;
  kind: ResourcePlanEntryKind;
  moduleKind: FrameworkModuleKind;
  path: (resource: FrameworkResourceSpec) => string;
  reason: (resource: FrameworkResourceSpec) => string;
  templateId?: string;
}

const resourcePlanGroupOrder = [
  "domain",
  "db",
  "api",
  "web",
  "docs"
] as const satisfies readonly ResourcePlanGroup[];

const resourcePlanActionOrder = [
  "create",
  "update",
  "skip",
  "manual-review"
] as const satisfies readonly ResourcePlanAction[];

const postGenerationChecks: readonly FrameworkCheckDefinition[] = [
  {
    appliesToPaths: [
      "packages/domain/**",
      "packages/db/**",
      "apps/api/**",
      "apps/web/**"
    ],
    command: "pnpm check:boundaries",
    id: "boundaries",
    required: true
  },
  {
    appliesToPaths: [
      "packages/domain/**",
      "packages/db/**",
      "apps/api/**",
      "apps/web/**"
    ],
    command: "pnpm typecheck",
    id: "workspace-typecheck",
    required: true
  },
  {
    appliesToPaths: ["apps/api/**"],
    command: "pnpm --filter @auditrail/api test",
    id: "api-tests",
    required: true
  },
  {
    appliesToPaths: ["apps/web/**"],
    command: "pnpm --filter web test",
    id: "web-tests",
    required: true
  },
  {
    appliesToPaths: [
      "packages/domain/**",
      "packages/db/**",
      "apps/api/**",
      "apps/web/**"
    ],
    command: "pnpm verify",
    id: "verify",
    required: true
  }
] as const;

const reservedModuleConflictPaths = [
  (resourcePath: string) => `apps/api/src/modules/${resourcePath}`,
  (resourcePath: string) => `apps/web/src/features/${resourcePath}`,
  (resourcePath: string) => `packages/domain/src/${resourcePath}`
] as const;

export function createResourcePlanFromFile(
  input: ResourcePlanFileInput
): ResourcePlanReport {
  const repoRoot = resolve(input.repoRoot);
  const sourcePath = resolvePlanSourcePath({
    repoRoot,
    specPath: input.specPath
  });
  const rawSpec = readResourceSpecFile(sourcePath);

  return createResourcePlan({
    repoRoot,
    sourcePath,
    spec: rawSpec
  });
}

export function createResourcePlan(input: {
  repoRoot: string;
  sourcePath: string;
  spec: unknown;
}): ResourcePlanReport {
  const repoRoot = resolve(input.repoRoot);
  const sourcePath = resolve(repoRoot, input.sourcePath);
  const relativeSourcePath = toRepoRelativePath({
    absolutePath: sourcePath,
    repoRoot
  });
  const resource = frameworkResourceSpecSchema.parse(input.spec);
  const entries = buildPlannedEntries({
    repoRoot,
    resource
  });
  const warnings = collectWarnings({
    repoRoot,
    resource
  });
  const manualReview = collectManualReview({
    repoRoot,
    resource
  });
  const groups = createGroupedEntries(entries);
  const generatedFiles = createGeneratedFiles(entries);

  return {
    assumptions: collectAssumptions(resource),
    checks: postGenerationChecks,
    generatedFiles,
    generationSupported: false,
    groups,
    manualReview,
    resource,
    source: {
      format: "json",
      path: relativeSourcePath
    },
    summary: {
      byAction: countEntriesByAction(entries),
      byGroup: countEntriesByGroup(groups),
      totalEntries: entries.length
    },
    warnings
  };
}

export function formatResourcePlanReport(report: ResourcePlanReport): string {
  const lines = [
    `Resource plan: ${report.resource.resource}`,
    "",
    "Summary",
    `- source: ${report.source.path}`,
    `- format: ${report.source.format}`,
    `- label: ${report.resource.label}`,
    `- plural label: ${report.resource.pluralLabel}`,
    `- ownership: ${report.resource.ownership}`,
    `- API prefix: ${report.resource.api.prefix}`,
    `- generation supported: no, dry-run only`,
    `- planned entries: ${report.summary.totalEntries}`,
    `- create: ${report.summary.byAction.create}`,
    `- update: ${report.summary.byAction.update}`,
    `- skip: ${report.summary.byAction.skip}`,
    `- manual-review: ${report.summary.byAction["manual-review"]}`
  ];

  if (report.assumptions.length > 0) {
    lines.push("", "Assumptions");

    for (const assumption of report.assumptions) {
      lines.push(`- ${assumption}`);
    }
  }

  for (const group of resourcePlanGroupOrder) {
    const entries = report.groups[group];

    lines.push("", `${group.toUpperCase()} (${entries.length})`);

    for (const entry of entries) {
      lines.push(
        `- [${entry.action}] ${entry.kind} ${entry.path} (${entry.reason})`
      );
    }
  }

  lines.push("", "Checks");

  for (const check of report.checks) {
    lines.push(`- ${check.command}`);
  }

  if (report.warnings.length > 0) {
    lines.push("", "Warnings");

    for (const warning of report.warnings) {
      lines.push(
        `- ${warning.message}${formatRelatedPathsSuffix(warning.relatedPaths)}`
      );
    }
  }

  if (report.manualReview.length > 0) {
    lines.push("", "Manual Review");

    for (const item of report.manualReview) {
      lines.push(
        `- ${item.message}${formatRelatedPathsSuffix(item.relatedPaths)}`
      );
    }
  }

  return lines.join("\n");
}

function buildPlannedEntries(input: {
  repoRoot: string;
  resource: FrameworkResourceSpec;
}) {
  const templates = createEntryTemplates(input.resource);
  const entries: ResourcePlanEntry[] = [];

  for (const template of templates) {
    if (template.include && !template.include(input.resource)) {
      continue;
    }

    const path = template.path(input.resource);
    const exists = existsInRepo({
      kind: template.kind,
      path,
      repoRoot: input.repoRoot
    });

    entries.push({
      action: resolveEntryAction({
        exists,
        kind: template.kind,
        template
      }),
      exists,
      group: template.group,
      kind: template.kind,
      moduleKind: template.moduleKind,
      path,
      reason: template.reason(input.resource),
      templateId: template.templateId
    });
  }

  return entries;
}

function createEntryTemplates(resource: FrameworkResourceSpec) {
  const resourcePath = toKebabCase(resource.resource);
  const pluralPath = getResourcePathSegment(resource);
  const featureComponentName = resourcePath;

  const templates: PlannedEntryTemplate[] = [
    {
      group: "domain",
      kind: "directory",
      moduleKind: "generated-resource",
      path: () => `packages/domain/src/generated/${resourcePath}`,
      reason: () => "Create the generated resource domain module directory."
    },
    {
      group: "domain",
      kind: "file",
      moduleKind: "generated-resource",
      path: () => `packages/domain/src/generated/${resourcePath}/index.ts`,
      reason: () =>
        "Define the resource field schemas and shared domain types.",
      templateId: "resource/domain-index"
    },
    {
      group: "domain",
      kind: "file",
      moduleKind: "generated-resource",
      path: () => "packages/domain/src/index.ts",
      reason: () => "Export the generated resource domain module from the root barrel.",
      templateId: "resource/domain-root-export"
    },
    {
      group: "db",
      kind: "file",
      moduleKind: "generated-resource",
      path: () => `packages/db/src/schema/${resourcePath}.ts`,
      reason: () => "Define the database table schema for the resource.",
      templateId: "resource/db-schema"
    },
    {
      group: "db",
      kind: "file",
      moduleKind: "generated-resource",
      path: () => "packages/db/src/schema/index.ts",
      reason: () => "Export the resource table schema from the schema barrel.",
      templateId: "resource/db-schema-index"
    },
    {
      existsAction: "manual-review",
      group: "db",
      kind: "file",
      moduleKind: "generated-resource",
      path: () => `packages/db/src/migrations/<next>_${resourcePath}.sql`,
      reason: () =>
        "Add a migration placeholder after choosing the next migration identifier.",
      templateId: "resource/db-migration"
    },
    {
      group: "api",
      kind: "directory",
      moduleKind: "generated-resource",
      path: () => `apps/api/src/modules/generated/${resourcePath}`,
      reason: () => "Create the generated API module directory."
    },
    {
      group: "api",
      kind: "file",
      moduleKind: "generated-resource",
      path: () => `apps/api/src/modules/generated/${resourcePath}/routes.ts`,
      reason: () => "Implement the resource CRUD HTTP routes.",
      templateId: "resource/api-routes"
    },
    {
      group: "api",
      kind: "file",
      moduleKind: "generated-resource",
      path: () => `apps/api/src/modules/generated/${resourcePath}/service.ts`,
      reason: () => "Implement the resource CRUD service workflow.",
      templateId: "resource/api-service"
    },
    {
      group: "api",
      kind: "file",
      moduleKind: "generated-resource",
      path: () => `apps/api/src/modules/generated/${resourcePath}/repo.ts`,
      reason: () => "Define the resource repository interface.",
      templateId: "resource/api-repo"
    },
    {
      group: "api",
      kind: "file",
      moduleKind: "generated-resource",
      path: () =>
        `apps/api/src/modules/generated/${resourcePath}/postgres-repo.ts`,
      reason: () => "Implement the Postgres repository adapter for the resource.",
      templateId: "resource/api-postgres-repo"
    },
    {
      group: "api",
      kind: "file",
      moduleKind: "generated-resource",
      path: () =>
        `apps/api/src/modules/generated/${resourcePath}/__tests__/routes.test.ts`,
      reason: () => "Add route tests for the generated CRUD routes.",
      templateId: "resource/api-routes-test"
    },
    {
      group: "api",
      kind: "file",
      moduleKind: "generated-resource",
      path: () =>
        `apps/api/src/modules/generated/${resourcePath}/__tests__/routes.integration.test.ts`,
      reason: () =>
        "Add a real Postgres integration test for the generated CRUD routes.",
      templateId: "resource/api-routes-integration-test"
    },
    {
      group: "api",
      kind: "file",
      moduleKind: "generated-resource",
      path: () =>
        `apps/api/src/modules/generated/${resourcePath}/__tests__/service.test.ts`,
      reason: () => "Add service tests for the generated CRUD workflow.",
      templateId: "resource/api-service-test"
    },
    {
      group: "api",
      kind: "file",
      moduleKind: "generated-resource",
      path: () => "apps/api/src/app.ts",
      reason: () => "Register the generated resource routes in the API app.",
      templateId: "resource/api-registration"
    },
    {
      group: "web",
      kind: "directory",
      moduleKind: "generated-ui",
      path: () => `apps/web/src/features/${resourcePath}`,
      reason: () => "Create the generated web feature directory."
    },
    {
      group: "web",
      kind: "file",
      moduleKind: "generated-ui",
      path: () => `apps/web/src/features/${resourcePath}/index.ts`,
      reason: () => "Export the generated resource web feature module.",
      templateId: "resource/web-index"
    },
    {
      group: "web",
      kind: "file",
      moduleKind: "generated-ui",
      path: () =>
        `apps/web/src/features/${resourcePath}/api/${resourcePath}-client.ts`,
      reason: () => "Implement the resource web API client.",
      templateId: "resource/web-api-client"
    },
    {
      include: (currentResource) => currentResource.crud.list,
      group: "web",
      kind: "file",
      moduleKind: "generated-ui",
      path: () =>
        `apps/web/src/features/${resourcePath}/components/${featureComponentName}-screen.tsx`,
      reason: () => "Render the resource list screen.",
      templateId: "resource/web-screen"
    },
    {
      include: (currentResource) =>
        currentResource.crud.create || currentResource.crud.update,
      group: "web",
      kind: "file",
      moduleKind: "generated-ui",
      path: () =>
        `apps/web/src/features/${resourcePath}/components/${featureComponentName}-form.tsx`,
      reason: () => "Render the shared create and edit resource form.",
      templateId: "resource/web-form"
    },
    {
      include: (currentResource) => currentResource.crud.list,
      group: "web",
      kind: "file",
      moduleKind: "generated-ui",
      path: () =>
        `apps/web/src/features/${resourcePath}/components/${featureComponentName}-table.tsx`,
      reason: () => "Render the resource list and table view.",
      templateId: "resource/web-table"
    },
    {
      include: (currentResource) =>
        currentResource.crud.list || currentResource.crud.create,
      group: "web",
      kind: "file",
      moduleKind: "generated-ui",
      path: () =>
        `apps/web/src/features/${resourcePath}/components/${featureComponentName}-empty-state.tsx`,
      reason: () => "Render the resource empty state copy and actions.",
      templateId: "resource/web-empty-state"
    },
    {
      group: "web",
      kind: "file",
      moduleKind: "generated-ui",
      path: () => `apps/web/src/features/${resourcePath}/domain/schemas.ts`,
      reason: () => "Define the resource web-facing data schemas.",
      templateId: "resource/web-domain-schemas"
    },
    {
      include: (currentResource) => currentResource.crud.list,
      group: "web",
      kind: "file",
      moduleKind: "generated-ui",
      path: () =>
        `apps/web/src/features/${resourcePath}/__tests__/${resourcePath}-screen.test.tsx`,
      reason: () => "Add UI tests for the resource list screen.",
      templateId: "resource/web-screen-test"
    },
    {
      group: "web",
      kind: "file",
      moduleKind: "generated-ui",
      path: () =>
        `apps/web/src/features/${resourcePath}/__tests__/${resourcePath}-client.test.ts`,
      reason: () => "Add tests for the resource web API client.",
      templateId: "resource/web-client-test"
    },
    {
      include: (currentResource) => currentResource.ui.listPage,
      group: "web",
      kind: "file",
      moduleKind: "generated-ui",
      path: () => `apps/web/app/${pluralPath}/page.tsx`,
      reason: () => "Add the resource list page route.",
      templateId: "resource/web-list-page"
    },
    {
      include: (currentResource) => currentResource.ui.createPage,
      group: "web",
      kind: "file",
      moduleKind: "generated-ui",
      path: () => `apps/web/app/${pluralPath}/create/page.tsx`,
      reason: () => "Add the resource create page route.",
      templateId: "resource/web-create-page"
    },
    {
      include: (currentResource) => currentResource.ui.detailPage,
      group: "web",
      kind: "file",
      moduleKind: "generated-ui",
      path: () => `apps/web/app/${pluralPath}/[id]/page.tsx`,
      reason: () => "Add the resource detail page route.",
      templateId: "resource/web-detail-page"
    },
    {
      include: (currentResource) => currentResource.ui.editPage,
      group: "web",
      kind: "file",
      moduleKind: "generated-ui",
      path: () => `apps/web/app/${pluralPath}/[id]/edit/page.tsx`,
      reason: () => "Add the resource edit page route.",
      templateId: "resource/web-edit-page"
    },
    {
      existsAction: "manual-review",
      group: "web",
      include: (currentResource) => currentResource.ui.nav,
      kind: "file",
      moduleKind: "generated-ui",
      path: () => "apps/web/app/product-module.ts",
      reason: () =>
        "Update the product module seam to expose the new resource in the current repo shell.",
      templateId: "resource/web-nav-adapter"
    },
    {
      group: "docs",
      kind: "file",
      moduleKind: "tooling",
      path: () => "docs/03-api.md",
      reason: () => "Document the generated resource API and route surface.",
      templateId: "resource/docs-api"
    },
    {
      group: "docs",
      kind: "file",
      moduleKind: "tooling",
      path: () => `docs/resources/${resourcePath}.md`,
      reason: () => "Document the resource shape, CRUD behavior, and extension points.",
      templateId: "resource/docs-resource"
    },
    {
      group: "docs",
      kind: "file",
      moduleKind: "tooling",
      path: () => `docs/resources/${resourcePath}-customization.md`,
      reason: () => "Document safe post-generation customization notes.",
      templateId: "resource/docs-customization"
    }
  ];

  return templates;
}

function resolveEntryAction(input: {
  exists: boolean;
  kind: ResourcePlanEntryKind;
  template: PlannedEntryTemplate;
}): ResourcePlanAction {
  if (input.template.existsAction === "manual-review") {
    return "manual-review";
  }

  if (!input.exists) {
    return "create";
  }

  if (input.template.existsAction === "skip") {
    return "skip";
  }

  if (input.kind === "directory") {
    return "skip";
  }

  return "update";
}

function createGeneratedFiles(
  entries: readonly ResourcePlanEntry[]
): readonly FrameworkGeneratedFilePlan[] {
  return entries
    .filter(
      (entry): entry is ResourcePlanEntry & {
        action: FrameworkGeneratedFileAction;
      } => entry.action === "create" || entry.action === "update"
    )
    .filter((entry) => entry.kind === "file")
    .map((entry) => ({
      action: entry.action,
      moduleKind: entry.moduleKind,
      path: entry.path,
      reason: entry.reason,
      requiresManualReview: false,
      templateId: entry.templateId
    }));
}

function createGroupedEntries(entries: readonly ResourcePlanEntry[]) {
  return {
    api: entries.filter((entry) => entry.group === "api"),
    db: entries.filter((entry) => entry.group === "db"),
    docs: entries.filter((entry) => entry.group === "docs"),
    domain: entries.filter((entry) => entry.group === "domain"),
    web: entries.filter((entry) => entry.group === "web")
  } as const satisfies Readonly<
    Record<ResourcePlanGroup, readonly ResourcePlanEntry[]>
  >;
}

function countEntriesByAction(entries: readonly ResourcePlanEntry[]) {
  return {
    create: entries.filter((entry) => entry.action === "create").length,
    update: entries.filter((entry) => entry.action === "update").length,
    skip: entries.filter((entry) => entry.action === "skip").length,
    "manual-review": entries.filter((entry) => entry.action === "manual-review")
      .length
  } as const satisfies Readonly<Record<ResourcePlanAction, number>>;
}

function countEntriesByGroup(
  groups: Readonly<Record<ResourcePlanGroup, readonly ResourcePlanEntry[]>>
) {
  return {
    api: groups.api.length,
    db: groups.db.length,
    docs: groups.docs.length,
    domain: groups.domain.length,
    web: groups.web.length
  } as const satisfies Readonly<Record<ResourcePlanGroup, number>>;
}

function collectAssumptions(resource: FrameworkResourceSpec) {
  switch (resource.ownership) {
    case "organization":
      return [
        "Organization-owned resources assume organization-scoped API authorization and workspace-aware web routing."
      ];
    case "user":
      return [
        "User-owned resources assume user-scoped API authorization and current-user web context."
      ];
    case "global":
      return [
        "Global resources assume an explicit admin or support-only access model before runtime generation."
      ];
    case "none":
      return [
        "Resources with no ownership assume a deliberate shared-access model and should be reviewed before runtime generation."
      ];
  }
}

function collectWarnings(input: {
  repoRoot: string;
  resource: FrameworkResourceSpec;
}) {
  const warnings: ResourcePlanAdvisory[] = [];
  const plannedGeneratedPaths = new Set(
    createEntryTemplates(input.resource)
      .filter((template) => template.kind === "file")
      .filter((template) => template.include?.(input.resource) ?? true)
      .map((template) => template.path(input.resource))
  );

  if (input.resource.crud.delete) {
    warnings.push({
      code: "delete-enabled",
      message:
        "Delete is enabled. A future generator should require explicit confirmation before wiring destructive behavior."
    });
  }

  if (
    input.resource.api.public &&
    input.resource.ownership === "organization" &&
    Object.keys(input.resource.permissions).length === 0
  ) {
    warnings.push({
      code: "public-organization-api",
      message:
        "The resource is organization-owned but the API is public without an explicit permission model."
    });
  }

  const conflictingPaths = reservedModuleConflictPaths
    .map((createPath) => createPath(toKebabCase(input.resource.resource)))
    .filter((path) =>
      isBlockingModuleConflict({
        path,
        plannedGeneratedPaths,
        repoRoot: input.repoRoot
      })
    );

  if (conflictingPaths.length > 0) {
    warnings.push({
      code: "existing-module-conflict",
      message:
        "Existing repo modules already use the resource path outside the generated-resource namespace.",
      relatedPaths: conflictingPaths
    });
  }

  return warnings;
}

function collectManualReview(input: {
  repoRoot: string;
  resource: FrameworkResourceSpec;
}) {
  const manualReview: ResourcePlanAdvisory[] = [
    {
      code: "migration-placeholder",
      message:
        "Migration numbering, SQL shape, and rollout order remain manual-review until migration generation exists.",
      relatedPaths: [`packages/db/src/migrations/<next>_${toKebabCase(input.resource.resource)}.sql`]
    }
  ];

  if (input.resource.ownership === "global") {
    manualReview.push({
      code: "global-ownership-review",
      message:
        "Global ownership requires an explicit admin or support-only access review before generation."
    });
  }

  if (input.resource.ownership === "none") {
    manualReview.push({
      code: "unowned-resource-review",
      message:
        "Ownership mode `none` requires review to confirm the intended shared-access model."
    });
  }

  if (input.resource.ui.nav) {
    manualReview.push({
      code: "product-navigation-review",
      message:
        "Product navigation updates remain manual-review because the current repo wires nav through a product-owned module seam.",
      relatedPaths: ["apps/web/app/product-module.ts"]
    });
  }

  if (
    input.resource.api.public &&
    input.resource.ownership === "organization" &&
    Object.keys(input.resource.permissions).length === 0
  ) {
    manualReview.push({
      code: "public-permissions-review",
      message:
        "Public API exposure for an organization-owned resource should be reviewed before code generation.",
      relatedPaths: ["apps/api/src/app.ts"]
    });
  }

  return manualReview;
}

function resolvePlanSourcePath(input: {
  repoRoot: string;
  specPath: string;
}) {
  const absolutePath = resolve(input.repoRoot, input.specPath);

  if (!existsSync(absolutePath)) {
    throw new Error(`Resource spec file not found: ${input.specPath}`);
  }

  return absolutePath;
}

function readResourceSpecFile(path: string) {
  const extension = extname(path).toLowerCase();

  if (extension !== ".json") {
    throw new Error(
      `Unsupported resource spec format '${extension || "<none>"}'. This planner currently supports JSON resource specs only.`
    );
  }

  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error(
      `Failed to parse JSON resource spec '${path}': ${
        error instanceof Error ? error.message : "Unknown parse error."
      }`
    );
  }
}

function existsInRepo(input: {
  kind: ResourcePlanEntryKind;
  path: string;
  repoRoot: string;
}) {
  const normalizedPath = input.path.replace(/\/$/, "");

  if (normalizedPath.includes("<next>")) {
    return false;
  }

  return existsSync(resolve(input.repoRoot, normalizedPath));
}

function isBlockingModuleConflict(input: {
  path: string;
  plannedGeneratedPaths: ReadonlySet<string>;
  repoRoot: string;
}) {
  if (
    !existsInRepo({
      kind: "directory",
      path: input.path,
      repoRoot: input.repoRoot
    })
  ) {
    return false;
  }

  const existingPaths = collectRepoPathsUnder({
    path: input.path,
    repoRoot: input.repoRoot
  });

  if (existingPaths.length === 0) {
    return false;
  }

  return existingPaths.some((path) => !input.plannedGeneratedPaths.has(path));
}

function collectRepoPathsUnder(input: {
  path: string;
  repoRoot: string;
}) {
  const absolutePath = resolve(input.repoRoot, input.path);
  const stat = statSync(absolutePath);

  if (stat.isFile()) {
    return [input.path];
  }

  const files: string[] = [];

  for (const entry of readdirSync(absolutePath).sort((left, right) =>
    left.localeCompare(right)
  )) {
    const childPath = `${input.path}/${entry}`.replace(/\\/g, "/");
    const childAbsolutePath = resolve(input.repoRoot, childPath);

    if (statSync(childAbsolutePath).isDirectory()) {
      files.push(
        ...collectRepoPathsUnder({
          path: childPath,
          repoRoot: input.repoRoot
        })
      );
      continue;
    }

    files.push(childPath);
  }

  return files;
}

function getResourcePathSegment(resource: FrameworkResourceSpec) {
  const segments = resource.api.prefix.split("/").filter(Boolean);

  return segments.at(-1) ?? `${toKebabCase(resource.resource)}s`;
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

function formatRelatedPathsSuffix(relatedPaths?: readonly string[]) {
  if (!relatedPaths || relatedPaths.length === 0) {
    return "";
  }

  return ` [${relatedPaths.join(", ")}]`;
}
