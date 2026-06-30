import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

import {
  normalizeFrameworkResourceSpec,
  type FrameworkResourceSpec,
  type FrameworkResourceSpecInput
} from "../../packages/framework/src/index.js";
import { resourceGeneratorSupportedFieldTypes } from "./resource-generator.js";

const supportedFieldTypes = new Set<string>(resourceGeneratorSupportedFieldTypes);
const supportedCrudOperations = new Set([
  "list",
  "create",
  "read",
  "update",
  "delete"
] as const);
const supportedOwnershipModes = new Set(["organization", "user", "none"] as const);

export interface InitializedResourceSpecResult {
  outputPath: string;
  resource: FrameworkResourceSpec;
}

export function initializeResourceSpec(input: {
  apiPrefix?: string;
  crud?: string;
  fieldSpecs: readonly string[];
  force?: boolean;
  label?: string;
  nav?: boolean;
  outputPath?: string;
  ownership?: string;
  pluralLabel?: string;
  publicApi?: boolean;
  repoRoot: string;
  resourceName: string;
  timestamps?: boolean;
}) : InitializedResourceSpecResult {
  const resourceName = normalizeResourceName(input.resourceName);
  const label = input.label?.trim() || toTitleCase(resourceName);
  const ownership = input.ownership?.trim() || "organization";

  if (!supportedOwnershipModes.has(ownership as "organization" | "user" | "none")) {
    throw new Error(
      `Unsupported ownership '${ownership}'. Supported values: organization, user, none.`
    );
  }

  if (input.fieldSpecs.length === 0) {
    throw new Error(
      "At least one --field <name:type[:modifier...]> flag is required."
    );
  }

  const specInput: FrameworkResourceSpecInput = {
    api: {
      prefix:
        input.apiPrefix?.trim() ||
        createDefaultApiPrefix({
          ownership,
          resourceName
        }),
      public: input.publicApi ?? false
    },
    crud: parseCrudOperations(input.crud),
    fields: input.fieldSpecs.map((fieldSpec) => parseFieldSpec(fieldSpec)),
    label,
    ownership: ownership as FrameworkResourceSpecInput["ownership"],
    pluralLabel: input.pluralLabel?.trim(),
    resource: resourceName,
    timestamps: input.timestamps ?? true,
    ui: {
      nav: input.nav ?? false
    }
  };
  const resource = normalizeFrameworkResourceSpec(specInput);
  const outputPath = resolveSafeSpecOutputPath({
    outputPath: input.outputPath ?? `specs/${toKebabCase(resource.resource)}.json`,
    repoRoot: input.repoRoot
  });
  const absoluteOutputPath = resolve(input.repoRoot, outputPath);

  if (existsSync(absoluteOutputPath) && !(input.force ?? false)) {
    throw new Error(
      `Resource spec output already exists at '${outputPath}'. Re-run with --force to overwrite it.`
    );
  }

  mkdirSync(dirname(absoluteOutputPath), {
    recursive: true
  });
  writeFileSync(absoluteOutputPath, `${JSON.stringify(resource, null, 2)}\n`);

  return {
    outputPath,
    resource
  };
}

export function formatInitializedResourceSpecSummary(
  result: InitializedResourceSpecResult
) {
  return [
    `Initialized resource spec: ${result.resource.resource}`,
    "",
    `- output: ${result.outputPath}`,
    `- ownership: ${result.resource.ownership}`,
    `- fields: ${result.resource.fields.length}`,
    `- api prefix: ${result.resource.api.prefix}`,
    `- ui nav: ${result.resource.ui.nav ? "enabled" : "disabled"}`,
    "",
    "Next",
    `- pnpm saas plan resource ${result.outputPath}`,
    `- pnpm saas add resource ${result.outputPath} --output .generated/resource-preview/${toKebabCase(result.resource.resource)}`,
    `- pnpm saas install resource ${result.outputPath}`
  ].join("\n");
}

function parseCrudOperations(value?: string): FrameworkResourceSpecInput["crud"] | undefined {
  if (!value) {
    return undefined;
  }

  const operations = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (operations.length === 0) {
    throw new Error(
      "The --crud option must include at least one comma-separated operation."
    );
  }

  for (const operation of operations) {
    if (
      !supportedCrudOperations.has(
        operation as "list" | "create" | "read" | "update" | "delete"
      )
    ) {
      throw new Error(
        `Unsupported CRUD operation '${operation}'. Supported values: list, create, read, update, delete.`
      );
    }
  }

  return {
    create: operations.includes("create"),
    delete: operations.includes("delete"),
    list: operations.includes("list"),
    read: operations.includes("read"),
    update: operations.includes("update")
  };
}

function parseFieldSpec(spec: string): FrameworkResourceSpecInput["fields"][number] {
  const trimmed = spec.trim();

  if (trimmed.length === 0) {
    throw new Error("Field specs cannot be empty.");
  }

  const segments = trimmed.split(":");
  const [name, type, ...modifiers] = segments;

  if (!name || !type) {
    throw new Error(
      `Invalid field spec '${spec}'. Expected <name>:<type>[:modifier...].`
    );
  }

  if (!supportedFieldTypes.has(type)) {
    throw new Error(
      `Unsupported field type '${type}' in '${spec}'. Supported values: ${resourceGeneratorSupportedFieldTypes.join(", ")}.`
    );
  }

  const field: FrameworkResourceSpecInput["fields"][number] = {
    name,
    type: type as FrameworkResourceSpecInput["fields"][number]["type"]
  };

  for (const modifier of modifiers) {
    if (modifier === "required") {
      field.required = true;
      continue;
    }

    if (modifier === "optional") {
      field.required = false;
      continue;
    }

    if (modifier === "unique") {
      field.unique = true;
      continue;
    }

    if (modifier === "searchable") {
      field.searchable = true;
      continue;
    }

    if (modifier === "sortable") {
      field.sortable = true;
      continue;
    }

    if (modifier === "readonly") {
      field.readonly = true;
      continue;
    }

    if (modifier === "hidden") {
      field.hidden = true;
      continue;
    }

    if (modifier.startsWith("default=")) {
      field.default = parseFieldDefaultValue({
        spec,
        type: field.type,
        value: modifier.slice("default=".length)
      });
      continue;
    }

    if (modifier.startsWith("values=")) {
      field.values = modifier
        .slice("values=".length)
        .split("|")
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
      continue;
    }

    if (modifier.startsWith("label=")) {
      field.label = modifier.slice("label=".length).trim();
      continue;
    }

    if (modifier.startsWith("description=")) {
      field.description = modifier.slice("description=".length).trim();
      continue;
    }

    if (modifier.startsWith("min=")) {
      field.min = parseFiniteNumber({
        label: "min",
        spec,
        value: modifier.slice("min=".length)
      });
      continue;
    }

    if (modifier.startsWith("max=")) {
      field.max = parseFiniteNumber({
        label: "max",
        spec,
        value: modifier.slice("max=".length)
      });
      continue;
    }

    if (modifier.startsWith("minLength=")) {
      field.minLength = parsePositiveInteger({
        allowZero: true,
        label: "minLength",
        spec,
        value: modifier.slice("minLength=".length)
      });
      continue;
    }

    if (modifier.startsWith("maxLength=")) {
      field.maxLength = parsePositiveInteger({
        allowZero: false,
        label: "maxLength",
        spec,
        value: modifier.slice("maxLength=".length)
      });
      continue;
    }

    throw new Error(
      `Unsupported field modifier '${modifier}' in '${spec}'.`
    );
  }

  return field;
}

function parseFieldDefaultValue(input: {
  spec: string;
  type: FrameworkResourceSpecInput["fields"][number]["type"];
  value: string;
}) {
  switch (input.type) {
    case "boolean":
      if (input.value !== "true" && input.value !== "false") {
        throw new Error(
          `Invalid boolean default '${input.value}' in '${input.spec}'. Use true or false.`
        );
      }

      return input.value === "true";
    case "enum":
    case "string":
    case "text":
    case "email":
    case "datetime":
    case "uuid":
      return input.value;
  }
}

function parseFiniteNumber(input: {
  label: string;
  spec: string;
  value: string;
}) {
  const parsed = Number(input.value);

  if (!Number.isFinite(parsed)) {
    throw new Error(
      `Invalid ${input.label} value '${input.value}' in '${input.spec}'.`
    );
  }

  return parsed;
}

function parsePositiveInteger(input: {
  allowZero: boolean;
  label: string;
  spec: string;
  value: string;
}) {
  const parsed = Number(input.value);

  if (
    !Number.isInteger(parsed) ||
    (input.allowZero ? parsed < 0 : parsed <= 0)
  ) {
    throw new Error(
      `Invalid ${input.label} value '${input.value}' in '${input.spec}'.`
    );
  }

  return parsed;
}

function resolveSafeSpecOutputPath(input: {
  outputPath: string;
  repoRoot: string;
}) {
  const repoRoot = resolve(input.repoRoot);
  const absoluteOutputPath = resolve(repoRoot, input.outputPath);
  const relativeOutputPath = relative(repoRoot, absoluteOutputPath).replace(
    /\\/g,
    "/"
  );

  if (
    relativeOutputPath.length === 0 ||
    relativeOutputPath === "." ||
    relativeOutputPath.startsWith("../")
  ) {
    throw new Error(
      `Unsafe resource spec output path '${input.outputPath}'. Output must stay inside the repository.`
    );
  }

  return relativeOutputPath;
}

function normalizeResourceName(value: string) {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error("Missing resource name.");
  }

  return normalized;
}

function createDefaultApiPrefix(input: {
  ownership: string;
  resourceName: string;
}) {
  const segment = pluralizePathSegment(toKebabCase(input.resourceName));

  if (input.ownership === "organization") {
    return `/v1/organizations/:organizationId/${segment}`;
  }

  return `/v1/${segment}`;
}

function toKebabCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

function toTitleCase(value: string) {
  return toKebabCase(value)
    .split("-")
    .filter((segment) => segment.length > 0)
    .map((segment) => segment[0]!.toUpperCase() + segment.slice(1))
    .join(" ");
}

function pluralizePathSegment(segment: string) {
  if (/[sxz]$/i.test(segment) || /(ch|sh)$/i.test(segment)) {
    return `${segment}es`;
  }

  if (/[^aeiou]y$/i.test(segment)) {
    return `${segment.slice(0, -1)}ies`;
  }

  return `${segment}s`;
}
