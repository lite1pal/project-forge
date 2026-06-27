import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  productDefinitionSchema,
  type ProductDefinition
} from "../../packages/domain/src/product/index.js";
import {
  defaultExtractionOutputPath,
  generateExtractionOutput,
  type ExtractionOutputResult
} from "./output.js";

type PlaceholderOnboardingStepId = "workspace_connected";
type PlaceholderUsageMeterKey = "records";
type PlaceholderNavItemId = "overview";

export interface PlaceholderProductFile {
  contents: string;
  path: string;
}

export interface PlaceholderValidationResult {
  auditTrailSpecificImportViolations: readonly string[];
  outputPath: string;
  placeholderFiles: readonly string[];
  requiredScaffoldFiles: readonly string[];
}

export const placeholderProduct = {
  emptyStateCopy: {
    emptyStateDescription:
      "Connect the first workspace integration to start validating the scaffold seams.",
    emptyStateTitle: "No placeholder data yet",
    primaryCtaHref: "/getting-started",
    primaryCtaLabel: "Open getting started"
  },
  id: "placeholder-product",
  name: "Placeholder Product",
  navItems: [
    {
      href: "/",
      id: "overview",
      label: "Overview"
    }
  ],
  onboardingSteps: [
    {
      id: "workspace_connected",
      required: true
    }
  ],
  usageMeters: [
    {
      key: "records",
      label: "Records"
    }
  ]
} satisfies ProductDefinition<
  PlaceholderOnboardingStepId,
  PlaceholderUsageMeterKey,
  PlaceholderNavItemId
>;

export const requiredPlaceholderScaffoldFiles = [
  "packages/domain/src/product/index.ts",
  "packages/domain/src/product/product-definition.ts",
  "packages/domain/src/onboarding/index.ts",
  "apps/web/src/components/layout/app-shell.tsx",
  "apps/web/src/features/onboarding/domain/onboarding-screen.ts"
] as const;

const placeholderFilePaths = {
  domainIndex: "packages/domain/src/placeholder-product/index.ts",
  domainProduct: "packages/domain/src/placeholder-product/product.ts",
  onboardingAdapter: "apps/web/app/getting-started/placeholder-product-onboarding.ts",
  shellNavigation: "apps/web/app/placeholder-product-navigation.ts"
} as const;

const auditTrailSpecificImportMatchers = [
  "/audit-events",
  "audit-product",
  "auditTrailProduct"
] as const;

export function validatePlaceholderProductConfig() {
  return productDefinitionSchema.parse(placeholderProduct);
}

export function createPlaceholderProductFiles() {
  const product = validatePlaceholderProductConfig();

  return [
    {
      path: placeholderFilePaths.domainIndex,
      contents: [
        'export * from "./product.js";',
        ""
      ].join("\n")
    },
    {
      path: placeholderFilePaths.domainProduct,
      contents: [
        'import { productDefinitionSchema, type ProductDefinition } from "../product/index.js";',
        "",
        'export type PlaceholderOnboardingStepId = "workspace_connected";',
        'export type PlaceholderUsageMeterKey = "records";',
        'export type PlaceholderNavItemId = "overview";',
        "",
        `export const placeholderProduct = ${JSON.stringify(product, null, 2)} satisfies ProductDefinition<`,
        "  PlaceholderOnboardingStepId,",
        "  PlaceholderUsageMeterKey,",
        "  PlaceholderNavItemId",
        ">;",
        "",
        "productDefinitionSchema.parse(placeholderProduct);",
        ""
      ].join("\n")
    },
    {
      path: placeholderFilePaths.shellNavigation,
      contents: [
        'import { placeholderProduct } from "../../../packages/domain/src/placeholder-product/product.js";',
        "",
        "export interface PlaceholderShellProductConfig {",
        "  navItems: typeof placeholderProduct.navItems;",
        "  productName: string;",
        "}",
        "",
        "export function getPlaceholderShellProductConfig(): PlaceholderShellProductConfig {",
        "  return {",
        "    navItems: placeholderProduct.navItems,",
        "    productName: placeholderProduct.name",
        "  };",
        "}",
        ""
      ].join("\n")
    },
    {
      path: placeholderFilePaths.onboardingAdapter,
      contents: [
        'import { placeholderProduct } from "../../../../packages/domain/src/placeholder-product/product.js";',
        "",
        'import type { OnboardingScreenCopy, OnboardingStepView } from "@/src/features/onboarding/domain/onboarding-screen";',
        'import type { CurrentUserResponse } from "@/src/features/auth/domain/schemas";',
        "",
        "type CurrentOnboarding =",
        '  CurrentUserResponse["memberships"][number]["onboarding"];',
        "",
        "const onboardingStepContent = {",
        '  workspace_connected: {',
        '    ctaHref: "/settings",',
        '    ctaLabel: "Connect workspace",',
        '    description: "Connect one workspace integration to validate the generic onboarding seam.",',
        "    showsIngestCommand: false,",
        '    title: "Connect a workspace"',
        "  }",
        "} as const;",
        "",
        "const onboardingScreenCopy: OnboardingScreenCopy = {",
        '  completeSummaryDescription: "Required setup is complete.",',
        '  dismissFromSidebarLabel: "Dismiss from sidebar",',
        "  emptyStateDescription: placeholderProduct.emptyStateCopy.emptyStateDescription,",
        '  emptyStatePrimaryCtaHref: placeholderProduct.emptyStateCopy.primaryCtaHref ?? "/getting-started",',
        '  emptyStatePrimaryCtaLabel: placeholderProduct.emptyStateCopy.primaryCtaLabel ?? "Open getting started",',
        '  eyebrow: "Workspace setup",',
        '  incompleteSummaryDescription: "Finish the required setup step to complete the placeholder product wiring check.",',
        '  showInSidebarLabel: "Show in sidebar",',
        '  title: "Getting started"',
        "};",
        "",
        "export function getPlaceholderOnboardingScreenCopy() {",
        "  return onboardingScreenCopy;",
        "}",
        "",
        "export function buildPlaceholderOnboardingStepViews(",
        "  activeOnboarding: CurrentOnboarding",
        "): OnboardingStepView[] {",
        "  return activeOnboarding.steps.map((step) => ({",
        "    ...step,",
        "    ...onboardingStepContent[step.id as keyof typeof onboardingStepContent]",
        "  }));",
        "}",
        ""
      ].join("\n")
    }
  ] satisfies readonly PlaceholderProductFile[];
}

export function validatePlaceholderCandidate(input: {
  outputPath?: string;
  repoRoot: string;
}) {
  validatePlaceholderProductConfig();

  const extraction = generateExtractionOutput({
    outputPath: input.outputPath ?? defaultExtractionOutputPath,
    repoRoot: input.repoRoot
  });
  const outputRoot = resolve(input.repoRoot, extraction.outputPath);
  const missingRequiredFiles = findMissingRequiredScaffoldFiles({
    outputRoot,
    requiredFiles: requiredPlaceholderScaffoldFiles
  });

  if (missingRequiredFiles.length > 0) {
    throw new Error(formatMissingRequiredFilesError(missingRequiredFiles));
  }

  const placeholderFiles = createPlaceholderProductFiles();
  const invalidPlaceholderPaths = findInvalidPlaceholderPaths(placeholderFiles);

  if (invalidPlaceholderPaths.length > 0) {
    throw new Error(formatInvalidPlaceholderPathError(invalidPlaceholderPaths));
  }

  const importViolations = collectAuditTrailSpecificImports(placeholderFiles);

  if (importViolations.length > 0) {
    throw new Error(formatAuditTrailSpecificImportError(importViolations));
  }

  writePlaceholderFiles({
    files: placeholderFiles,
    outputRoot
  });

  return {
    auditTrailSpecificImportViolations: importViolations,
    outputPath: extraction.outputPath,
    placeholderFiles: placeholderFiles.map((file) => file.path),
    requiredScaffoldFiles: requiredPlaceholderScaffoldFiles
  } satisfies PlaceholderValidationResult;
}

export function formatPlaceholderValidationSummary(
  result: PlaceholderValidationResult
) {
  return [
    "Placeholder product validation passed",
    "",
    `- output directory: ${result.outputPath}`,
    `- placeholder files written: ${result.placeholderFiles.length}`,
    `- required scaffold files checked: ${result.requiredScaffoldFiles.length}`,
    `- AuditTrail-specific import violations: ${result.auditTrailSpecificImportViolations.length}`,
    "- generated candidate status: local-only validation fixture, not a published boilerplate"
  ].join("\n");
}

export function collectAuditTrailSpecificImports(
  files: readonly PlaceholderProductFile[]
) {
  const violations: string[] = [];

  for (const file of files) {
    const importSpecifiers = extractImportSpecifiers(file.contents);

    for (const specifier of importSpecifiers) {
      if (
        auditTrailSpecificImportMatchers.some((pattern) =>
          specifier.includes(pattern)
        )
      ) {
        violations.push(`${file.path} -> ${specifier}`);
      }
    }
  }

  return violations;
}

export function findMissingRequiredScaffoldFiles(input: {
  outputRoot: string;
  requiredFiles: readonly string[];
}) {
  return input.requiredFiles.filter((file) => {
    const absolutePath = resolve(input.outputRoot, file);

    return !existsSync(absolutePath);
  });
}

export function readPlaceholderValidationFile(input: {
  outputRoot: string;
  path: string;
}) {
  return readFileSync(resolve(input.outputRoot, input.path), "utf8");
}

function writePlaceholderFiles(input: {
  files: readonly PlaceholderProductFile[];
  outputRoot: string;
}) {
  for (const file of input.files) {
    const absolutePath = resolve(input.outputRoot, file.path);

    mkdirSync(dirname(absolutePath), {
      recursive: true
    });
    writeFileSync(absolutePath, file.contents);
  }
}

function extractImportSpecifiers(contents: string) {
  const matches = contents.matchAll(
    /import(?:\s+type)?(?:[\s\w{},*]+from\s+)?["']([^"']+)["']/g
  );

  return [...matches].map((match) => match[1]);
}

function findInvalidPlaceholderPaths(files: readonly PlaceholderProductFile[]) {
  return files
    .map((file) => file.path)
    .filter((path) => auditTrailSpecificImportMatchers.some((pattern) => path.includes(pattern)));
}

function formatMissingRequiredFilesError(files: readonly string[]) {
  return [
    "Placeholder validation is missing required scaffold files in the generated candidate:",
    ...files.map((file) => `- ${file}`)
  ].join("\n");
}

function formatInvalidPlaceholderPathError(paths: readonly string[]) {
  return [
    "Placeholder validation files must stay outside AuditTrail-owned path names:",
    ...paths.map((path) => `- ${path}`)
  ].join("\n");
}

function formatAuditTrailSpecificImportError(violations: readonly string[]) {
  return [
    "Placeholder validation files imported AuditTrail-specific modules:",
    ...violations.map((violation) => `- ${violation}`)
  ].join("\n");
}

export type PlaceholderExtractionOutput = ExtractionOutputResult;
