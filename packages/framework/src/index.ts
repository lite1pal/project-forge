import { z } from "zod";

const nonEmptyStringSchema = z.string().trim().min(1);
const tsIdentifierPattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const resourceNamePattern = /^(?:[a-z][a-z0-9]*(?:-[a-z0-9]+)*|[a-z][A-Za-z0-9]*)$/;
export const frameworkModuleKinds = [
  "platform-core",
  "platform-extension",
  "product",
  "integration",
  "generated-resource",
  "generated-job",
  "generated-ui",
  "tooling"
] as const;

export type FrameworkModuleKind = (typeof frameworkModuleKinds)[number];

export const frameworkOwnershipModes = [
  "organization",
  "user",
  "global",
  "none"
] as const;

export type FrameworkOwnershipMode = (typeof frameworkOwnershipModes)[number];

export const frameworkFieldTypes = [
  "string",
  "text",
  "email",
  "url",
  "number",
  "integer",
  "boolean",
  "date",
  "datetime",
  "enum",
  "json",
  "uuid"
] as const;

export type FrameworkFieldType = (typeof frameworkFieldTypes)[number];

export const frameworkCrudFlags = [
  "list",
  "create",
  "read",
  "update",
  "delete"
] as const;

export type FrameworkCrudFlag = (typeof frameworkCrudFlags)[number];

export const frameworkPermissionLevels = [
  "none",
  "read",
  "write",
  "admin"
] as const;

export type FrameworkPermissionLevel =
  (typeof frameworkPermissionLevels)[number];

export const frameworkReservedResourceNames = [
  "user",
  "organization",
  "membership",
  "session",
  "apiKey",
  "billing",
  "entitlement",
  "support",
  "auditEvent"
] as const;

export const frameworkGeneratedFileActions = [
  "create",
  "update",
  "delete"
] as const;

export type FrameworkGeneratedFileAction =
  (typeof frameworkGeneratedFileActions)[number];

export const frameworkRouteMethods = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE"
] as const;

export type FrameworkRouteMethod = (typeof frameworkRouteMethods)[number];

export const frameworkRouteAuthStrategies = [
  "public",
  "session",
  "api-key",
  "internal"
] as const;

export type FrameworkRouteAuthStrategy =
  (typeof frameworkRouteAuthStrategies)[number];

export type FrameworkJsonValue =
  | boolean
  | null
  | number
  | string
  | FrameworkJsonObject
  | FrameworkJsonValue[];

export interface FrameworkJsonObject {
  [key: string]: FrameworkJsonValue;
}

export interface FrameworkOwnershipDefinition {
  mode: FrameworkOwnershipMode;
  ownerField?: string;
}

export interface FrameworkFieldDefinition {
  defaultValue?: FrameworkJsonValue;
  description?: string;
  enumValues?: readonly string[];
  list?: boolean;
  name: string;
  nullable?: boolean;
  required: boolean;
  type: FrameworkFieldType;
  unique?: boolean;
}

export interface FrameworkCrudDefinition {
  enabledOperations: readonly FrameworkCrudFlag[];
  routeBasePath?: string;
  uiBasePath?: string;
}

export interface FrameworkRouteDefinition {
  authStrategy?: FrameworkRouteAuthStrategy;
  id: string;
  method: FrameworkRouteMethod;
  path: string;
  resourceId?: string;
}

export interface FrameworkCheckDefinition {
  appliesToPaths: readonly string[];
  command: string;
  id: string;
  required: boolean;
}

export interface FrameworkModuleDefinition {
  description?: string;
  id: string;
  kind: FrameworkModuleKind;
  resourceIds: readonly string[];
  rootPath: string;
}

export interface FrameworkResourceDefinition {
  crud?: FrameworkCrudDefinition;
  description?: string;
  fields: readonly FrameworkFieldDefinition[];
  id: string;
  moduleId: string;
  moduleKind: FrameworkModuleKind;
  name: string;
  ownership: FrameworkOwnershipDefinition;
  routes?: readonly FrameworkRouteDefinition[];
}

export interface FrameworkGeneratedFilePlan {
  action: FrameworkGeneratedFileAction;
  moduleKind: FrameworkModuleKind;
  path: string;
  reason: string;
  requiresManualReview: boolean;
  templateId?: string;
}

export interface FrameworkAgentTaskDefinition {
  allowedPaths: readonly string[];
  contextFiles: readonly string[];
  forbiddenPaths: readonly string[];
  goal: string;
  id: string;
  reportFields: readonly string[];
  requiredChecks: readonly string[];
  stopConditions: readonly string[];
  taskType: string;
}

export interface FrameworkAgentContextDefinition {
  checkIds: readonly string[];
  contextFiles: readonly string[];
  moduleIds: readonly string[];
  resourceIds: readonly string[];
  summary: string;
  taskIds: readonly string[];
}

export interface FrameworkGeneratorPlan {
  agentContext: FrameworkAgentContextDefinition;
  agentTasks: readonly FrameworkAgentTaskDefinition[];
  checks: readonly FrameworkCheckDefinition[];
  generatedFiles: readonly FrameworkGeneratedFilePlan[];
  modules: readonly FrameworkModuleDefinition[];
  resources: readonly FrameworkResourceDefinition[];
}

export const frameworkModuleKindSchema = z.enum(frameworkModuleKinds);

export const frameworkOwnershipModeSchema = z.enum(frameworkOwnershipModes);

export const frameworkFieldTypeSchema = z.enum(frameworkFieldTypes);

export const frameworkCrudFlagSchema = z.enum(frameworkCrudFlags);

export const frameworkPermissionLevelSchema = z.enum(frameworkPermissionLevels);

export const frameworkGeneratedFileActionSchema = z.enum(
  frameworkGeneratedFileActions
);

export const frameworkRouteMethodSchema = z.enum(frameworkRouteMethods);

export const frameworkRouteAuthStrategySchema = z.enum(
  frameworkRouteAuthStrategies
);

export const frameworkJsonValueSchema: z.ZodType<FrameworkJsonValue> = z.lazy(
  () =>
    z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.null(),
      z.array(frameworkJsonValueSchema),
      z.record(z.string(), frameworkJsonValueSchema)
    ])
);

export const frameworkOwnershipDefinitionSchema = z
  .object({
    mode: frameworkOwnershipModeSchema,
    ownerField: nonEmptyStringSchema.optional()
  })
  .superRefine((value, context) => {
    const requiresOwnerField =
      value.mode === "organization" || value.mode === "user";

    if (requiresOwnerField && !value.ownerField) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "organization and user ownership must declare an ownerField",
        path: ["ownerField"]
      });
    }

    if (!requiresOwnerField && value.ownerField) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "global and none ownership must not declare an ownerField",
        path: ["ownerField"]
      });
    }
  }) satisfies z.ZodType<FrameworkOwnershipDefinition>;

export const frameworkFieldDefinitionSchema = z
  .object({
    defaultValue: frameworkJsonValueSchema.optional(),
    description: nonEmptyStringSchema.optional(),
    enumValues: z.array(nonEmptyStringSchema).min(1).optional(),
    list: z.boolean().optional(),
    name: nonEmptyStringSchema,
    nullable: z.boolean().optional(),
    required: z.boolean(),
    type: frameworkFieldTypeSchema,
    unique: z.boolean().optional()
  })
  .superRefine((value, context) => {
    if (value.type === "enum" && !value.enumValues) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "enum fields must declare enumValues",
        path: ["enumValues"]
      });
    }

    if (value.type !== "enum" && value.enumValues) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "enumValues are allowed only for enum fields",
        path: ["enumValues"]
      });
    }
  }) satisfies z.ZodType<FrameworkFieldDefinition>;

export const frameworkCrudDefinitionSchema = z.object({
  enabledOperations: z.array(frameworkCrudFlagSchema).min(1),
  routeBasePath: nonEmptyStringSchema.optional(),
  uiBasePath: nonEmptyStringSchema.optional()
}) satisfies z.ZodType<FrameworkCrudDefinition>;

export const frameworkRouteDefinitionSchema = z.object({
  authStrategy: frameworkRouteAuthStrategySchema.optional(),
  id: nonEmptyStringSchema,
  method: frameworkRouteMethodSchema,
  path: nonEmptyStringSchema,
  resourceId: nonEmptyStringSchema.optional()
}) satisfies z.ZodType<FrameworkRouteDefinition>;

export const frameworkCheckDefinitionSchema = z.object({
  appliesToPaths: z.array(nonEmptyStringSchema),
  command: nonEmptyStringSchema,
  id: nonEmptyStringSchema,
  required: z.boolean()
}) satisfies z.ZodType<FrameworkCheckDefinition>;

export const frameworkModuleDefinitionSchema = z.object({
  description: nonEmptyStringSchema.optional(),
  id: nonEmptyStringSchema,
  kind: frameworkModuleKindSchema,
  resourceIds: z.array(nonEmptyStringSchema),
  rootPath: nonEmptyStringSchema
}) satisfies z.ZodType<FrameworkModuleDefinition>;

export const frameworkResourceDefinitionSchema = z.object({
  crud: frameworkCrudDefinitionSchema.optional(),
  description: nonEmptyStringSchema.optional(),
  fields: z.array(frameworkFieldDefinitionSchema).min(1),
  id: nonEmptyStringSchema,
  moduleId: nonEmptyStringSchema,
  moduleKind: frameworkModuleKindSchema,
  name: nonEmptyStringSchema,
  ownership: frameworkOwnershipDefinitionSchema,
  routes: z.array(frameworkRouteDefinitionSchema).optional()
}) satisfies z.ZodType<FrameworkResourceDefinition>;

const frameworkFieldNameSchema = z
  .string()
  .trim()
  .regex(tsIdentifierPattern, "field names must be valid TypeScript identifiers");

const frameworkRoleNameSchema = z
  .string()
  .trim()
  .regex(
    tsIdentifierPattern,
    "permission role names must be valid TypeScript identifiers"
  );

export const frameworkResourceFieldSpecSchema = z
  .object({
    default: frameworkJsonValueSchema.optional(),
    description: nonEmptyStringSchema.optional(),
    hidden: z.boolean().optional(),
    label: nonEmptyStringSchema.optional(),
    max: z.number().finite().optional(),
    maxLength: z.int().positive().optional(),
    min: z.number().finite().optional(),
    minLength: z.int().nonnegative().optional(),
    name: frameworkFieldNameSchema,
    readonly: z.boolean().optional(),
    required: z.boolean().optional(),
    searchable: z.boolean().optional(),
    sortable: z.boolean().optional(),
    type: frameworkFieldTypeSchema,
    unique: z.boolean().optional(),
    values: z.array(nonEmptyStringSchema).min(1).optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.type === "enum" && !value.values) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "enum fields must define a non-empty values array",
        path: ["values"]
      });
    }

    if (value.type !== "enum" && value.values) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "only enum fields may define values",
        path: ["values"]
      });
    }

    if (
      (value.minLength !== undefined || value.maxLength !== undefined) &&
      !isStringLikeFieldType(value.type)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "minLength and maxLength are allowed only for string-like fields",
        path: ["type"]
      });
    }

    if (
      (value.min !== undefined || value.max !== undefined) &&
      !isNumericFieldType(value.type)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "min and max are allowed only for numeric fields",
        path: ["type"]
      });
    }

    if (
      value.minLength !== undefined &&
      value.maxLength !== undefined &&
      value.minLength > value.maxLength
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "minLength must be less than or equal to maxLength",
        path: ["minLength"]
      });
    }

    if (
      value.min !== undefined &&
      value.max !== undefined &&
      value.min > value.max
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "min must be less than or equal to max",
        path: ["min"]
      });
    }

    validateFieldDefaultValue(value, context);
  });

export const frameworkResourceCrudSpecSchema = z
  .object({
    create: z.boolean().optional(),
    delete: z.boolean().optional(),
    list: z.boolean().optional(),
    read: z.boolean().optional(),
    update: z.boolean().optional()
  })
  .strict();

export const frameworkResourceApiSpecSchema = z
  .object({
    filters: z.array(frameworkFieldNameSchema).optional(),
    pagination: z.boolean().optional(),
    prefix: nonEmptyStringSchema.optional(),
    public: z.boolean().optional(),
    version: nonEmptyStringSchema.optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.prefix !== undefined && !value.prefix.startsWith("/")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "API prefix must start with /",
        path: ["prefix"]
      });
    }
  });

export const frameworkResourceUiSpecSchema = z
  .object({
    createPage: z.boolean().optional(),
    detailPage: z.boolean().optional(),
    editPage: z.boolean().optional(),
    emptyStateDescription: nonEmptyStringSchema.optional(),
    emptyStateTitle: nonEmptyStringSchema.optional(),
    listPage: z.boolean().optional(),
    nav: z.boolean().optional(),
    navLabel: nonEmptyStringSchema.optional()
  })
  .strict();

export const frameworkResourcePermissionsSpecSchema = z.record(
  frameworkRoleNameSchema,
  frameworkPermissionLevelSchema
);

export const frameworkResourceIndexSpecSchema = z
  .object({
    fields: z.array(frameworkFieldNameSchema).min(1),
    name: nonEmptyStringSchema.optional(),
    unique: z.boolean().optional()
  })
  .strict()
  .superRefine((value, context) => {
    const duplicates = findDuplicates(value.fields);

    if (duplicates.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `index fields must be unique: ${duplicates.join(", ")}`,
        path: ["fields"]
      });
    }
  });

export const frameworkResourceTimestampsSpecSchema = z
  .object({
    createdAtField: frameworkFieldNameSchema.optional(),
    enabled: z.boolean().optional(),
    updatedAtField: frameworkFieldNameSchema.optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.enabled === false) {
      if (value.createdAtField) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "createdAtField cannot be set when timestamps are disabled",
          path: ["createdAtField"]
        });
      }

      if (value.updatedAtField) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "updatedAtField cannot be set when timestamps are disabled",
          path: ["updatedAtField"]
        });
      }
    }
  });

export const frameworkResourceSpecInputSchema = z
  .object({
    api: frameworkResourceApiSpecSchema.optional(),
    crud: frameworkResourceCrudSpecSchema.optional(),
    description: nonEmptyStringSchema.optional(),
    fields: z.array(frameworkResourceFieldSpecSchema).min(1),
    indexes: z.array(frameworkResourceIndexSpecSchema).optional(),
    label: nonEmptyStringSchema,
    ownership: frameworkOwnershipModeSchema,
    permissions: frameworkResourcePermissionsSpecSchema.optional(),
    pluralLabel: nonEmptyStringSchema.optional(),
    resource: z
      .string()
      .trim()
      .regex(
        resourceNamePattern,
        "resource names must be lower camelCase or lowercase kebab-case"
      ),
    timestamps: z.union([z.boolean(), frameworkResourceTimestampsSpecSchema]).optional(),
    ui: frameworkResourceUiSpecSchema.optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (isReservedResourceName(value.resource)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "resource name is reserved by the platform",
        path: ["resource"]
      });
    }

    const duplicateFields = findDuplicates(value.fields.map((field) => field.name));

    if (duplicateFields.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `field names must be unique: ${duplicateFields.join(", ")}`,
        path: ["fields"]
      });
    }

    for (const [index, resourceIndex] of (value.indexes ?? []).entries()) {
      for (const fieldName of resourceIndex.fields) {
        if (!value.fields.some((field) => field.name === fieldName)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `index references unknown field ${fieldName}`,
            path: ["indexes", index, "fields"]
          });
        }
      }
    }

    for (const fieldName of value.api?.filters ?? []) {
      if (!value.fields.some((field) => field.name === fieldName)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `API filter references unknown field ${fieldName}`,
          path: ["api", "filters"]
        });
      }
    }
  });

export type FrameworkResourceFieldSpec = z.infer<
  typeof frameworkResourceFieldSpecSchema
>;
export type FrameworkResourceCrudSpec = z.infer<
  typeof frameworkResourceCrudSpecSchema
>;
export type FrameworkResourceApiSpec = z.infer<typeof frameworkResourceApiSpecSchema>;
export type FrameworkResourceUiSpec = z.infer<typeof frameworkResourceUiSpecSchema>;
export type FrameworkResourcePermissionsSpec = z.infer<
  typeof frameworkResourcePermissionsSpecSchema
>;
export type FrameworkResourceIndexSpec = z.infer<
  typeof frameworkResourceIndexSpecSchema
>;
export type FrameworkResourceTimestampsSpec = z.infer<
  typeof frameworkResourceTimestampsSpecSchema
>;
export type FrameworkResourceSpecInput = z.input<
  typeof frameworkResourceSpecInputSchema
>;

const normalizedFrameworkResourceFieldSpecSchema = z
  .object({
    default: frameworkJsonValueSchema.optional(),
    description: nonEmptyStringSchema.optional(),
    hidden: z.boolean(),
    label: nonEmptyStringSchema.optional(),
    max: z.number().finite().optional(),
    maxLength: z.int().positive().optional(),
    min: z.number().finite().optional(),
    minLength: z.int().nonnegative().optional(),
    name: frameworkFieldNameSchema,
    readonly: z.boolean(),
    required: z.boolean(),
    searchable: z.boolean(),
    sortable: z.boolean(),
    type: frameworkFieldTypeSchema,
    unique: z.boolean(),
    values: z.array(nonEmptyStringSchema).min(1).optional()
  })
  .strict();

const normalizedFrameworkResourceCrudSpecSchema = z
  .object({
    create: z.boolean(),
    delete: z.boolean(),
    list: z.boolean(),
    read: z.boolean(),
    update: z.boolean()
  })
  .strict()
  .superRefine((value, context) => {
    if (!Object.values(value).some(Boolean)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "at least one CRUD operation must be enabled"
      });
    }
  });

const normalizedFrameworkResourceApiSpecSchema = z
  .object({
    filters: z.array(frameworkFieldNameSchema),
    pagination: z.boolean(),
    prefix: nonEmptyStringSchema,
    public: z.boolean(),
    version: nonEmptyStringSchema.optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.prefix.startsWith("/")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "API prefix must start with /",
        path: ["prefix"]
      });
    }
  });

const normalizedFrameworkResourceUiSpecSchema = z
  .object({
    createPage: z.boolean(),
    detailPage: z.boolean(),
    editPage: z.boolean(),
    emptyStateDescription: nonEmptyStringSchema.optional(),
    emptyStateTitle: nonEmptyStringSchema.optional(),
    listPage: z.boolean(),
    nav: z.boolean(),
    navLabel: nonEmptyStringSchema
  })
  .strict();

const normalizedFrameworkResourceTimestampsSpecSchema = z
  .object({
    createdAtField: frameworkFieldNameSchema.optional(),
    enabled: z.boolean(),
    updatedAtField: frameworkFieldNameSchema.optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.enabled) {
      if (!value.createdAtField) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "createdAtField is required when timestamps are enabled",
          path: ["createdAtField"]
        });
      }

      if (!value.updatedAtField) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "updatedAtField is required when timestamps are enabled",
          path: ["updatedAtField"]
        });
      }
    }

    if (!value.enabled) {
      if (value.createdAtField) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "createdAtField cannot be set when timestamps are disabled",
          path: ["createdAtField"]
        });
      }

      if (value.updatedAtField) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "updatedAtField cannot be set when timestamps are disabled",
          path: ["updatedAtField"]
        });
      }
    }
  });

export const normalizedFrameworkResourceSpecSchema = z
  .object({
    api: normalizedFrameworkResourceApiSpecSchema,
    crud: normalizedFrameworkResourceCrudSpecSchema,
    description: nonEmptyStringSchema.optional(),
    fields: z.array(normalizedFrameworkResourceFieldSpecSchema).min(1),
    indexes: z.array(frameworkResourceIndexSpecSchema),
    label: nonEmptyStringSchema,
    ownership: frameworkOwnershipModeSchema,
    permissions: frameworkResourcePermissionsSpecSchema,
    pluralLabel: nonEmptyStringSchema,
    resource: z
      .string()
      .trim()
      .regex(
        resourceNamePattern,
        "resource names must be lower camelCase or lowercase kebab-case"
      ),
    timestamps: normalizedFrameworkResourceTimestampsSpecSchema,
    ui: normalizedFrameworkResourceUiSpecSchema
  })
  .strict()
  .superRefine((value, context) => {
    if (isReservedResourceName(value.resource)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "resource name is reserved by the platform",
        path: ["resource"]
      });
    }

    const duplicateFields = findDuplicates(value.fields.map((field) => field.name));

    if (duplicateFields.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `field names must be unique: ${duplicateFields.join(", ")}`,
        path: ["fields"]
      });
    }

    for (const [index, resourceIndex] of value.indexes.entries()) {
      for (const fieldName of resourceIndex.fields) {
        if (!value.fields.some((field) => field.name === fieldName)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `index references unknown field ${fieldName}`,
            path: ["indexes", index, "fields"]
          });
        }
      }
    }

    for (const fieldName of value.api.filters) {
      if (!value.fields.some((field) => field.name === fieldName)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `API filter references unknown field ${fieldName}`,
          path: ["api", "filters"]
        });
      }
    }
  });

export type FrameworkResourceSpec = z.infer<
  typeof normalizedFrameworkResourceSpecSchema
>;

export function normalizeFrameworkResourceSpec(
  input: FrameworkResourceSpecInput
): FrameworkResourceSpec {
  const crud = {
    list: input.crud?.list ?? true,
    create: input.crud?.create ?? true,
    read: input.crud?.read ?? true,
    update: input.crud?.update ?? true,
    delete: input.crud?.delete ?? false
  };
  const pluralLabel = input.pluralLabel ?? pluralizeLabel(input.label);
  const pathSegment = pluralizePathSegment(toKebabCase(input.resource));
  const fields = input.fields.map((field) => ({
    ...field,
    hidden: field.hidden ?? false,
    readonly: field.readonly ?? false,
    required: field.required ?? false,
    searchable: field.searchable ?? false,
    sortable: field.sortable ?? false,
    unique: field.unique ?? false
  }));
  const ui = {
    createPage: input.ui?.createPage ?? crud.create,
    detailPage: input.ui?.detailPage ?? crud.read,
    editPage: input.ui?.editPage ?? crud.update,
    emptyStateDescription: input.ui?.emptyStateDescription,
    emptyStateTitle: input.ui?.emptyStateTitle,
    listPage: input.ui?.listPage ?? crud.list,
    nav: input.ui?.nav ?? crud.list,
    navLabel: input.ui?.navLabel ?? pluralLabel
  };

  return normalizedFrameworkResourceSpecSchema.parse({
    api: {
      filters: input.api?.filters ?? [],
      pagination: input.api?.pagination ?? crud.list,
      prefix: input.api?.prefix ?? `/v1/${pathSegment}`,
      public: input.api?.public ?? false,
      version: input.api?.version
    },
    crud,
    description: input.description,
    fields,
    indexes: input.indexes ?? [],
    label: input.label,
    ownership: input.ownership,
    permissions: input.permissions ?? {},
    pluralLabel,
    resource: input.resource,
    timestamps: normalizeTimestamps(input.timestamps),
    ui
  });
}

export const frameworkResourceSpecSchema = z.preprocess(
  (value) => normalizeFrameworkResourceSpec(frameworkResourceSpecInputSchema.parse(value)),
  normalizedFrameworkResourceSpecSchema
);

export const frameworkGeneratedFilePlanSchema = z.object({
  action: frameworkGeneratedFileActionSchema,
  moduleKind: frameworkModuleKindSchema,
  path: nonEmptyStringSchema,
  reason: nonEmptyStringSchema,
  requiresManualReview: z.boolean(),
  templateId: nonEmptyStringSchema.optional()
}) satisfies z.ZodType<FrameworkGeneratedFilePlan>;

export const frameworkAgentTaskDefinitionSchema = z.object({
  allowedPaths: z.array(nonEmptyStringSchema),
  contextFiles: z.array(nonEmptyStringSchema),
  forbiddenPaths: z.array(nonEmptyStringSchema),
  goal: nonEmptyStringSchema,
  id: nonEmptyStringSchema,
  reportFields: z.array(nonEmptyStringSchema),
  requiredChecks: z.array(nonEmptyStringSchema),
  stopConditions: z.array(nonEmptyStringSchema),
  taskType: nonEmptyStringSchema
}) satisfies z.ZodType<FrameworkAgentTaskDefinition>;

export const frameworkAgentContextDefinitionSchema = z.object({
  checkIds: z.array(nonEmptyStringSchema),
  contextFiles: z.array(nonEmptyStringSchema),
  moduleIds: z.array(nonEmptyStringSchema),
  resourceIds: z.array(nonEmptyStringSchema),
  summary: nonEmptyStringSchema,
  taskIds: z.array(nonEmptyStringSchema)
}) satisfies z.ZodType<FrameworkAgentContextDefinition>;

export const frameworkGeneratorPlanSchema = z.object({
  agentContext: frameworkAgentContextDefinitionSchema,
  agentTasks: z.array(frameworkAgentTaskDefinitionSchema),
  checks: z.array(frameworkCheckDefinitionSchema),
  generatedFiles: z.array(frameworkGeneratedFilePlanSchema),
  modules: z.array(frameworkModuleDefinitionSchema),
  resources: z.array(frameworkResourceDefinitionSchema)
}) satisfies z.ZodType<FrameworkGeneratorPlan>;

function findDuplicates(values: readonly string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
      continue;
    }

    seen.add(value);
  }

  return [...duplicates];
}

function isReservedResourceName(resourceName: string) {
  const normalizedName = normalizeReservedName(resourceName);

  return frameworkReservedResourceNames.some(
    (reservedName) => normalizeReservedName(reservedName) === normalizedName
  );
}

function normalizeReservedName(value: string) {
  return toKebabCase(value).replace(/-/g, "");
}

function toKebabCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

function pluralizeLabel(label: string) {
  const match = /^(.*?)([A-Za-z]+)$/.exec(label);

  if (!match) {
    return `${label}s`;
  }

  const [, prefix, word] = match;

  return `${prefix}${pluralizeWord(word)}`;
}

function pluralizePathSegment(segment: string) {
  return pluralizeWord(segment);
}

function pluralizeWord(word: string) {
  if (/[sxz]$/i.test(word) || /(ch|sh)$/i.test(word)) {
    return `${word}es`;
  }

  if (/[^aeiou]y$/i.test(word)) {
    return `${word.slice(0, -1)}ies`;
  }

  return `${word}s`;
}

function normalizeTimestamps(
  timestamps: FrameworkResourceSpecInput["timestamps"]
) {
  if (timestamps === false) {
    return {
      enabled: false
    };
  }

  if (timestamps === true || timestamps === undefined) {
    return {
      createdAtField: "createdAt",
      enabled: true,
      updatedAtField: "updatedAt"
    };
  }

  if (timestamps.enabled === false) {
    return {
      ...timestamps,
      enabled: false
    };
  }

  return {
    createdAtField: timestamps.createdAtField ?? "createdAt",
    enabled: timestamps.enabled ?? true,
    updatedAtField: timestamps.updatedAtField ?? "updatedAt"
  };
}

function validateFieldDefaultValue(
  value: z.infer<typeof frameworkResourceFieldSpecSchema>,
  context: z.RefinementCtx
) {
  if (value.default === undefined) {
    return;
  }

  switch (value.type) {
    case "string":
    case "text":
    case "email":
    case "url":
    case "date":
    case "datetime":
    case "uuid":
      if (typeof value.default !== "string") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "default must be a string for this field type",
          path: ["default"]
        });
      }
      return;
    case "number":
      if (typeof value.default !== "number") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "default must be a number for this field type",
          path: ["default"]
        });
      }
      return;
    case "integer":
      if (
        typeof value.default !== "number" ||
        !Number.isInteger(value.default)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "default must be an integer for this field type",
          path: ["default"]
        });
      }
      return;
    case "boolean":
      if (typeof value.default !== "boolean") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "default must be a boolean for this field type",
          path: ["default"]
        });
      }
      return;
    case "enum":
      if (
        typeof value.default !== "string" ||
        !value.values?.includes(value.default)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "default must be one of the enum values",
          path: ["default"]
        });
      }
      return;
    case "json":
      return;
  }
}

function isNumericFieldType(
  value: FrameworkFieldType
): value is "integer" | "number" {
  return value === "integer" || value === "number";
}

function isStringLikeFieldType(
  value: FrameworkFieldType
): value is "email" | "string" | "text" | "url" | "uuid" {
  return (
    value === "email" ||
    value === "string" ||
    value === "text" ||
    value === "url" ||
    value === "uuid"
  );
}
