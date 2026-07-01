import { existsSync, readFileSync } from "node:fs";
import { extname, relative, resolve } from "node:path";

import {
  createProductGeneratedFiles
} from "./product-install.js";
import {
  readGeneratedProductSpec,
  type GeneratedProductResource,
  type GeneratedProductSpec
} from "./product-spec.js";

const patchedRootFiles = [
  "packages/domain/src/index.ts",
  "packages/domain/package.json",
  "apps/api/src/product-module.ts",
  "apps/web/app/product-module.ts",
  "apps/api/src/__tests__/product-module.test.ts"
] as const;

export interface ProductPlanReport {
  assumptions: readonly string[];
  checks: readonly {
    command: string;
    required: boolean;
  }[];
  generatedProductFiles: readonly {
    path: string;
    reason: string;
  }[];
  product: {
    homeRoute: string;
    id: string;
    name: string;
    resources: readonly {
      apiPrefix: string;
      id: string;
      installCommand: string;
      listPath: string;
      navLabel: string;
      ownership: string;
    }[];
  };
  rootPatches: readonly {
    exists: boolean;
    path: string;
    reason: string;
  }[];
  specPath: string;
  summary: {
    generatedProductFileCount: number;
    resourceCount: number;
    rootPatchCount: number;
  };
}

export function createProductPlanFromFile(input: {
  repoRoot: string;
  specPath: string;
}): ProductPlanReport {
  const repoRoot = resolve(input.repoRoot);
  const specPath = resolveProductSpecPath({
    repoRoot,
    specPath: input.specPath
  });
  const product = readGeneratedProductSpec(
    JSON.parse(readFileSync(specPath, "utf8"))
  );
  const generatedFiles = createProductGeneratedFiles(product);

  return {
    assumptions: createAssumptions(product),
    checks: [
      {
        command: "pnpm typecheck:saas",
        required: true
      },
      {
        command: "pnpm test:saas",
        required: true
      }
    ],
    generatedProductFiles: generatedFiles.map((file) => ({
      path: file.path,
      reason: describeGeneratedProductFile(file.path, product)
    })),
    product: {
      homeRoute: `/${product.id}`,
      id: product.id,
      name: product.name,
      resources: product.resources.map((resourceEntry) =>
        createResourceSummary({
          product,
          repoRoot,
          resourceEntry
        })
      )
    },
    rootPatches: patchedRootFiles.map((path) => ({
      exists: existsSync(resolve(repoRoot, path)),
      path,
      reason: describeRootPatch(path)
    })),
    specPath: relative(repoRoot, specPath).replace(/\\/g, "/"),
    summary: {
      generatedProductFileCount: generatedFiles.length,
      resourceCount: product.resources.length,
      rootPatchCount: patchedRootFiles.length
    }
  };
}

export function formatProductPlanReport(report: ProductPlanReport) {
  return [
    `Generated product plan: ${report.product.id}`,
    "",
    `- spec: ${report.specPath}`,
    `- product: ${report.product.name}`,
    `- home route: ${report.product.homeRoute}`,
    `- embedded resources: ${report.summary.resourceCount}`,
    `- generated product files: ${report.summary.generatedProductFileCount}`,
    `- shared root patches: ${report.summary.rootPatchCount}`,
    "",
    "Resources",
    ...report.product.resources.map((resource) =>
      `- ${resource.id}: ${resource.listPath} via ${resource.installCommand}`
    ),
    "",
    "Shared Root Patches",
    ...report.rootPatches.map((patch) =>
      `- ${patch.path}${patch.exists ? "" : " (missing in target repo)"}: ${patch.reason}`
    ),
    "",
    "Generated Product Files",
    ...report.generatedProductFiles.map((file) => `- ${file.path}: ${file.reason}`),
    "",
    "Assumptions",
    ...report.assumptions.map((assumption) => `- ${assumption}`),
    "",
    "Checks",
    ...report.checks.map((check) => `- ${check.command}`)
  ].join("\n");
}

function createResourceSummary(input: {
  product: GeneratedProductSpec;
  repoRoot: string;
  resourceEntry: GeneratedProductResource;
}) {
  const resourcePath = `tmp/saas-product-install/${input.product.id}/${toKebabCase(
    input.resourceEntry.resource.resource
  )}.json`;

  return {
    apiPrefix: input.resourceEntry.resource.api.prefix,
    id: input.resourceEntry.resource.resource,
    installCommand: `pnpm saas install resource ${resourcePath}`,
    listPath: input.resourceEntry.listPath,
    navLabel: input.resourceEntry.navLabel,
    ownership: input.resourceEntry.resource.ownership
  };
}

function createAssumptions(product: GeneratedProductSpec) {
  return [
    "Product install reuses the existing repo-root generated-resource seam for each embedded resource before patching product runtime files.",
    "Generated product UI is currently limited to a product home route plus product-owned list-and-create resource pages.",
    "The current product-generation slice does not add custom product API routes; embedded resources remain the runtime-backed data surface.",
    `Organizations created after install can receive the product through the shared installed-product runtime, but backfill for existing organizations remains a separate concern for ${product.id}.`
  ] as const;
}

function describeGeneratedProductFile(path: string, product: GeneratedProductSpec) {
  if (path.startsWith(`packages/domain/src/${product.id}/`)) {
    return "Declare the generated product manifest and runtime adapter.";
  }

  if (path.startsWith(`apps/web/app/${product.id}/`)) {
    return "Add generated product-owned web routes.";
  }

  if (path.startsWith(`apps/web/src/features/${product.id}-product/`)) {
    return "Add generated product-owned web feature helpers.";
  }

  return "Write generated product support code.";
}

function describeRootPatch(path: string) {
  switch (path) {
    case "packages/domain/src/index.ts":
      return "Export the generated product domain module from the root barrel.";
    case "packages/domain/package.json":
      return "Expose the generated product domain entrypoint through package exports.";
    case "apps/api/src/product-module.ts":
      return "Register the generated product module in the API product runtime.";
    case "apps/web/app/product-module.ts":
      return "Register the generated product module in the web product runtime.";
    case "apps/api/src/__tests__/product-module.test.ts":
      return "Extend focused product runtime tests for the new product.";
    default:
      return "Patch a shared product runtime seam.";
  }
}

function resolveProductSpecPath(input: {
  repoRoot: string;
  specPath: string;
}) {
  const absolutePath = resolve(input.repoRoot, input.specPath);

  if (!existsSync(absolutePath)) {
    throw new Error(`Product spec file not found: ${input.specPath}`);
  }

  if (extname(absolutePath).toLowerCase() !== ".json") {
    throw new Error("Product specs must be JSON files.");
  }

  return absolutePath;
}

function toKebabCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}
