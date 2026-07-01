import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { FrameworkGeneratedFilePlan, FrameworkResourceSpec } from "../../packages/framework/src/index.js";
import { resolveSafeOutputPath } from "../extraction/output.js";
import {
  createResourcePlanFromFile,
  type ResourcePlanAdvisory,
  type ResourcePlanEntry,
  type ResourcePlanGroup,
  type ResourcePlanReport
} from "./resource-planner.js";

export const resourceGeneratorSupportedFieldTypes = [
  "boolean",
  "datetime",
  "email",
  "enum",
  "string",
  "text",
  "uuid"
] as const;

const supportedFieldTypes = new Set<string>(resourceGeneratorSupportedFieldTypes);

export const resourceGeneratorNonBlockingManualReviewCodes = [
  "migration-placeholder"
] as const;

const nonBlockingManualReviewCodes = new Set(
  resourceGeneratorNonBlockingManualReviewCodes as readonly string[]
);

const supportedTemplateIds = new Set([
  "resource/domain-index",
  "resource/db-schema",
  "resource/api-routes",
  "resource/api-service",
  "resource/api-repo",
  "resource/api-postgres-repo",
  "resource/api-routes-test",
  "resource/api-routes-integration-test",
  "resource/api-service-test",
  "resource/web-index",
  "resource/web-api-client",
  "resource/web-screen",
  "resource/web-form",
  "resource/web-table",
  "resource/web-empty-state",
  "resource/web-domain-schemas",
  "resource/web-screen-test",
  "resource/web-client-test",
  "resource/web-list-page",
  "resource/web-create-page",
  "resource/web-detail-page",
  "resource/web-edit-page",
  "resource/docs-resource",
  "resource/docs-customization"
]);

export const defaultResourcePreviewRoot = ".generated/resource-preview";

export interface ResourceGeneratorFile {
  contents: string;
  group: ResourcePlanGroup;
  outputPath: string;
  repoPath: string;
  templateId: string;
}

export interface ResourceGeneratorResult {
  checks: readonly string[];
  outputPath: string;
  resource: FrameworkResourceSpec;
  skippedPlanPaths: readonly string[];
  writtenFiles: readonly ResourceGeneratorFile[];
}

export function generateResourceFromFile(input: {
  allowedWarningCodes?: readonly string[];
  force?: boolean;
  outputPath?: string;
  repoRoot: string;
  specPath: string;
}): ResourceGeneratorResult {
  const plan = createResourcePlanFromFile({
    repoRoot: input.repoRoot,
    specPath: input.specPath
  });
  const outputPath = resolveSafeOutputPath({
    outputPath: input.outputPath ?? createDefaultPreviewOutputPath(plan.resource),
    repoRoot: input.repoRoot
  });

  validateSupportedResource(plan.resource);
  validatePlannerSafety(plan, input.allowedWarningCodes ?? []);

  const writableFiles = createWritableFiles({
    outputPath,
    plan,
    repoRoot: input.repoRoot
  });

  const conflictingFiles = writableFiles.filter(
    (file) =>
      existsSync(resolve(input.repoRoot, file.outputPath)) && !(input.force ?? false)
  );

  if (conflictingFiles.length > 0) {
    throw new Error(
      [
        "Refusing to overwrite existing generated files without --force.",
        ...conflictingFiles.slice(0, 10).map((file) => `- ${file.outputPath}`)
      ].join("\n")
    );
  }

  const writtenFiles = [...writableFiles].sort((left, right) =>
    left.outputPath.localeCompare(right.outputPath)
  );

  for (const file of writtenFiles) {
    const absolutePath = resolve(input.repoRoot, file.outputPath);

    mkdirSync(dirname(absolutePath), {
      recursive: true
    });
    writeFileSync(absolutePath, file.contents);
  }

  const plannedTemplatePaths = flattenPlanEntries(plan)
    .filter((entry) => entry.templateId && supportedTemplateIds.has(entry.templateId))
    .map((entry) => entry.path)
    .sort((left, right) => left.localeCompare(right));

  return {
    checks: plan.checks.map((check) => check.command),
    outputPath,
    resource: plan.resource,
    skippedPlanPaths: plan.generatedFiles
      .filter(
        (file) =>
          !file.templateId || !supportedTemplateIds.has(file.templateId)
      )
      .map((file) => file.path)
      .sort((left, right) => left.localeCompare(right)),
    writtenFiles: writtenFiles.filter((file) =>
      plannedTemplatePaths.includes(file.repoPath)
    )
  };
}

export function formatGeneratedResourceSummary(
  result: ResourceGeneratorResult
): string {
  const groupCounts = countFilesByGroup(result.writtenFiles);

  return [
    `Generated resource preview: ${result.resource.resource}`,
    "",
    `- output directory: ${result.outputPath}`,
    `- written files: ${result.writtenFiles.length}`,
    `- domain files: ${groupCounts.domain}`,
    `- db files: ${groupCounts.db}`,
    `- api files: ${groupCounts.api}`,
    `- web files: ${groupCounts.web}`,
    `- docs files: ${groupCounts.docs}`,
    `- skipped central follow-up paths: ${result.skippedPlanPaths.length}`,
    `- ownership: ${result.resource.ownership}`,
    `- supported CRUD: list, create, read, update`,
    `- delete support: not generated`,
    `- post-generation checks: ${result.checks.length}`
  ].join("\n");
}

export function createDefaultPreviewOutputPath(resource: FrameworkResourceSpec) {
  return `${defaultResourcePreviewRoot}/${toKebabCase(resource.resource)}`;
}

export function getResourceGeneratorSupportMetadata() {
  return {
    allowedOutputPrefixes: [".generated", "tmp"] as const,
    blockingUnsupportedModes: {
      indexes: true,
      nav: true,
      publicApi: true
    },
    manualReviewAllowedCodes: resourceGeneratorNonBlockingManualReviewCodes,
    previewOnly: true,
    requiredCrud: ["list", "create", "read", "update"] as const,
    safeCustomizationPoints: [
      "apps/api/src/modules/generated/<resource>/service.ts",
      "apps/api/src/modules/generated/<resource>/postgres-repo.ts",
      "apps/api/src/modules/generated/<resource>/routes.ts",
      "apps/web/src/features/<resource>/components/*",
      "docs/resources/<resource>-customization.md"
    ] as const,
    supportedFieldTypes: resourceGeneratorSupportedFieldTypes,
    supportedOwnership: "organization" as const,
    unsupportedBehaviors: [
      "delete generation",
      "public API generation",
      "product navigation wiring",
      "index generation",
      "runtime route registration",
      "real migration generation"
    ] as const
  };
}

function validateSupportedResource(resource: FrameworkResourceSpec) {
  if (resource.ownership !== "organization") {
    throw new Error(
      `Unsupported ownership mode '${resource.ownership}'. The first generator supports organization-owned resources only.`
    );
  }

  if (
    !resource.crud.list ||
    !resource.crud.create ||
    !resource.crud.read ||
    !resource.crud.update
  ) {
    throw new Error(
      "The first generator requires list, create, read, and update to stay enabled."
    );
  }

  if (resource.crud.delete) {
    throw new Error(
      "Delete generation is not supported yet. Disable `crud.delete` before running the generator."
    );
  }

  if (resource.api.public) {
    throw new Error(
      "Public API generation is not supported in the first CRUD generator. Keep `api.public` false or omit it."
    );
  }

  if (resource.ui.nav) {
    throw new Error(
      "Automatic product navigation wiring is not supported in the first CRUD generator. Keep `ui.nav` false or omit it."
    );
  }

  if (resource.indexes.length > 0) {
    throw new Error(
      "Index generation is not supported in the first CRUD generator. Remove `indexes` from the resource spec for now."
    );
  }

  for (const field of resource.fields) {
    if (!supportedFieldTypes.has(field.type)) {
      throw new Error(
        `Field '${field.name}' uses unsupported type '${field.type}'. Supported types: ${Array.from(
          supportedFieldTypes
        ).join(", ")}.`
      );
    }
  }
}

function validatePlannerSafety(
  plan: ResourcePlanReport,
  allowedWarningCodes: readonly string[]
) {
  const allowedWarnings = new Set(allowedWarningCodes);
  const blockingWarnings = plan.warnings.filter(
    (warning) => !allowedWarnings.has(warning.code)
  );
  const blockingManualReview = plan.manualReview.filter(
    (item) => !nonBlockingManualReviewCodes.has(item.code)
  );

  if (blockingWarnings.length === 0 && blockingManualReview.length === 0) {
    return;
  }

  throw new Error(
    [
      "The validated dry-run plan still contains blocking issues. Resolve them before writing files.",
      ...formatAdvisories("Warnings", blockingWarnings),
      ...formatAdvisories("Manual review", blockingManualReview)
    ].join("\n")
  );
}

function formatAdvisories(
  label: string,
  advisories: readonly ResourcePlanAdvisory[]
) {
  if (advisories.length === 0) {
    return [];
  }

  return [
    `${label}:`,
    ...advisories.map((advisory) => `- ${advisory.code}: ${advisory.message}`)
  ];
}

function createWritableFiles(input: {
  outputPath: string;
  plan: ResourcePlanReport;
  repoRoot: string;
}) {
  const context = createTemplateContext(input.plan);
  const entryByPath = new Map(
    flattenPlanEntries(input.plan).map((entry) => [entry.path, entry] as const)
  );
  const files: ResourceGeneratorFile[] = [];

  for (const generatedFile of [...input.plan.generatedFiles].sort((left, right) =>
    left.path.localeCompare(right.path)
  )) {
    if (!generatedFile.templateId || !supportedTemplateIds.has(generatedFile.templateId)) {
      continue;
    }

    const entry = entryByPath.get(generatedFile.path);

    if (!entry) {
      throw new Error(`Planner entry not found for generated path '${generatedFile.path}'.`);
    }

    const renderer = templateRenderers[generatedFile.templateId];

    if (!renderer) {
      throw new Error(`No template renderer registered for '${generatedFile.templateId}'.`);
    }

    files.push({
      contents: ensureTrailingNewline(renderer(context)),
      group: entry.group,
      outputPath: joinOutputPath(input.outputPath, generatedFile.path),
      repoPath: generatedFile.path,
      templateId: generatedFile.templateId
    });
  }

  return files;
}

function createTemplateContext(plan: ResourcePlanReport) {
  const resource = plan.resource;
  const resourcePath = toKebabCase(resource.resource);
  const resourceSlug = getPluralPath(resource);
  const pascalName = toPascalCase(resource.resource);
  const pluralPascalName = toPascalCase(resourceSlug);
  const label = resource.label;
  const pluralLabel = resource.pluralLabel;
  const apiBasePath = `/api${resource.api.prefix}`;
  const createFields = resource.fields.filter((field) => !field.readonly);
  const updateFields = createFields.filter((field) => field.name !== "id");

  return {
    apiBasePath,
    createFields,
    label,
    pascalName,
    pluralLabel,
    pluralPascalName,
    plan,
    resource,
    resourcePath,
    resourceSlug,
    updateFields
  };
}

const templateRenderers: Record<
  string,
  (context: ReturnType<typeof createTemplateContext>) => string
> = {
  "resource/domain-index": renderDomainIndex,
  "resource/db-schema": renderDbSchema,
  "resource/api-routes": renderApiRoutes,
  "resource/api-service": renderApiService,
  "resource/api-repo": renderApiRepo,
  "resource/api-postgres-repo": renderApiPostgresRepo,
  "resource/api-routes-test": renderApiRoutesTest,
  "resource/api-routes-integration-test": renderApiRoutesIntegrationTest,
  "resource/api-service-test": renderApiServiceTest,
  "resource/web-index": renderWebIndex,
  "resource/web-api-client": renderWebApiClient,
  "resource/web-screen": renderWebScreen,
  "resource/web-form": renderWebForm,
  "resource/web-table": renderWebTable,
  "resource/web-empty-state": renderWebEmptyState,
  "resource/web-domain-schemas": renderWebDomainSchemas,
  "resource/web-screen-test": renderWebScreenTest,
  "resource/web-client-test": renderWebClientTest,
  "resource/web-list-page": renderWebListPage,
  "resource/web-create-page": renderWebCreatePage,
  "resource/web-detail-page": renderWebDetailPage,
  "resource/web-edit-page": renderWebEditPage,
  "resource/docs-resource": renderResourceDocs,
  "resource/docs-customization": renderCustomizationDocs
};

function renderDomainIndex(context: ReturnType<typeof createTemplateContext>) {
  const fieldLines = context.resource.fields
    .map((field) => `  ${field.name}: ${renderZodField(field)}`)
    .join(",\n");
  const createShape = context.createFields
    .map((field) => `  ${field.name}: ${renderZodField(field)}`)
    .join(",\n");
  const updateShape = context.updateFields
    .map((field) => `  ${field.name}: ${renderZodOptionalField(field)}`)
    .join(",\n");

  return [
    'import { z } from "zod";',
    "",
    `export const ${context.resource.resource}FieldSchema = z.object({`,
    fieldLines,
    "});",
    "",
    `export const ${context.resource.resource}RecordSchema = z.object({`,
    '  id: z.string().uuid(),',
    '  organizationId: z.string().uuid(),',
    `${fieldLines},`,
    '  createdAt: z.string().datetime(),',
    '  updatedAt: z.string().datetime()',
    "});",
    "",
    `export const create${context.pascalName}InputSchema = z.object({`,
    createShape,
    "});",
    "",
    `export const update${context.pascalName}InputSchema = z.object({`,
    updateShape,
    "});",
    "",
    `export const list${context.pluralPascalName}InputSchema = z.object({`,
    '  cursor: z.string().uuid().optional(),',
    '  limit: z.number().int().positive().max(100).optional(),',
    "  query: z.string().trim().min(1).optional()",
    "});",
    "",
    `export type ${context.pascalName}Record = z.infer<typeof ${context.resource.resource}RecordSchema>;`,
    `export type Create${context.pascalName}Input = z.infer<typeof create${context.pascalName}InputSchema>;`,
    `export type Update${context.pascalName}Input = z.infer<typeof update${context.pascalName}InputSchema>;`,
    `export type List${context.pluralPascalName}Input = z.infer<typeof list${context.pluralPascalName}InputSchema>;`
  ].join("\n");
}

function renderDbSchema(context: ReturnType<typeof createTemplateContext>) {
  const imports = new Set(["index", "pgTable", "text", "timestamp", "uuid"]);
  const fieldLines: string[] = [
    '    id: uuid("id").primaryKey().defaultRandom(),',
    '    organizationId: uuid("organization_id").notNull().references(() => organizations.id),'
  ];

  for (const field of context.resource.fields) {
    imports.add(getDrizzleImport(field.type));
    fieldLines.push(
      `    ${field.name}: ${renderDbColumn(field)}`
    );
  }

  fieldLines.push(
    '    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),',
    '    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()'
  );

  return [
    `import { ${Array.from(imports).sort().join(", ")} } from "drizzle-orm/pg-core";`,
    "",
    'import { organizations } from "./identity.js";',
    "",
    `export const ${context.resource.resource}Table = pgTable(`,
    `  "${context.resourcePath}s",`,
    "  {",
    fieldLines.join("\n"),
    "  },",
    "  (table) => [",
    `    index("${context.resourcePath}s_organization_id_idx").on(table.organizationId)`,
    "  ]",
    ");"
  ].join("\n");
}

function renderApiRepo(context: ReturnType<typeof createTemplateContext>) {
  return [
    `import type { Create${context.pascalName}Input, ${context.pascalName}Record, List${context.pluralPascalName}Input, Update${context.pascalName}Input } from "@auditrail/domain/generated/${context.resourcePath}";`,
    "",
    `export interface ${context.pascalName}Repo {`,
    `  create(input: { organizationId: string; data: Create${context.pascalName}Input }): Promise<${context.pascalName}Record>;`,
    `  findById(input: { id: string; organizationId: string }): Promise<${context.pascalName}Record | undefined>;`,
    `  list(input: { organizationId: string; filters: List${context.pluralPascalName}Input }): Promise<readonly ${context.pascalName}Record[]>;`,
    `  update(input: { id: string; organizationId: string; data: Update${context.pascalName}Input }): Promise<${context.pascalName}Record | undefined>;`,
    "}"
  ].join("\n");
}

function renderApiService(context: ReturnType<typeof createTemplateContext>) {
  return [
    `import { create${context.pascalName}InputSchema, list${context.pluralPascalName}InputSchema, update${context.pascalName}InputSchema, type Create${context.pascalName}Input, type Update${context.pascalName}Input } from "@auditrail/domain/generated/${context.resourcePath}";`,
    "",
    `import type { ${context.pascalName}Repo } from "./repo.js";`,
    "",
    `export function create${context.pascalName}Service(repo: ${context.pascalName}Repo) {`,
    "  return {",
    "    async create(input: { data: Create" + context.pascalName + "Input; organizationId: string }) {",
    "      return repo.create({",
    "        data: create" + context.pascalName + "InputSchema.parse(input.data),",
    "        organizationId: input.organizationId",
    "      });",
    "    },",
    "    async get(input: { id: string; organizationId: string }) {",
    "      return repo.findById(input);",
    "    },",
    "    async list(input: { organizationId: string; query?: string; limit?: number; cursor?: string }) {",
    "      return repo.list({",
    "        filters: list" + context.pluralPascalName + "InputSchema.parse({",
    "          cursor: input.cursor,",
    "          limit: input.limit,",
    "          query: input.query",
    "        }),",
    "        organizationId: input.organizationId",
    "      });",
    "    },",
    "    async update(input: { data: Update" + context.pascalName + "Input; id: string; organizationId: string }) {",
    "      return repo.update({",
    "        data: update" + context.pascalName + "InputSchema.parse(input.data),",
    "        id: input.id,",
    "        organizationId: input.organizationId",
    "      });",
    "    }",
    "  };",
    "}"
  ].join("\n");
}

function renderApiPostgresRepo(context: ReturnType<typeof createTemplateContext>) {
  const dbAssignmentLines = context.createFields.map((field) =>
    renderDbValueAssignment({
      accessPath: `input.data.${field.name}`,
      field,
      mode: "create"
    })
  );
  const updateAssignmentLines = context.updateFields.map((field) =>
    renderDbValueAssignment({
      accessPath: `input.data.${field.name}`,
      field,
      mode: "update"
    })
  );
  const recordShapeLines = context.resource.fields.map((field) =>
    `    ${field.name}: ${renderRecordValue(context, field)},`
  );
  const searchableFields = context.resource.fields.filter((field) => field.searchable);
  const searchClauseLines = searchableFields.map((field) =>
    `      ilike(sql\`cast(\${${context.resource.resource}Table.${field.name}} as text)\`, pattern)`
  );

  return [
    `import type { ${context.pascalName}Record } from "@auditrail/domain/generated/${context.resourcePath}";`,
    `import { ${context.resource.resource}Table } from "@auditrail/db/schema";`,
    'import { and, desc, eq, ilike, lt, or, sql } from "drizzle-orm";',
    "",
    `import type { AppDatabase } from "../../../plugins/database.js";`,
    `import type { ${context.pascalName}Repo } from "./repo.js";`,
    "",
    `export function createPostgres${context.pascalName}Repo(db: AppDatabase): ${context.pascalName}Repo {`,
    "  return {",
    "    async create(input) {",
    `      const [record] = await db.insert(${context.resource.resource}Table).values({`,
    "        organizationId: input.organizationId,",
    ...dbAssignmentLines,
    "      }).returning();",
    "",
    `      return to${context.pascalName}Record(record);`,
    "    },",
    "    async findById(input) {",
    `      const [record] = await db.select().from(${context.resource.resource}Table).where(`,
    "        and(",
    `          eq(${context.resource.resource}Table.id, input.id),`,
    `          eq(${context.resource.resource}Table.organizationId, input.organizationId)`,
    "        )",
    "      ).limit(1);",
    "",
    `      return record ? to${context.pascalName}Record(record) : undefined;`,
    "    },",
    "    async list(input) {",
    "      const limit = Math.min(input.filters.limit ?? 50, 100);",
    "      const pattern = input.filters.query ? `%${input.filters.query}%` : undefined;",
    `      const [cursorRecord] = input.filters.cursor ? await db.select({`,
    `        createdAt: ${context.resource.resource}Table.createdAt,`,
    `        id: ${context.resource.resource}Table.id`,
    `      }).from(${context.resource.resource}Table).where(`,
    "        and(",
    `          eq(${context.resource.resource}Table.id, input.filters.cursor),`,
    `          eq(${context.resource.resource}Table.organizationId, input.organizationId)`,
    "        )",
    "      ).limit(1) : [];",
    `      const records = await db.select().from(${context.resource.resource}Table).where(`,
    "        and(",
    `          eq(${context.resource.resource}Table.organizationId, input.organizationId),`,
    searchClauseLines.length > 0
      ? [
          "          pattern",
          "            ? or(",
          ...searchClauseLines.map((line, index) =>
            index < searchClauseLines.length - 1 ? `${line},` : line
          ),
          "            )",
          "            : undefined,"
        ].join("\n")
      : "          undefined,",
    "          cursorRecord",
    "            ? or(",
    `                lt(${context.resource.resource}Table.createdAt, cursorRecord.createdAt),`,
    "                and(",
    `                  eq(${context.resource.resource}Table.createdAt, cursorRecord.createdAt),`,
    `                  lt(${context.resource.resource}Table.id, cursorRecord.id)`,
    "                )",
    "              )",
    "            : undefined",
    "        )",
    `      ).orderBy(desc(${context.resource.resource}Table.createdAt), desc(${context.resource.resource}Table.id)).limit(limit);`,
    "",
    `      return records.map(to${context.pascalName}Record);`,
    "    },",
    "    async update(input) {",
    `      const [record] = await db.update(${context.resource.resource}Table).set({`,
    ...updateAssignmentLines,
    "        updatedAt: new Date()",
    "      }).where(",
    "        and(",
    `          eq(${context.resource.resource}Table.id, input.id),`,
    `          eq(${context.resource.resource}Table.organizationId, input.organizationId)`,
    "        )",
    "      ).returning();",
    "",
    `      return record ? to${context.pascalName}Record(record) : undefined;`,
    "    }",
    "  };",
    "}",
    "",
    `function to${context.pascalName}Record(`,
    `  record: typeof ${context.resource.resource}Table.$inferSelect`,
    `): ${context.pascalName}Record {`,
    "  return {",
    "    id: record.id,",
    "    organizationId: record.organizationId,",
    ...recordShapeLines,
    "    createdAt: record.createdAt.toISOString(),",
    "    updatedAt: record.updatedAt.toISOString()",
    "  };",
    "}"
  ].join("\n");
}

function renderApiRoutes(context: ReturnType<typeof createTemplateContext>) {
  const listPath = context.apiBasePath.replace("/api", "");

  return [
    'import type { FastifyInstance, FastifyReply } from "fastify";',
    'import { z } from "zod";',
    "",
    `import type { create${context.pascalName}Service } from "./service.js";`,
    "",
    "const organizationParamsSchema = z.object({",
    "  organizationId: z.string().uuid()",
    "});",
    "",
    "const resourceIdParamsSchema = z.object({",
    "  id: z.string().uuid(),",
    "  organizationId: z.string().uuid()",
    "});",
    "",
    'type GeneratedResourceAccessRole = "owner" | "admin" | "member" | "viewer";',
    "",
    `export interface ${context.pascalName}RoutesOptions {`,
    "  access: {",
    "    assertOrganizationAccess(input: {",
    "      allowedRoles: readonly GeneratedResourceAccessRole[];",
    "      organizationId: string;",
    "      userId: string;",
    "    }): Promise<void>;",
    "  };",
    `  service: ReturnType<typeof create${context.pascalName}Service>;`,
    "}",
    "",
    `export async function register${context.pascalName}Routes(`,
    "  app: FastifyInstance,",
    `  options: ${context.pascalName}RoutesOptions`,
    ") {",
    `  app.get("${listPath}", async (request, reply) => {`,
    "    const user = request.sessionUser;",
    "    const params = organizationParamsSchema.safeParse(request.params);",
    "",
    "    if (!user) {",
    '      return reply.code(401).send({ error: "missing_session" });',
    "    }",
    "",
    "    if (!params.success) {",
    '      return reply.code(400).send({ error: "invalid_request" });',
    "    }",
    "",
    "    try {",
    "      await options.access.assertOrganizationAccess({",
    '        allowedRoles: ["owner", "admin", "member", "viewer"],',
    "        organizationId: params.data.organizationId,",
    "        userId: user.id",
    "      });",
    "",
    "      return {",
    "        items: await options.service.list({",
    "          cursor: undefined,",
    "          limit: undefined,",
    "          organizationId: params.data.organizationId,",
    "          query: undefined",
    "        })",
    "      };",
    "    } catch (error) {",
    "      return mapGeneratedResourceAccessError(reply, error);",
    "    }",
    "  });",
    "",
    `  app.post("${listPath}", async (request, reply) => {`,
    "    const user = request.sessionUser;",
    "    const params = organizationParamsSchema.safeParse(request.params);",
    "",
    "    if (!user) {",
    '      return reply.code(401).send({ error: "missing_session" });',
    "    }",
    "",
    "    if (!params.success) {",
    '      return reply.code(400).send({ error: "invalid_request" });',
    "    }",
    "",
    "    try {",
    "      await options.access.assertOrganizationAccess({",
    '        allowedRoles: ["owner", "admin", "member"],',
    "        organizationId: params.data.organizationId,",
    "        userId: user.id",
    "      });",
    "",
    "      return reply.code(201).send(",
    "        await options.service.create({",
    '          data: request.body as Parameters<typeof options.service.create>[0]["data"],',
    "          organizationId: params.data.organizationId",
    "        })",
    "      );",
    "    } catch (error) {",
    "      return mapGeneratedResourceAccessError(reply, error);",
    "    }",
    "  });",
    "",
    `  app.get("${listPath}/:id", async (request, reply) => {`,
    "    const user = request.sessionUser;",
    "    const params = resourceIdParamsSchema.safeParse(request.params);",
    "",
    "    if (!user) {",
    '      return reply.code(401).send({ error: "missing_session" });',
    "    }",
    "",
    "    if (!params.success) {",
    '      return reply.code(400).send({ error: "invalid_request" });',
    "    }",
    "",
    "    try {",
    "      await options.access.assertOrganizationAccess({",
    '        allowedRoles: ["owner", "admin", "member", "viewer"],',
    "        organizationId: params.data.organizationId,",
    "        userId: user.id",
    "      });",
    "",
    "      const resource = await options.service.get({",
    "        id: params.data.id,",
    "        organizationId: params.data.organizationId",
    "      });",
    "",
    "      if (!resource) {",
    '        return reply.code(404).send({ error: "not_found" });',
    "      }",
    "",
    "      return resource;",
    "    } catch (error) {",
    "      return mapGeneratedResourceAccessError(reply, error);",
    "    }",
    "  });",
    "",
    `  app.patch("${listPath}/:id", async (request, reply) => {`,
    "    const user = request.sessionUser;",
    "    const params = resourceIdParamsSchema.safeParse(request.params);",
    "",
    "    if (!user) {",
    '      return reply.code(401).send({ error: "missing_session" });',
    "    }",
    "",
    "    if (!params.success) {",
    '      return reply.code(400).send({ error: "invalid_request" });',
    "    }",
    "",
    "    try {",
    "      await options.access.assertOrganizationAccess({",
    '        allowedRoles: ["owner", "admin", "member"],',
    "        organizationId: params.data.organizationId,",
    "        userId: user.id",
    "      });",
    "",
    "      const resource = await options.service.update({",
    '        data: request.body as Parameters<typeof options.service.update>[0]["data"],',
    "        id: params.data.id,",
    "        organizationId: params.data.organizationId",
    "      });",
    "",
    "      if (!resource) {",
    '        return reply.code(404).send({ error: "not_found" });',
    "      }",
    "",
    "      return resource;",
    "    } catch (error) {",
    "      return mapGeneratedResourceAccessError(reply, error);",
    "    }",
    "  });",
    "}",
    "",
    "function mapGeneratedResourceAccessError(reply: FastifyReply, error: unknown) {",
    '  if (error instanceof Error && error.message === "forbidden") {',
    '    return reply.code(403).send({ error: "forbidden" });',
    "  }",
    "",
    "  throw error;",
    "}"
  ].join("\n");
}

function renderApiRoutesTest(context: ReturnType<typeof createTemplateContext>) {
  const listPath = context.apiBasePath.replace(
    "/api",
    ""
  ).replace(":organizationId", "11111111-1111-4111-8111-111111111111");

  return [
    'import Fastify from "fastify";',
    'import { describe, expect, it } from "vitest";',
    "",
    `import { register${context.pascalName}Routes } from "../routes.js";`,
    `import type { create${context.pascalName}Service } from "../service.js";`,
    "",
    `describe("register${context.pascalName}Routes", () => {`,
    `  it("requires a session before listing ${context.pluralLabel.toLowerCase()}", async () => {`,
    "    const app = buildTestApp({}, { session: false });",
    "",
    "    const response = await app.inject({",
    `      url: "${listPath}"`,
    "    });",
    "",
    "    expect(response.statusCode).toBe(401);",
    '    expect(response.json()).toEqual({ error: "missing_session" });',
    "  });",
    "",
    `  it("lists ${context.pluralLabel.toLowerCase()} for the current organization", async () => {`,
    "    const app = buildTestApp({",
    "      async list(input) {",
    "        expect(input).toEqual({",
    "          cursor: undefined,",
    "          limit: undefined,",
    '          organizationId: "11111111-1111-4111-8111-111111111111",',
    "          query: undefined",
    "        });",
    "",
    "        return [",
    "          {",
    '            createdAt: "2026-06-29T00:00:00.000Z",',
    renderExpectedFieldObject(context.resource.fields),
    '            id: "22222222-2222-4222-8222-222222222222",',
    '            organizationId: "11111111-1111-4111-8111-111111111111",',
    '            updatedAt: "2026-06-29T00:00:00.000Z"',
    "          }",
    "        ];",
    "      }",
    "    });",
    "",
    "    const response = await app.inject({",
    `      url: "${listPath}"`,
    "    });",
    "",
    "    expect(response.statusCode).toBe(200);",
    "    expect(response.json()).toEqual({",
    "      items: [",
    "        {",
    '          createdAt: "2026-06-29T00:00:00.000Z",',
    renderExpectedFieldObject(context.resource.fields),
    '          id: "22222222-2222-4222-8222-222222222222",',
    '          organizationId: "11111111-1111-4111-8111-111111111111",',
    '          updatedAt: "2026-06-29T00:00:00.000Z"',
    "        }",
    "      ]",
    "    });",
    "  });",
    "",
    '  it("maps forbidden organization access to 403", async () => {',
    "    const app = buildTestApp({}, {",
    '      accessError: new Error("forbidden")',
    "    });",
    "",
    "    const response = await app.inject({",
    '      method: "POST",',
    "      payload: {",
    renderCreateInputObject(context.resource.fields),
    "      },",
    `      url: "${listPath}"`,
    "    });",
    "",
    "    expect(response.statusCode).toBe(403);",
    '    expect(response.json()).toEqual({ error: "forbidden" });',
    "  });",
    "});",
    "",
    "function buildTestApp(",
    `  overrides: Partial<ReturnType<typeof create${context.pascalName}Service>>,`,
    "  options: {",
    "    accessError?: Error;",
    "    session?: boolean;",
    "  } = {}",
    ") {",
    "  const app = Fastify();",
    "  const useSession = options.session ?? true;",
    "",
    '  app.decorateRequest("sessionUser");',
    '  app.addHook("preHandler", async (request) => {',
    "    request.sessionUser = useSession",
    "      ? {",
    '          email: "user@example.com",',
    '          id: "user-1"',
    "        }",
    "      : undefined;",
    "  });",
    "",
    `  app.register(register${context.pascalName}Routes, {`,
    "    access: {",
    "      async assertOrganizationAccess() {",
    "        if (options.accessError) {",
    "          throw options.accessError;",
    "        }",
    "      }",
    "    },",
    `    service: create${context.pascalName}ServiceStub(overrides)`,
    "  });",
    "",
    "  return app;",
    "}",
    "",
    `function create${context.pascalName}ServiceStub(`,
    `  overrides: Partial<ReturnType<typeof create${context.pascalName}Service>>`,
    ") {",
    "  return {",
    "    async create() {",
    '      throw new Error("not implemented");',
    "    },",
    "    async get() {",
    '      throw new Error("not implemented");',
    "    },",
    "    async list() {",
    "      return [];",
    "    },",
    "    async update() {",
    '      throw new Error("not implemented");',
    "    },",
    "    ...overrides",
    "  };",
    "}"
  ].join("\n");
}

function renderApiRoutesIntegrationTest(
  context: ReturnType<typeof createTemplateContext>
) {
  const tableName = getPluralPath(context.resource);
  const primaryField = context.resource.fields[0];
  const createExpectedFields = renderExpectedFieldObject(context.resource.fields);
  const createPayloadFields = renderCreateInputObject(context.resource.fields);
  const updateValue = JSON.stringify(getAlternateExampleValue(primaryField));
  const updatedExpectedFields = context.resource.fields
    .map((field) =>
      field.name === primaryField.name
        ? `      ${field.name}: ${updateValue},`
        : `      ${field.name}: ${JSON.stringify(getExampleValue(field))},`
    )
    .join("\n");

  return [
    'import { afterAll, beforeEach, describe, expect, it } from "vitest";',
    'import pg from "pg";',
    'import { z } from "zod";',
    "",
    'import { API_VERSION_PREFIX } from "../../../../api-version.js";',
    'import { buildApp } from "../../../../app.js";',
    'import { loadConfig } from "../../../../config.js";',
    'import { loadEnvFiles } from "../../../../env-files.js";',
    'import { hashToken } from "../../../auth/tokens.js";',
    'import { seedDemoProject } from "../../../../../../../packages/db/src/seed.js";',
    "",
    "const config = loadConfig(loadEnvFiles());",
    "const integrationEnv = z",
    "  .object({",
    "    TEST_DATABASE_URL: z.string().url()",
    "  })",
    "  .parse(loadEnvFiles());",
    "const databaseUrl = integrationEnv.TEST_DATABASE_URL;",
    "const authTokenSecret = config.AUTH_TOKEN_SECRET!;",
    "",
    `describe("${context.resource.resource} generated resource integration", () => {`,
    "  const pool = new pg.Pool({",
    "    connectionString: databaseUrl",
    "  });",
    "  const app = buildApp({",
    "    infrastructure: {",
    "      databaseUrl",
    "    },",
    "    useInfrastructure: true,",
    "    useRateLimit: false",
    "  });",
    "",
    "  beforeEach(async () => {",
    "    try {",
    "      await truncateAll();",
    "    } catch (error) {",
    "      if (",
    "        error instanceof Error &&",
    '        "code" in error &&',
    '        error.code === "3D000"',
    "      ) {",
    "        throw new Error(",
    '          "TEST_DATABASE_URL database does not exist. Run `pnpm db:create:test && pnpm db:migrate:test` first."',
    "        );",
    "      }",
    "",
    "      throw error;",
    "    }",
    "  });",
    "",
    "  afterAll(async () => {",
    "    await app.close();",
    "    await pool.end();",
    "  });",
    "",
    `  it("creates, lists, reads, and updates ${context.pluralLabel.toLowerCase()} through the installed API routes", async () => {`,
    "    const session = await createSessionMember();",
    "    const createResponse = await app.inject({",
    '      method: "POST",',
    "      headers: {",
    "        cookie: session.cookie",
    "      },",
    "      payload: {",
    createPayloadFields,
    "      },",
    `      url: \`${"${API_VERSION_PREFIX}"}/organizations/${"${session.organizationId}"}/${tableName}\``,
    "    });",
    "",
    "    expect(createResponse.statusCode).toBe(201);",
    "    expect(createResponse.json()).toMatchObject({",
    '      createdAt: expect.any(String),',
    createExpectedFields,
    '      id: expect.any(String),',
    "      organizationId: session.organizationId,",
    '      updatedAt: expect.any(String)',
    "    });",
    "",
    "    const createdId = createResponse.json().id as string;",
    "",
    "    const listResponse = await app.inject({",
    '      method: "GET",',
    "      headers: {",
    "        cookie: session.cookie",
    "      },",
    `      url: \`${"${API_VERSION_PREFIX}"}/organizations/${"${session.organizationId}"}/${tableName}\``,
    "    });",
    "",
    "    expect(listResponse.statusCode).toBe(200);",
    "    expect(listResponse.json()).toEqual({",
    "      items: [",
    "        {",
    '          createdAt: expect.any(String),',
    createExpectedFields,
    "          id: createdId,",
    "          organizationId: session.organizationId,",
    '          updatedAt: expect.any(String)',
    "        }",
    "      ]",
    "    });",
    "",
    "    const getResponse = await app.inject({",
    '      method: "GET",',
    "      headers: {",
    "        cookie: session.cookie",
    "      },",
    `      url: \`${"${API_VERSION_PREFIX}"}/organizations/${"${session.organizationId}"}/${tableName}/${"${createdId}"}\``,
    "    });",
    "",
    "    expect(getResponse.statusCode).toBe(200);",
    "    expect(getResponse.json()).toMatchObject({",
    createExpectedFields,
    "      id: createdId,",
    "      organizationId: session.organizationId",
    "    });",
    "",
    "    const updateResponse = await app.inject({",
    '      method: "PATCH",',
    "      headers: {",
    "        cookie: session.cookie",
    "      },",
    "      payload: {",
    `        ${primaryField.name}: ${updateValue}`,
    "      },",
    `      url: \`${"${API_VERSION_PREFIX}"}/organizations/${"${session.organizationId}"}/${tableName}/${"${createdId}"}\``,
    "    });",
    "",
    "    expect(updateResponse.statusCode).toBe(200);",
    "    expect(updateResponse.json()).toMatchObject({",
    updatedExpectedFields,
    "      id: createdId,",
    "      organizationId: session.organizationId",
    "    });",
    "  });",
    "",
    `  it("does not expose ${context.pluralLabel.toLowerCase()} across organizations", async () => {`,
    "    const session = await createSessionMember();",
    '    const otherOrganization = await createOrganization("OtherCo");',
    "",
    "    const response = await app.inject({",
    '      method: "GET",',
    "      headers: {",
    "        cookie: session.cookie",
    "      },",
    `      url: \`${"${API_VERSION_PREFIX}"}/organizations/${"${otherOrganization.id}"}/${tableName}\``,
    "    });",
    "",
    "    expect(response.statusCode).toBe(403);",
    '    expect(response.json()).toEqual({ error: "forbidden" });',
    "  });",
    "",
    "  async function truncateAll() {",
    "    await pool.query(`",
    "      TRUNCATE TABLE",
    `        ${tableName},`,
    '        "job_outbox",',
    "        project_webhook_deliveries,",
    "        project_webhook_endpoints,",
    "        audit_events,",
    "        api_keys,",
    "        auth_sessions,",
    "        auth_magic_links,",
    "        organization_memberships,",
    "        organization_invitations,",
    "        user_organization_onboarding_states,",
    "        organization_installed_products,",
    "        projects,",
    "        organizations,",
    '        users',
    "      RESTART IDENTITY CASCADE",
    "    `);",
    "  }",
    "",
    "  async function createSessionMember() {",
    "    const seeded = await seedDemoProject({",
    "      databaseUrl",
    "    });",
    "    const user = await pool.query<{ id: string }>(",
    '      `insert into "users" ("email")',
    '       values ($1)',
    "       returning \"id\"`,",
    '      ["integration-owner@example.com"]',
    "    );",
    "    const userId = user.rows[0]!.id;",
    "",
    "    await pool.query(",
    '      `insert into "organization_memberships" ("organization_id", "user_id", "role")',
    "       values ($1, $2, 'owner')`,",
    "      [seeded.organizationId, userId]",
    "    );",
    "",
    '    const sessionToken = "integration-session-token";',
    "",
    "    await pool.query(",
    '      `insert into "auth_sessions" ("user_id", "token_hash", "expires_at")',
    "       values ($1, $2, now() + interval '30 day')`,",
    "      [userId, hashToken(sessionToken, { secret: authTokenSecret })]",
    "    );",
    "",
    "    return {",
    "      cookie: `${config.AUTH_SESSION_COOKIE_NAME}=${sessionToken}`,",
    "      organizationId: seeded.organizationId,",
    "      userId",
    "    };",
    "  }",
    "",
    "  async function createOrganization(name: string) {",
    "    const result = await pool.query<{ id: string }>(",
    '      `insert into "organizations" ("name")',
    '       values ($1)',
    "       returning \"id\"`,",
    "      [name]",
    "    );",
    "",
    "    return {",
    "      id: result.rows[0]!.id",
    "    };",
    "  }",
    "});"
  ].join("\n");
}

function renderApiServiceTest(context: ReturnType<typeof createTemplateContext>) {
  return [
    'import { describe, expect, it } from "vitest";',
    "",
    `import { create${context.pascalName}Service } from "../service.js";`,
    "",
    `describe("create${context.pascalName}Service", () => {`,
    `  it("validates create input before writing ${context.label.toLowerCase()} records", async () => {`,
    `    const service = create${context.pascalName}Service({`,
    "      async create(input) {",
    "        return {",
    "          id: \"00000000-0000-0000-0000-000000000001\",",
    "          organizationId: input.organizationId,",
    renderObjectLiteralFields(context.resource.fields),
    '          createdAt: "2026-06-29T00:00:00.000Z",',
    '          updatedAt: "2026-06-29T00:00:00.000Z"',
    "        };",
    "      },",
    "      async findById() {",
    "        return undefined;",
    "      },",
    "      async list() {",
    "        return [];",
    "      },",
    "      async update() {",
    "        return undefined;",
    "      }",
    "    });",
    "",
    "    await expect(",
    "      service.create({",
    "        data: {",
    renderCreateInputObject(context.resource.fields).replace(/^        /gm, "          "),
    "        },",
    '        organizationId: "00000000-0000-0000-0000-000000000001"',
    "      })",
    "    ).resolves.toMatchObject({",
    renderExpectedFieldObject(context.resource.fields),
    "    });",
    "  });",
    "});"
  ].join("\n");
}

function renderWebIndex(context: ReturnType<typeof createTemplateContext>) {
  return [
    `export * from "./api/${context.resourcePath}-client.js";`,
    `export * from "./components/${context.resourcePath}-empty-state.js";`,
    `export * from "./components/${context.resourcePath}-form.js";`,
    `export * from "./components/${context.resourcePath}-screen.js";`,
    `export * from "./components/${context.resourcePath}-table.js";`,
    'export * from "./domain/schemas.js";'
  ].join("\n");
}

function renderWebApiClient(context: ReturnType<typeof createTemplateContext>) {
  const organizationPath = context.apiBasePath.replace(
    ":organizationId",
    "${organizationId}"
  );

  return [
    'import type { ApiClient } from "@/src/lib/api/api-client";',
    `import { ${context.resource.resource}RecordSchema } from "@/src/features/${context.resourcePath}/domain/schemas";`,
    'import { z } from "zod";',
    "",
    `const ${context.resource.resource}ListResponseSchema = z.object({`,
    `  items: z.array(${context.resource.resource}RecordSchema)`,
    "});",
    "",
    "export function createResourceClient(apiClient: ApiClient) {",
    "  return {",
    "    async create(organizationId: string, body: Record<string, unknown>) {",
    `      return ${context.resource.resource}RecordSchema.parse(`,
    "        await apiClient.request({",
    "          body,",
    '          method: "POST",',
    `          path: \`${organizationPath}\` as never`,
    "        })",
    "      );",
    "    },",
    "    async get(organizationId: string, id: string) {",
    `      return ${context.resource.resource}RecordSchema.parse(`,
    "        await apiClient.request({",
    `          path: \`${organizationPath}/${"${id}"}\` as never`,
    "        })",
    "      );",
    "    },",
    "    async list(organizationId: string) {",
    `      return ${context.resource.resource}ListResponseSchema.parse(`,
    "        await apiClient.request({",
    `          path: \`${organizationPath}\` as never`,
    "        })",
    "      );",
    "    },",
    "    async update(organizationId: string, id: string, body: Record<string, unknown>) {",
    `      return ${context.resource.resource}RecordSchema.parse(`,
    "        await apiClient.request({",
    "          body,",
    '          method: "PATCH",',
    `          path: \`${organizationPath}/${"${id}"}\` as never`,
    "        })",
    "      );",
    "    }",
    "  };",
    "}"
  ].join("\n");
}

function renderWebDomainSchemas(context: ReturnType<typeof createTemplateContext>) {
  const fieldLines = context.resource.fields
    .map((field) => `  ${field.name}: ${renderZodField(field)}`)
    .join(",\n");

  return [
    'import { z } from "zod";',
    "",
    `export const ${context.resource.resource}RecordSchema = z.object({`,
    '  id: z.string().uuid(),',
    '  organizationId: z.string().uuid(),',
    `${fieldLines},`,
    '  createdAt: z.string().datetime(),',
    '  updatedAt: z.string().datetime()',
    "});",
    "",
    `export type ${context.pascalName}Record = z.infer<typeof ${context.resource.resource}RecordSchema>;`
  ].join("\n");
}

function renderWebScreen(context: ReturnType<typeof createTemplateContext>) {
  return [
    `import type { ${context.pascalName}Record } from "../domain/schemas.js";`,
    "",
    `import { ${context.pascalName}EmptyState } from "./${context.resourcePath}-empty-state.js";`,
    `import { ${context.pascalName}Table } from "./${context.resourcePath}-table.js";`,
    "",
    `export function ${context.pascalName}Screen(input: {`,
    `  items: readonly ${context.pascalName}Record[];`,
    "}) {",
    "  if (input.items.length === 0) {",
    `    return <${context.pascalName}EmptyState />;`,
    "  }",
    "",
    `  return <${context.pascalName}Table items={input.items} />;`,
    "}"
  ].join("\n");
}

function renderWebForm(context: ReturnType<typeof createTemplateContext>) {
  const formFields = context.createFields.map((field) => {
    const label = field.label ?? toLabel(field.name);

    return [
      "      <label key={" + JSON.stringify(field.name) + "} className=\"flex flex-col gap-2\">",
      `        <span>${label}</span>`,
      `        <input name="${field.name}" type="${renderHtmlInputType(field.type)}" />`,
      "      </label>"
    ].join("\n");
  });

  return [
    "export function " + context.pascalName + "Form() {",
    '  return (',
    '    <form className="grid gap-4">',
    ...formFields,
    '      <button type="submit">Save ' + context.label + "</button>",
    "    </form>",
    "  );",
    "}"
  ].join("\n");
}

function renderWebTable(context: ReturnType<typeof createTemplateContext>) {
  const headers = context.resource.fields
    .map((field) => `          <th>${field.label ?? toLabel(field.name)}</th>`)
    .join("\n");
  const cells = context.resource.fields
    .map((field) => `            <td>{item.${field.name}?.toString()}</td>`)
    .join("\n");

  return [
    `import type { ${context.pascalName}Record } from "../domain/schemas.js";`,
    "",
    `export function ${context.pascalName}Table(input: {`,
    `  items: readonly ${context.pascalName}Record[];`,
    "}) {",
    "  return (",
    "    <table>",
    "      <thead>",
    "        <tr>",
    headers,
    "        </tr>",
    "      </thead>",
    "      <tbody>",
    "        {input.items.map((item) => (",
    "          <tr key={item.id}>",
    cells,
    "          </tr>",
    "        ))}",
    "      </tbody>",
    "    </table>",
    "  );",
    "}"
  ].join("\n");
}

function renderWebEmptyState(context: ReturnType<typeof createTemplateContext>) {
  return [
    `export function ${context.pascalName}EmptyState() {`,
    "  return (",
    '    <section className="rounded-lg border border-dashed p-6">',
    `      <h2>No ${context.pluralLabel.toLowerCase()} yet</h2>`,
    `      <p>Create the first ${context.label.toLowerCase()} to validate the generated CRUD seam.</p>`,
    "    </section>",
    "  );",
    "}"
  ].join("\n");
}

function renderWebScreenTest(context: ReturnType<typeof createTemplateContext>) {
  return [
    'import { render, screen } from "@testing-library/react";',
    'import { describe, expect, it } from "vitest";',
    "",
    `import { ${context.pascalName}Screen } from "../components/${context.resourcePath}-screen.js";`,
    "",
    `describe("${context.pascalName}Screen", () => {`,
    `  it("renders the empty state when no ${context.pluralLabel.toLowerCase()} exist", () => {`,
    `    render(<${context.pascalName}Screen items={[]} />);`,
    "",
    `    expect(screen.getByText("No ${context.pluralLabel.toLowerCase()} yet")).toBeInTheDocument();`,
    "  });",
    "});"
  ].join("\n");
}

function renderWebClientTest(context: ReturnType<typeof createTemplateContext>) {
  return [
    'import { describe, expect, it } from "vitest";',
    "",
    'import type { ApiClient, ApiRequestOptions } from "@/src/lib/api/api-client";',
    `import { createResourceClient } from "../api/${context.resourcePath}-client.js";`,
    "",
    'describe("createResourceClient", () => {',
    `  it("loads ${context.pluralLabel.toLowerCase()} through the API client", async () => {`,
    "    const requests: unknown[] = [];",
    `    const client = createResourceClient(createRecordingApiClient(requests, { items: [] }));`,
    "",
    '    await client.list("00000000-0000-0000-0000-000000000001");',
    "",
    "    expect(requests).toHaveLength(1);",
    "  });",
    "});",
    "",
    "function createRecordingApiClient(",
    "  requests: unknown[],",
    "  response: unknown",
    "): ApiClient {",
    "  return {",
    "    async raw(options: ApiRequestOptions) {",
    "      requests.push(options);",
    "      return new Response(JSON.stringify(response), {",
    '        headers: { "content-type": "application/json" },',
    "        status: 200",
    "      });",
    "    },",
    "    async request<TResponse>(options: ApiRequestOptions) {",
    "      requests.push(options);",
    "      return response as TResponse;",
    "    }",
    "  };",
    "}"
  ].join("\n");
}

function renderWebListPage(context: ReturnType<typeof createTemplateContext>) {
  return [
    `import { ${context.pascalName}Screen } from "@/src/features/${context.resourcePath}/components/${context.resourcePath}-screen";`,
    "",
    "export default function Page() {",
    `  return <${context.pascalName}Screen items={[]} />;`,
    "}"
  ].join("\n");
}

function renderWebCreatePage(context: ReturnType<typeof createTemplateContext>) {
  return [
    `import { ${context.pascalName}Form } from "@/src/features/${context.resourcePath}/components/${context.resourcePath}-form";`,
    "",
    "export default function Page() {",
    `  return <${context.pascalName}Form />;`,
    "}"
  ].join("\n");
}

function renderWebDetailPage(context: ReturnType<typeof createTemplateContext>) {
  return [
    `import { ${context.pascalName}EmptyState } from "@/src/features/${context.resourcePath}/components/${context.resourcePath}-empty-state";`,
    "",
    "export default function Page() {",
    `  return <${context.pascalName}EmptyState />;`,
    "}"
  ].join("\n");
}

function renderWebEditPage(context: ReturnType<typeof createTemplateContext>) {
  return [
    `import { ${context.pascalName}Form } from "@/src/features/${context.resourcePath}/components/${context.resourcePath}-form";`,
    "",
    "export default function Page() {",
    `  return <${context.pascalName}Form />;`,
    "}"
  ].join("\n");
}

function renderResourceDocs(context: ReturnType<typeof createTemplateContext>) {
  const fields = context.resource.fields
    .map(
      (field) =>
        `- \`${field.name}\`: \`${field.type}\`${field.required ? " required" : ""}`
    )
    .join("\n");
  const plannedWrites = context.plan.generatedFiles
    .filter(
      (file) => file.templateId && supportedTemplateIds.has(file.templateId)
    )
    .map((file) => `- \`${file.path}\``)
    .join("\n");

  return [
    `# ${context.label} Resource Preview`,
    "",
    `This preview was generated from a validated \`${context.resource.resource}\` resource spec.`,
    "",
    "## Supported assumptions",
    "",
    "- ownership: `organization`",
    "- CRUD: `list`, `create`, `read`, `update`",
    "- delete generation: unsupported in the first generator",
    "- output mode: preview-only under `.generated/` or `tmp/`",
    "",
    "## Fields",
    "",
    fields,
    "",
    "## Generated file groups",
    "",
    plannedWrites,
    "",
    "## Manual follow-up",
    "",
    "- add domain and DB barrel exports if this preview is promoted into real repo source",
    "- register routes intentionally instead of copying generated preview files into `apps/api/src/app.ts` blindly",
    "- write a real migration after picking the next migration identifier"
  ].join("\n");
}

function renderCustomizationDocs(context: ReturnType<typeof createTemplateContext>) {
  return [
    `# ${context.label} CUSTOMIZE`,
    "",
    "This preview is intentionally safe and incomplete. Treat it as generated scaffolding, not as a drop-in runtime slice.",
    "",
    "## Safe customization points",
    "",
    `- business rules: \`apps/api/src/modules/generated/${context.resourcePath}/service.ts\``,
    `- persistence queries: \`apps/api/src/modules/generated/${context.resourcePath}/postgres-repo.ts\``,
    `- request validation and route shaping: \`apps/api/src/modules/generated/${context.resourcePath}/routes.ts\``,
    `- UI copy and layout: \`apps/web/src/features/${context.resourcePath}/components/*\``,
    "",
    "## Ownership assumptions",
    "",
    "- every CRUD call is organization-scoped",
    "- generated preview files assume organization IDs are required at every API boundary",
    "- product navigation is intentionally not wired automatically in this first generator",
    "",
    "## Regeneration guidance",
    "",
    "- avoid hand-editing generated schema boilerplate if you plan to regenerate from the same spec",
    "- prefer layering business logic into service and adapter files after review",
    "- do not copy the preview directly into runtime without adding barrel exports, route registration, and a real migration",
    "",
    "## Checks to run after promotion",
    "",
    ...context.plan.checks.map((check) => `- \`${check.command}\``)
  ].join("\n");
}

function flattenPlanEntries(plan: ResourcePlanReport) {
  return Object.values(plan.groups)
    .flat()
    .sort((left, right) => left.path.localeCompare(right.path));
}

function countFilesByGroup(files: readonly ResourceGeneratorFile[]) {
  return {
    api: files.filter((file) => file.group === "api").length,
    db: files.filter((file) => file.group === "db").length,
    docs: files.filter((file) => file.group === "docs").length,
    domain: files.filter((file) => file.group === "domain").length,
    web: files.filter((file) => file.group === "web").length
  } as const;
}

function getPluralPath(resource: FrameworkResourceSpec) {
  const segments = resource.api.prefix.split("/").filter(Boolean);

  return segments.at(-1) ?? `${toKebabCase(resource.resource)}s`;
}

function getDrizzleImport(type: FrameworkResourceSpec["fields"][number]["type"]) {
  switch (type) {
    case "boolean":
      return "boolean";
    case "datetime":
      return "timestamp";
    case "uuid":
      return "uuid";
    default:
      return "text";
  }
}

function renderDbColumn(field: FrameworkResourceSpec["fields"][number]) {
  const notNullSuffix = field.required ? ".notNull()" : "";
  const uniqueSuffix = field.unique ? ".unique()" : "";

  switch (field.type) {
    case "boolean":
      return `boolean("${toSnakeCase(field.name)}")${notNullSuffix}${uniqueSuffix},`;
    case "datetime":
      return `timestamp("${toSnakeCase(field.name)}", { withTimezone: true })${notNullSuffix}${uniqueSuffix},`;
    case "uuid":
      return `uuid("${toSnakeCase(field.name)}")${notNullSuffix}${uniqueSuffix},`;
    default:
      return `text("${toSnakeCase(field.name)}")${notNullSuffix}${uniqueSuffix},`;
  }
}

function renderDbValueAssignment(input: {
  accessPath: string;
  field: FrameworkResourceSpec["fields"][number];
  mode: "create" | "update";
}) {
  const expression = renderDbWriteValue(input.accessPath, input.field);

  if (input.mode === "update") {
    return `        ${input.field.name}: ${input.accessPath} !== undefined ? ${expression} : undefined,`;
  }

  return `        ${input.field.name}: ${expression},`;
}

function renderDbWriteValue(
  accessPath: string,
  field: FrameworkResourceSpec["fields"][number]
) {
  switch (field.type) {
    case "datetime":
      return `${accessPath} ? new Date(${accessPath}) : undefined`;
    default:
      return accessPath;
  }
}

function renderRecordValue(
  context: ReturnType<typeof createTemplateContext>,
  field: FrameworkResourceSpec["fields"][number]
) {
  switch (field.type) {
    case "datetime":
      return `record.${field.name}?.toISOString()`;
    case "enum":
      return `record.${field.name} as ${context.pascalName}Record["${field.name}"]`;
    default:
      return field.required
        ? `record.${field.name}`
        : `record.${field.name} ?? undefined`;
  }
}

function renderZodField(field: FrameworkResourceSpec["fields"][number]) {
  let expression: string;

  switch (field.type) {
    case "boolean":
      expression = "z.boolean()";
      break;
    case "datetime":
      expression = "z.string().datetime()";
      break;
    case "email":
      expression = "z.string().email()";
      break;
    case "enum":
      expression = `z.enum([${(field.values ?? [])
        .map((value) => JSON.stringify(value))
        .join(", ")}])`;
      break;
    case "text":
      expression = "z.string().trim().min(1)";
      break;
    case "uuid":
      expression = "z.string().uuid()";
      break;
    default:
      expression = "z.string().trim().min(1)";
      break;
  }

  if (!field.required) {
    expression += ".optional()";
  }

  return expression;
}

function renderZodOptionalField(field: FrameworkResourceSpec["fields"][number]) {
  const requiredVersion = renderZodField({
    ...field,
    required: true
  });

  return `${requiredVersion}.optional()`;
}

function renderHtmlInputType(
  type: FrameworkResourceSpec["fields"][number]["type"]
) {
  switch (type) {
    case "boolean":
      return "checkbox";
    case "datetime":
      return "datetime-local";
    case "email":
      return "email";
    default:
      return "text";
  }
}

function renderObjectLiteralFields(
  fields: readonly FrameworkResourceSpec["fields"][number][]
) {
  return fields
    .map((field) => `          ${field.name}: ${JSON.stringify(getExampleValue(field))},`)
    .join("\n");
}

function renderCreateInputObject(
  fields: readonly FrameworkResourceSpec["fields"][number][]
) {
  return fields
    .map((field) => `        ${field.name}: ${JSON.stringify(getExampleValue(field))},`)
    .join("\n");
}

function renderExpectedFieldObject(
  fields: readonly FrameworkResourceSpec["fields"][number][]
) {
  return fields
    .map((field) => `      ${field.name}: ${JSON.stringify(getExampleValue(field))},`)
    .join("\n");
}

function getExampleValue(field: FrameworkResourceSpec["fields"][number]) {
  if (field.default !== undefined) {
    return field.default;
  }

  switch (field.type) {
    case "boolean":
      return true;
    case "datetime":
      return "2026-06-29T00:00:00.000Z";
    case "email":
      return "person@example.com";
    case "enum":
      return field.values?.[0] ?? "value";
    case "uuid":
      return "11111111-1111-4111-8111-111111111111";
    default:
      return `${field.name} value`;
  }
}

function getAlternateExampleValue(
  field: FrameworkResourceSpec["fields"][number]
) {
  switch (field.type) {
    case "boolean":
      return !Boolean(getExampleValue(field));
    case "datetime":
      return "2026-07-01T12:00:00.000Z";
    case "email":
      return "updated@example.com";
    case "enum":
      return field.values?.[1] ?? field.values?.[0] ?? "value";
    case "uuid":
      return "22222222-2222-4222-8222-222222222222";
    default:
      return `updated ${field.name} value`;
  }
}

function joinOutputPath(root: string, path: string) {
  return `${root.replace(/\/$/, "")}/${path}`.replace(/\\/g, "/");
}

function ensureTrailingNewline(value: string) {
  return value.endsWith("\n") ? value : `${value}\n`;
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
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
    .join("");
}

function toSnakeCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/-/g, "_")
    .toLowerCase();
}

function toLabel(value: string) {
  return toKebabCase(value)
    .split("-")
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
    .join(" ");
}
