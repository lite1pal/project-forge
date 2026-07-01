import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";

import { applyResourceFromFile } from "./resource-apply.js";
import {
  readGeneratedProductSpec,
  type GeneratedProductResource,
  type GeneratedProductSpec
} from "./product-spec.js";

const productInstallStageRoot = "tmp/saas-product-install";

export interface ProductInstallResult {
  installedProductId: string;
  resourceIds: readonly string[];
  writtenFiles: readonly string[];
}

export function installProductFromFile(input: {
  force?: boolean;
  repoRoot: string;
  specPath: string;
}): ProductInstallResult {
  const repoRoot = resolve(input.repoRoot);
  const specPath = resolveProductSpecPath({
    repoRoot,
    specPath: input.specPath
  });
  const product = readGeneratedProductSpec(
    JSON.parse(readFileSync(specPath, "utf8"))
  );
  const stageRoot = resolve(
    repoRoot,
    `${productInstallStageRoot}/${product.id}`
  );

  try {
    rmSync(stageRoot, {
      force: true,
      recursive: true
    });
    mkdirSync(stageRoot, {
      recursive: true
    });

    for (const resourceEntry of product.resources) {
      const stagedSpecPath = resolve(
        stageRoot,
        `${toKebabCase(resourceEntry.resource.resource)}.json`
      );

      writeFileSync(
        stagedSpecPath,
        `${JSON.stringify(resourceEntry.resource, null, 2)}\n`
      );
      applyResourceFromFile({
        allowedWarningCodes:
          input.force ?? false ? ["existing-module-conflict"] : undefined,
        force: input.force ?? false,
        repoRoot,
        specPath: relative(repoRoot, stagedSpecPath).replace(/\\/g, "/"),
        targetPath: "."
      });
    }

    const generatedFiles = createProductGeneratedFiles(product);
    ensureWritableFiles({
      files: generatedFiles,
      force: input.force ?? false,
      repoRoot
    });

    for (const file of generatedFiles) {
      const absolutePath = resolve(repoRoot, file.path);

      mkdirSync(dirname(absolutePath), {
        recursive: true
      });
      writeFileSync(absolutePath, ensureTrailingNewline(file.contents));
    }

    patchRootFile({
      filePath: "packages/domain/src/index.ts",
      repoRoot,
      update: (contents) =>
        insertAfterAnchor({
          anchor: 'export * from "./webhooks/index.js";',
          contents,
          insertion: `export * from "./${product.id}/index.js";`
        })
    });
    patchRootFile({
      filePath: "packages/domain/package.json",
      repoRoot,
      update: (contents) => patchDomainPackageExports(contents, product.id)
    });
    patchRootFile({
      filePath: "apps/api/src/product-module.ts",
      repoRoot,
      update: (contents) => patchApiProductRuntime(contents, product.id)
    });
    patchRootFile({
      filePath: "apps/web/app/product-module.ts",
      repoRoot,
      update: (contents) => patchWebProductRuntime(contents, product.id)
    });
    patchRootFile({
      filePath: "apps/api/src/__tests__/product-module.test.ts",
      repoRoot,
      update: (contents) => patchApiProductRuntimeTest(contents, product)
    });

    return {
      installedProductId: product.id,
      resourceIds: product.resources.map(
        (resource: GeneratedProductResource) => resource.resource.resource
      ),
      writtenFiles: generatedFiles.map((file: PendingProductFile) => file.path)
    };
  } finally {
    rmSync(stageRoot, {
      force: true,
      recursive: true
    });
  }
}

export function formatInstalledProductSummary(result: ProductInstallResult) {
  return [
    `Installed product: ${result.installedProductId}`,
    "",
    `- resources: ${result.resourceIds.join(", ")}`,
    `- written files: ${result.writtenFiles.length}`
  ].join("\n");
}

interface PendingProductFile {
  contents: string;
  path: string;
}

export function createProductGeneratedFiles(
  product: GeneratedProductSpec
): readonly PendingProductFile[] {
  const productPath = toKebabCase(product.id);
  const productFeaturePath = `${productPath}-product`;

  return [
    {
      path: `packages/domain/src/${productPath}/index.ts`,
      contents: [
        'export * from "./product.js";',
        'export * from "./product-module.js";'
      ].join("\n")
    },
    {
      path: `packages/domain/src/${productPath}/product.ts`,
      contents: renderDomainProductFile(product)
    },
    {
      path: `packages/domain/src/${productPath}/product-module.ts`,
      contents: renderDomainProductModuleFile(product)
    },
    {
      path: `packages/domain/src/${productPath}/__tests__/product-module.test.ts`,
      contents: renderDomainProductModuleTest(product)
    },
    {
      path: `apps/web/src/features/${productFeaturePath}/components/${productPath}-home-screen.tsx`,
      contents: renderProductHomeScreen(product)
    },
    {
      path: `apps/web/src/features/${productFeaturePath}/index.ts`,
      contents: `export * from "./components/${productPath}-home-screen";`
    },
    {
      path: `apps/web/app/${productPath}/page.tsx`,
      contents: renderProductHomePage(product)
    },
    ...product.resources.flatMap((resourceEntry: GeneratedProductResource) => [
      {
        path: `apps/web/src/features/${productFeaturePath}/server/${toKebabCase(
          resourceEntry.resource.resource
        )}-workspace.ts`,
        contents: renderProductResourceServerFile(product, resourceEntry)
      },
      {
        path: trimLeadingSlash(`apps/web/app${resourceEntry.listPath}/page.tsx`),
        contents: renderProductResourceListPage(product, resourceEntry)
      },
      ...(resourceEntry.resource.crud.read
        ? [
            {
              path: trimLeadingSlash(
                `apps/web/app${resourceEntry.listPath}/[${getProductResourceParamName(
                  resourceEntry
                )}]/page.tsx`
              ),
              contents: renderProductResourceDetailPage(product, resourceEntry)
            }
          ]
        : []),
      ...(resourceEntry.resource.crud.update
        ? [
            {
              path: trimLeadingSlash(
                `apps/web/app${resourceEntry.listPath}/[${getProductResourceParamName(
                  resourceEntry
                )}]/edit/page.tsx`
              ),
              contents: renderProductResourceEditPage(product, resourceEntry)
            }
          ]
        : [])
    ])
  ] satisfies readonly PendingProductFile[];
}

function renderDomainProductFile(product: GeneratedProductSpec) {
  const pascalName = toPascalCase(product.id);
  const manifest = {
    capabilities: [
      {
        description: `Provides the ${product.name} product shell.`,
        id: `${product.id}-ui`,
        kind: "ui"
      },
      {
        description: `Provides the ${product.name} workspace navigation.`,
        id: `${product.id}-navigation`,
        kind: "navigation"
      },
      ...product.resources.map((resourceEntry: GeneratedProductResource) => ({
        description: `Provides the ${resourceEntry.resource.pluralLabel.toLowerCase()} resource slice.`,
        id: `${product.id}-${resourceEntry.resource.resource}`,
        kind: "resource"
      }))
    ],
    chrome: {
      errorHeading: `Unable to load ${product.name}`,
      loadingLabel: `Loading ${product.name}...`,
      metadataDescription:
        product.description ?? `${product.name} workspace generated by Elioric`,
      metadataTitle: product.name
    },
    description:
      product.description ??
      `${product.name} is a CLI-generated Elioric product module.`,
    emptyStateCopy: {
      emptyStateDescription:
        product.home?.description ??
        `Open ${product.resources[0]!.navLabel.toLowerCase()} to start using ${product.name}.`,
      emptyStateTitle: product.home?.title ?? `${product.name} workspace`,
      primaryCtaHref: `/${product.id}`,
      primaryCtaLabel: product.home?.ctaLabel ?? `Open ${product.name}`
    },
    id: product.id,
    name: product.name,
    navItems: [
      {
        href: `/${product.id}`,
        id: `${product.id}-home`,
        label: product.name
      },
      ...product.resources.map((resourceEntry: GeneratedProductResource) => ({
        href: resourceEntry.listPath,
        id: `${product.id}-${toKebabCase(resourceEntry.resource.pluralLabel)}`,
        label: resourceEntry.navLabel
      }))
    ],
    onboardingContent: {
      completeSummaryDescription: `${product.name} setup is complete.`,
      dismissFromSidebarLabel: "Dismiss from sidebar",
      eyebrow: `${product.name} setup`,
      incompleteSummaryDescription:
        `${product.name} does not require additional setup for the initial generated proof.`,
      showInSidebarLabel: "Show in sidebar",
      stepContent: [],
      title: `${product.name} getting started`
    },
    onboardingSteps: [],
    resources: product.resources.map((resourceEntry) => ({
      id: resourceEntry.resource.resource,
      navigationId: `${product.id}-${toKebabCase(resourceEntry.resource.pluralLabel)}`,
      ownership: resourceEntry.resource.ownership,
      routeBasePath: resourceEntry.listPath
    })),
    runtime: {
      registrations: []
    },
    usageMeters: [
      {
        key: product.id,
        label: product.name
      }
    ],
    workspaceSettings: {
      planUsage: {
        emptyStateDescription:
          `${product.name} usage will appear here once product-specific limits are added.`,
        metrics: {
          currentPlan: "Current plan",
          includedUnits: `Included ${product.resources[0]!.resource.pluralLabel.toLowerCase()}`,
          remainingUnits: `Remaining ${product.resources[0]!.resource.pluralLabel.toLowerCase()}`,
          usedThisMonth: "Created this month"
        },
        navDescription: `Track how ${product.name} will use your workspace plan.`,
        navLabel: `${product.name} usage`,
        noPermissionDescription:
          `You do not have permission to inspect ${product.name} usage for this workspace.`,
        resetDatePrefix: "Usage resets",
        sectionDescription:
          `This generated product currently reuses the shared workspace plan surface.`,
        sectionTitle: `${product.name} plan & usage`,
        selectedPlanSuffix: "selected",
        switchToPlanPrefix: "Switch to",
        usageWindowPrefix: "Usage window"
      }
    }
  };

  return [
    'import type {',
    "  ProductDefinition,",
    "  ProductModuleManifest",
    '} from "../product/index.js";',
    "",
    `type ${pascalName}ProductDefinition = ProductModuleManifest &`,
    "  ProductDefinition & {",
    "    chrome: {",
    "      errorHeading: string;",
    "      loadingLabel: string;",
    "      metadataDescription: string;",
    "      metadataTitle: string;",
    "    };",
    "    workspaceSettings: {",
    "      planUsage: {",
    "        emptyStateDescription: string;",
    "        metrics: {",
    "          currentPlan: string;",
    "          includedUnits: string;",
    "          remainingUnits: string;",
    "          usedThisMonth: string;",
    "        };",
    "        navDescription: string;",
    "        navLabel: string;",
    "        noPermissionDescription: string;",
    "        resetDatePrefix: string;",
    "        sectionDescription: string;",
    "        sectionTitle: string;",
    "        selectedPlanSuffix: string;",
    "        switchToPlanPrefix: string;",
    "        usageWindowPrefix: string;",
    "      };",
    "    };",
    "  };",
    "",
    `export const ${camelCase(product.id)}Product = ${JSON.stringify(
      manifest,
      null,
      2
    )} satisfies ${pascalName}ProductDefinition;`
  ].join("\n");
}

function renderDomainProductModuleFile(product: GeneratedProductSpec) {
  const pascalName = toPascalCase(product.id);
  const camelName = camelCase(product.id);

  return [
    'import type {',
    "  ProductModuleOnboardingCopy,",
    "  ProductModuleOnboardingStepView,",
    "  ProductModuleShellConfig,",
    "  ProductModuleWorkspaceScope,",
    "  RegisteredProductModule",
    '} from "../product/runtime-module.js";',
    "",
    `import { ${camelName}Product } from "./product.js";`,
    "",
    `const ${camelName}OnboardingCopy: ProductModuleOnboardingCopy = {`,
    `  completeSummaryDescription:`,
    `    ${camelName}Product.onboardingContent.completeSummaryDescription,`,
    `  dismissFromSidebarLabel:`,
    `    ${camelName}Product.onboardingContent.dismissFromSidebarLabel,`,
    `  emptyStateDescription: ${camelName}Product.emptyStateCopy.emptyStateDescription,`,
    `  emptyStatePrimaryCtaHref: ${camelName}Product.emptyStateCopy.primaryCtaHref ?? "/${product.id}",`,
    `  emptyStatePrimaryCtaLabel:`,
    `    ${camelName}Product.emptyStateCopy.primaryCtaLabel ?? "Open ${product.name}",`,
    `  eyebrow: ${camelName}Product.onboardingContent.eyebrow,`,
    `  incompleteSummaryDescription:`,
    `    ${camelName}Product.onboardingContent.incompleteSummaryDescription,`,
    `  showInSidebarLabel: ${camelName}Product.onboardingContent.showInSidebarLabel,`,
    `  title: ${camelName}Product.onboardingContent.title`,
    "};",
    "",
    "function buildWorkspaceSuffix(input: ProductModuleWorkspaceScope) {",
    "  if (!input.activeOrganizationId) {",
    '    return "";',
    "  }",
    "",
    "  const query = new URLSearchParams({",
    "    organizationId: input.activeOrganizationId",
    "  });",
    "",
    "  if (input.activeProjectId) {",
    '    query.set("projectId", input.activeProjectId);',
    "  }",
    "",
    "  return `?${query.toString()}`;",
    "}",
    "",
    "function toScopedHref(baseHref: string, workspaceSuffix: string) {",
    "  return workspaceSuffix ? `${baseHref}${workspaceSuffix}` : baseHref;",
    "}",
    "",
    `export const ${camelName}ProductModule = {`,
    `  manifest: ${camelName}Product,`,
    "  buildOnboardingStepViews(",
    `    _input: Parameters<RegisteredProductModule["buildOnboardingStepViews"]>[0]`,
    "  ): ProductModuleOnboardingStepView[] {",
    "    return [];",
    "  },",
    "  getChrome() {",
    `    return ${camelName}Product.chrome;`,
    "  },",
    "  getOnboardingScreenCopy() {",
    `    return ${camelName}OnboardingCopy;`,
    "  },",
    '  getRuntimeRegistrations(surface: "api" | "web" | "worker") {',
    `    const registrations = ${camelName}Product.runtime.registrations as RegisteredProductModule["manifest"]["runtime"]["registrations"];`,
    `    return registrations.filter(`,
    "      (registration) => registration.surface === surface",
    "    );",
    "  },",
    "  getShellProductConfig(input: ProductModuleWorkspaceScope): ProductModuleShellConfig {",
    "    const workspaceSuffix = buildWorkspaceSuffix(input);",
    "",
    "    return {",
    `      navItems: ${camelName}Product.navItems.map((item) => ({`,
    "        href: toScopedHref(item.href, workspaceSuffix),",
    "        id: item.id,",
    "        label: item.label",
    "      })),",
    `      productName: ${camelName}Product.name`,
    "    };",
    "  },",
    "  getWorkspaceSettingsCopy() {",
    `    return ${camelName}Product.workspaceSettings;`,
    "  }",
    "} satisfies RegisteredProductModule;"
  ].join("\n");
}

function renderDomainProductModuleTest(product: GeneratedProductSpec) {
  const camelName = camelCase(product.id);
  const expectedNav = [
    {
      href: `/${product.id}?organizationId=org-1&projectId=project-1`,
      id: `${product.id}-home`,
      label: product.name
    },
    ...product.resources.map((resourceEntry: GeneratedProductResource) => ({
      href: `${resourceEntry.listPath}?organizationId=org-1&projectId=project-1`,
      id: `${product.id}-${toKebabCase(resourceEntry.resource.pluralLabel)}`,
      label: resourceEntry.navLabel
    }))
  ];

  return [
    'import { describe, expect, it } from "vitest";',
    "",
    `import { ${camelName}ProductModule } from "../product-module.js";`,
    "",
    `describe("${camelName}ProductModule", () => {`,
    `  it("builds scoped shell navigation for ${product.name}", () => {`,
    "    expect(",
    `      ${camelName}ProductModule.getShellProductConfig({`,
    '        activeOrganizationId: "org-1",',
    '        activeProjectId: "project-1"',
    "      })",
    "    ).toEqual({",
    `      navItems: ${JSON.stringify(expectedNav, null, 2).replace(/^/gm, "      ")},`,
    `      productName: ${JSON.stringify(product.name)}`,
    "    });",
    "  });",
    "",
    `  it("keeps ${product.name} onboarding empty for the first generated slice", () => {`,
    "    expect(",
    `      ${camelName}ProductModule.buildOnboardingStepViews({`,
    "        activeOnboarding: { steps: [] },",
    '        activeOrganizationId: "org-1"',
    "      })",
    "    ).toEqual([]);",
    "  });",
    "});"
  ].join("\n");
}

function renderProductHomeScreen(product: GeneratedProductSpec) {
  const pascalName = toPascalCase(product.id);

  return [
    'import Link from "next/link";',
    'import type { Route } from "next";',
    "",
    'import { PageShell } from "@/src/components/ui/page-shell";',
    "",
    `export function ${pascalName}HomeScreen(input: {`,
    "  organizationName?: string;",
    "  resourceLinks: readonly {",
    "    href: string;",
    "    label: string;",
    "  }[];",
    "}) {",
    "  return (",
    "    <PageShell>",
    '      <div className="grid gap-6">',
    '        <header className="grid gap-2">',
    `          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">${product.name}</p>`,
    '          <h1 className="text-3xl font-semibold text-[var(--foreground)]">',
    "            {input.organizationName",
    `              ? \`${"${input.organizationName}"} ${product.name.toLowerCase()}\``,
    `              : ${JSON.stringify(product.home?.title ?? `${product.name} workspace`)}}`,
    "          </h1>",
    `          <p className="max-w-2xl text-sm text-[var(--muted)]">${product.home?.description ?? product.description ?? `${product.name} generated workspace`}</p>`,
    "        </header>",
    '        <div className="flex flex-wrap gap-3">',
    "          {input.resourceLinks.map((resourceLink) => (",
    "            <Link",
    '              key={resourceLink.href}',
    '              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium"',
    "              href={resourceLink.href as Route}",
    "            >",
    "              {resourceLink.label}",
    "            </Link>",
    "          ))}",
    "        </div>",
    "      </div>",
    "    </PageShell>",
    "  );",
    "}"
  ].join("\n");
}

function renderProductHomePage(product: GeneratedProductSpec) {
  const pascalName = toPascalCase(product.id);

  return [
    'import { AppShell } from "@/src/components/layout/app-shell";',
    'import { requireCurrentUser } from "@/src/features/auth/server/auth-server";',
    'import { resolveWorkspaceContext } from "@/src/features/organizations/domain/workspace";',
    `import { ${pascalName}HomeScreen } from "@/src/features/${product.id}-product";`,
    "",
    'import { getProductMetadata, getShellProductConfig } from "@/app/product-module";',
    "",
    `export const metadata = getProductMetadata(${JSON.stringify(product.id)});`,
    "",
    "interface ProductPageProps {",
    "  searchParams: Promise<Record<string, string | string[] | undefined>>;",
    "}",
    "",
    "export default async function ProductPage({ searchParams }: ProductPageProps) {",
    "  const currentUser = await requireCurrentUser();",
    "  const resolvedSearchParams = await searchParams;",
    "  const workspace = resolveWorkspaceContext(",
    "    currentUser,",
    "    {",
    "      organizationId: getSearchValue(resolvedSearchParams.organizationId),",
    "      projectId: getSearchValue(resolvedSearchParams.projectId)",
    "    },",
    "    {",
    `      requiredProductId: ${JSON.stringify(product.id)}`,
    "    }",
    "  );",
    "  const shellProduct = getShellProductConfig({",
    "    activeOrganizationId: workspace.activeOrganizationId,",
    "    activeProjectId: workspace.activeProjectId,",
    "    installedProducts: workspace.activeOrganizationInstalledProducts,",
    `    preferredProductId: ${JSON.stringify(product.id)}`,
    "  });",
    "  const workspaceSuffix = buildWorkspaceSuffix(",
    "    workspace.activeOrganizationId,",
    "    workspace.activeProjectId",
    "  );",
    "",
    "  return (",
    "    <AppShell",
    "      activeOrganizationId={workspace.activeOrganizationId}",
    "      activeProjectId={workspace.activeProjectId}",
    "      availableProducts={shellProduct.availableProducts}",
    "      currentUser={currentUser}",
    "      productName={shellProduct.productName}",
    "      productNavItems={shellProduct.navItems}",
    "    >",
    `      <${pascalName}HomeScreen`,
    "        organizationName={workspace.activeOrganization?.name}",
    "        resourceLinks={[",
    ...product.resources.map((resourceEntry: GeneratedProductResource) =>
      `          { href: \`${resourceEntry.listPath}${"${workspaceSuffix}"}\`, label: ${JSON.stringify(
        resourceEntry.navLabel
      )} },`
    ),
    "        ]}",
    "      />",
    "    </AppShell>",
    "  );",
    "}",
    "",
    "function buildWorkspaceSuffix(",
    "  organizationId?: string,",
    "  projectId?: string",
    ") {",
    "  if (!organizationId) {",
    '    return "";',
    "  }",
    "",
    "  const query = new URLSearchParams({ organizationId });",
    "",
    "  if (projectId) {",
    '    query.set("projectId", projectId);',
    "  }",
    "",
    "  return `?${query.toString()}`;",
    "}",
    "",
    "function getSearchValue(value: string | string[] | undefined) {",
    '  return Array.isArray(value) ? value[0] : value;',
    "}"
  ].join("\n");
}

function renderProductResourceServerFile(
  product: GeneratedProductSpec,
  resourceEntry: GeneratedProductResource
) {
  const resourceId = resourceEntry.resource.resource;
  const pascalResource = toPascalCase(resourceId);
  const workspaceFunction = `${pascalResource}WorkspacePage`;
  const detailFunction = `${pascalResource}WorkspaceDetailPage`;
  const paramName = getProductResourceParamName(resourceEntry);
  const detailPath = resourceEntry.listPath;

  return [
    'import "server-only";',
    "",
    'import { revalidatePath } from "next/cache";',
    'import { redirect } from "next/navigation";',
    "",
    `import { create${pascalResource}InputSchema, update${pascalResource}InputSchema } from "@auditrail/domain/generated/${toKebabCase(resourceId)}";`,
    "",
    'import type { CurrentUserResponse } from "@/src/features/auth/domain/schemas";',
    'import { createServerApiClient } from "@/src/lib/api/server-api-client";',
    'import { resolveWorkspaceContext } from "@/src/features/organizations/domain/workspace";',
    `import { createResourceClient } from "@/src/features/${toKebabCase(resourceId)}/api/${toKebabCase(
      resourceId
    )}-client";`,
    "",
    `export async function load${workspaceFunction}(`,
    "  searchParams: Record<string, string | string[] | undefined>,",
    "  dependencies: {",
    "    currentUser: CurrentUserResponse;",
    "  }",
    ") {",
    "  const workspace = resolveWorkspaceContext(",
    "    dependencies.currentUser,",
    "    {",
    '      organizationId: getSearchValue(searchParams.organizationId),',
    '      projectId: getSearchValue(searchParams.projectId)',
    "    },",
    "    {",
    `      requiredProductId: ${JSON.stringify(product.id)}`,
    "    }",
    "  );",
    `  const items = workspace.activeOrganizationId`,
    `    ? (await createResourceClient(createServerApiClient()).list(`,
    "        workspace.activeOrganizationId",
    "      )).items",
    "    : [];",
    "",
    "  return {",
    "    items,",
    "    workspace",
    "  };",
    "}",
    "",
    `export async function load${detailFunction}(`,
    "  input: {",
    `    ${paramName}: string;`,
    "    searchParams: Record<string, string | string[] | undefined>;",
    "  },",
    "  dependencies: {",
    "    currentUser: CurrentUserResponse;",
    "  }",
    ") {",
    "  const workspace = resolveWorkspaceContext(",
    "    dependencies.currentUser,",
    "    {",
    '      organizationId: getSearchValue(input.searchParams.organizationId),',
    '      projectId: getSearchValue(input.searchParams.projectId)',
    "    },",
    "    {",
    `      requiredProductId: ${JSON.stringify(product.id)}`,
    "    }",
    "  );",
    `  const item = workspace.activeOrganizationId`,
    `    ? await createResourceClient(createServerApiClient()).get(`,
    "        workspace.activeOrganizationId,",
    `        input.${paramName}`,
    "      )",
    "    : null;",
    "",
    "  return {",
    "    item,",
    "    workspace",
    "  };",
    "}",
    "",
    `export async function create${pascalResource}WorkspaceAction(formData: FormData) {`,
    '  "use server";',
    "",
    '  const organizationId = String(formData.get("organizationId") ?? "");',
    '  const projectId = coerceString(formData.get("projectId"));',
    "",
    `  const payload = create${pascalResource}InputSchema.parse({`,
    ...renderCreateActionObjectLines(resourceEntry.resource).map(
      (line: string) => `    ${line}`
    ),
    "  });",
    "",
    "  await createResourceClient(createServerApiClient()).create(",
    "    organizationId,",
    "    payload",
    "  );",
    "",
    `  const nextPath = ${JSON.stringify(resourceEntry.listPath)} + buildWorkspaceSuffix(organizationId, projectId);`,
    "  revalidatePath(nextPath);",
    "  redirect(nextPath as never);",
    "}",
    "",
    `export async function update${pascalResource}WorkspaceAction(formData: FormData) {`,
    '  "use server";',
    "",
    `  const ${paramName} = String(formData.get(${JSON.stringify(paramName)}) ?? "");`,
    '  const organizationId = String(formData.get("organizationId") ?? "");',
    '  const projectId = coerceString(formData.get("projectId"));',
    "",
    `  const payload = update${pascalResource}InputSchema.parse({`,
    ...renderCreateActionObjectLines(resourceEntry.resource).map(
      (line: string) => `    ${line}`
    ),
    "  });",
    "",
    "  await createResourceClient(createServerApiClient()).update(",
    "    organizationId,",
    `    ${paramName},`,
    "    payload",
    "  );",
    "",
    `  const nextPath = buildResourcePath(${JSON.stringify(detailPath)}, ${paramName}, organizationId, projectId);`,
    `  const listPath = ${JSON.stringify(resourceEntry.listPath)} + buildWorkspaceSuffix(organizationId, projectId);`,
    "  revalidatePath(nextPath);",
    "  revalidatePath(listPath);",
    "  redirect(nextPath as never);",
    "}",
    "",
    "function buildWorkspaceSuffix(",
    "  organizationId: string,",
    "  projectId?: string",
    ") {",
    "  const query = new URLSearchParams({ organizationId });",
    "",
    "  if (projectId) {",
    '    query.set("projectId", projectId);',
    "  }",
    "",
    "  return `?${query.toString()}`;",
    "}",
    "",
    "function buildResourcePath(",
    "  basePath: string,",
    "  id: string,",
    "  organizationId: string,",
    "  projectId?: string",
    ") {",
    "  return `${basePath}/${id}${buildWorkspaceSuffix(organizationId, projectId)}`;",
    "}",
    "",
    "function getSearchValue(value: string | string[] | undefined) {",
    '  return Array.isArray(value) ? value[0] : value;',
    "}",
    "",
    "function coerceString(value: FormDataEntryValue | null) {",
    "  if (typeof value !== \"string\") {",
    "    return undefined;",
    "  }",
    "",
    "  const trimmed = value.trim();",
    "",
    "  return trimmed.length > 0 ? trimmed : undefined;",
    "}",
    "",
    "function coerceDatetime(value: FormDataEntryValue | null) {",
    "  const trimmed = coerceString(value);",
    "",
    "  return trimmed ? new Date(trimmed).toISOString() : undefined;",
    "}",
    "",
    "function coerceBoolean(value: FormDataEntryValue | null) {",
    '  return value === "on";',
    "}"
  ].join("\n");
}

function renderProductResourceListPage(
  product: GeneratedProductSpec,
  resourceEntry: GeneratedProductResource
) {
  const resourceId = resourceEntry.resource.resource;
  const pascalResource = toPascalCase(resourceId);

  return [
    'import { AppShell } from "@/src/components/layout/app-shell";',
    'import { requireCurrentUser } from "@/src/features/auth/server/auth-server";',
    `import { ${pascalResource}Form } from "@/src/features/${toKebabCase(resourceId)}/components/${toKebabCase(
      resourceId
    )}-form";`,
    `import { ${pascalResource}Screen } from "@/src/features/${toKebabCase(resourceId)}/components/${toKebabCase(
      resourceId
    )}-screen";`,
    "",
    'import { getShellProductConfig } from "@/app/product-module";',
    `import {`,
    `  create${pascalResource}WorkspaceAction,`,
    `  load${pascalResource}WorkspacePage`,
    `} from "@/src/features/${product.id}-product/server/${toKebabCase(resourceId)}-workspace";`,
    "",
    "interface ResourcePageProps {",
    "  searchParams: Promise<Record<string, string | string[] | undefined>>;",
    "}",
    "",
    "export default async function ResourcePage({ searchParams }: ResourcePageProps) {",
    "  const currentUser = await requireCurrentUser();",
    "  const resolvedSearchParams = await searchParams;",
    `  const data = await load${pascalResource}WorkspacePage(resolvedSearchParams, {`,
    "    currentUser",
    "  });",
    "  const shellProduct = getShellProductConfig({",
    "    activeOrganizationId: data.workspace.activeOrganizationId,",
    "    activeProjectId: data.workspace.activeProjectId,",
    "    installedProducts: data.workspace.activeOrganizationInstalledProducts,",
    `    preferredProductId: ${JSON.stringify(product.id)}`,
    "  });",
    "",
    "  return (",
    "    <AppShell",
    "      activeOrganizationId={data.workspace.activeOrganizationId}",
    "      activeProjectId={data.workspace.activeProjectId}",
    "      availableProducts={shellProduct.availableProducts}",
    "      currentUser={currentUser}",
    "      productName={shellProduct.productName}",
    "      productNavItems={shellProduct.navItems}",
    "    >",
    '      <div className="grid gap-6">',
    '        <header className="grid gap-2">',
    `          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">${resourceEntry.navLabel}</p>`,
    `          <h1 className="text-3xl font-semibold text-[var(--foreground)]">${resourceEntry.navLabel}</h1>`,
    `          <p className="max-w-2xl text-sm text-[var(--muted)]">This generated product route loads real ${resourceEntry.resource.pluralLabel.toLowerCase()} through the API seam and allows inline creation.</p>`,
    "        </header>",
    `        <${pascalResource}Form action={create${pascalResource}WorkspaceAction} submitLabel="Create ${resourceEntry.resource.label}">`,
    '          <input name="organizationId" type="hidden" value={data.workspace.activeOrganizationId ?? ""} />',
    '          <input name="projectId" type="hidden" value={data.workspace.activeProjectId ?? ""} />',
    `        </${pascalResource}Form>`,
    `        <${pascalResource}Screen`,
    "          items={data.items}",
    "          organizationId={data.workspace.activeOrganizationId ?? undefined}",
    "          projectId={data.workspace.activeProjectId ?? undefined}",
    `          resourceBasePath=${JSON.stringify(resourceEntry.listPath)}`,
    "        />",
    "      </div>",
    "    </AppShell>",
    "  );",
    "}"
  ].join("\n");
}

function renderProductResourceDetailPage(
  product: GeneratedProductSpec,
  resourceEntry: GeneratedProductResource
) {
  const resourceId = resourceEntry.resource.resource;
  const pascalResource = toPascalCase(resourceId);
  const paramName = getProductResourceParamName(resourceEntry);
  const displayField = getProductResourceDisplayField(resourceEntry);

  return [
    'import { AppShell } from "@/src/components/layout/app-shell";',
    'import { requireCurrentUser } from "@/src/features/auth/server/auth-server";',
    "",
    'import { getShellProductConfig } from "@/app/product-module";',
    `import { load${pascalResource}WorkspaceDetailPage } from "@/src/features/${product.id}-product/server/${toKebabCase(
      resourceId
    )}-workspace";`,
    "",
    "interface ResourceDetailPageProps {",
    `  params: Promise<{ ${paramName}: string }>;`,
    "  searchParams: Promise<Record<string, string | string[] | undefined>>;",
    "}",
    "",
    "export default async function ResourceDetailPage({",
    "  params,",
    "  searchParams",
    "}: ResourceDetailPageProps) {",
    "  const currentUser = await requireCurrentUser();",
    "  const resolvedParams = await params;",
    "  const resolvedSearchParams = await searchParams;",
    `  const data = await load${pascalResource}WorkspaceDetailPage(`,
    "    {",
    `      ${paramName}: resolvedParams.${paramName},`,
    "      searchParams: resolvedSearchParams",
    "    },",
    "    {",
    "      currentUser",
    "    }",
    "  );",
    "  const shellProduct = getShellProductConfig({",
    "    activeOrganizationId: data.workspace.activeOrganizationId,",
    "    activeProjectId: data.workspace.activeProjectId,",
    "    installedProducts: data.workspace.activeOrganizationInstalledProducts,",
    `    preferredProductId: ${JSON.stringify(product.id)}`,
    "  });",
    "  const workspaceSuffix = buildWorkspaceSuffix(",
    "    data.workspace.activeOrganizationId ?? \"\",",
    "    data.workspace.activeProjectId ?? undefined",
    "  );",
    `  const listHref = ${JSON.stringify(resourceEntry.listPath)} + workspaceSuffix;`,
    `  const editHref = data.item ? ${JSON.stringify(resourceEntry.listPath)} + \`/\${data.item.id}/edit\${workspaceSuffix}\` : listHref;`,
    "",
    "  return (",
    "    <AppShell",
    "      activeOrganizationId={data.workspace.activeOrganizationId}",
    "      activeProjectId={data.workspace.activeProjectId}",
    "      availableProducts={shellProduct.availableProducts}",
    "      currentUser={currentUser}",
    "      productName={shellProduct.productName}",
    "      productNavItems={shellProduct.navItems}",
    "    >",
    '      <div className="grid gap-6">',
    '        <header className="grid gap-3">',
    `          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">${resourceEntry.resource.label} detail</p>`,
    '          <div className="flex flex-wrap items-center justify-between gap-3">',
    `            <h1 className="text-3xl font-semibold text-[var(--foreground)]">{data.item?.${displayField}?.toString() ?? ${JSON.stringify(
      resourceEntry.resource.label
    )}}</h1>`,
    '            <div className="flex gap-3 text-sm">',
    '              <a className="rounded-md border border-[var(--border)] px-3 py-2" href={listHref}>Back to list</a>',
    '              {data.item ? <a className="rounded-md border border-[var(--border)] px-3 py-2" href={editHref}>Edit</a> : null}',
    "            </div>",
    "          </div>",
    "        </header>",
    "        {data.item ? (",
    '          <section className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-4">',
    ...renderProductResourceDetailFields(resourceEntry),
    "          </section>",
    "        ) : (",
    '          <section className="rounded-xl border border-dashed border-[var(--border)] px-4 py-4 text-sm text-[var(--muted)]">',
    `            ${resourceEntry.resource.label} not found.`,
    "          </section>",
    "        )}",
    "      </div>",
    "    </AppShell>",
    "  );",
    "}",
    "",
    "function buildWorkspaceSuffix(",
    "  organizationId: string,",
    "  projectId?: string",
    ") {",
    "  const query = new URLSearchParams({ organizationId });",
    "",
    "  if (projectId) {",
    '    query.set("projectId", projectId);',
    "  }",
    "",
    "  return `?${query.toString()}`;",
    "}"
  ].join("\n");
}

function renderProductResourceEditPage(
  product: GeneratedProductSpec,
  resourceEntry: GeneratedProductResource
) {
  const resourceId = resourceEntry.resource.resource;
  const pascalResource = toPascalCase(resourceId);
  const paramName = getProductResourceParamName(resourceEntry);

  return [
    'import { AppShell } from "@/src/components/layout/app-shell";',
    'import { requireCurrentUser } from "@/src/features/auth/server/auth-server";',
    `import { ${pascalResource}Form } from "@/src/features/${toKebabCase(resourceId)}/components/${toKebabCase(
      resourceId
    )}-form";`,
    "",
    'import { getShellProductConfig } from "@/app/product-module";',
    `import {`,
    `  load${pascalResource}WorkspaceDetailPage,`,
    `  update${pascalResource}WorkspaceAction`,
    `} from "@/src/features/${product.id}-product/server/${toKebabCase(resourceId)}-workspace";`,
    "",
    "interface ResourceEditPageProps {",
    `  params: Promise<{ ${paramName}: string }>;`,
    "  searchParams: Promise<Record<string, string | string[] | undefined>>;",
    "}",
    "",
    "export default async function ResourceEditPage({",
    "  params,",
    "  searchParams",
    "}: ResourceEditPageProps) {",
    "  const currentUser = await requireCurrentUser();",
    "  const resolvedParams = await params;",
    "  const resolvedSearchParams = await searchParams;",
    `  const data = await load${pascalResource}WorkspaceDetailPage(`,
    "    {",
    `      ${paramName}: resolvedParams.${paramName},`,
    "      searchParams: resolvedSearchParams",
    "    },",
    "    {",
    "      currentUser",
    "    }",
    "  );",
    "  const shellProduct = getShellProductConfig({",
    "    activeOrganizationId: data.workspace.activeOrganizationId,",
    "    activeProjectId: data.workspace.activeProjectId,",
    "    installedProducts: data.workspace.activeOrganizationInstalledProducts,",
    `    preferredProductId: ${JSON.stringify(product.id)}`,
    "  });",
    "",
    "  return (",
    "    <AppShell",
    "      activeOrganizationId={data.workspace.activeOrganizationId}",
    "      activeProjectId={data.workspace.activeProjectId}",
    "      availableProducts={shellProduct.availableProducts}",
    "      currentUser={currentUser}",
    "      productName={shellProduct.productName}",
    "      productNavItems={shellProduct.navItems}",
    "    >",
    '      <div className="grid gap-6">',
    '        <header className="grid gap-2">',
    `          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Edit ${resourceEntry.resource.label}</p>`,
    `          <h1 className="text-3xl font-semibold text-[var(--foreground)]">Edit ${resourceEntry.resource.label}</h1>`,
    `          <p className="max-w-2xl text-sm text-[var(--muted)]">Update the generated ${resourceEntry.resource.label.toLowerCase()} record through the existing API seam.</p>`,
    "        </header>",
    `        <${pascalResource}Form`,
    `          action={update${pascalResource}WorkspaceAction}`,
    "          defaultValues={data.item ?? undefined}",
    `          submitLabel="Save ${resourceEntry.resource.label}"`,
    "        >",
    `          <input name="${paramName}" type="hidden" value={data.item?.id ?? resolvedParams.${paramName}} />`,
    '          <input name="organizationId" type="hidden" value={data.workspace.activeOrganizationId ?? ""} />',
    '          <input name="projectId" type="hidden" value={data.workspace.activeProjectId ?? ""} />',
    `        </${pascalResource}Form>`,
    "      </div>",
    "    </AppShell>",
    "  );",
    "}"
  ].join("\n");
}

function renderCreateActionObjectLines(resource: GeneratedProductResource["resource"]) {
  return resource.fields
    .filter(
      (field: GeneratedProductResource["resource"]["fields"][number]) =>
        !resource.timestamps.enabled ||
        ![
          resource.timestamps.createdAtField,
          resource.timestamps.updatedAtField
        ].includes(field.name)
    )
    .map(
      (field: GeneratedProductResource["resource"]["fields"][number]) =>
        `${field.name}: ${renderFormDataAccessor(field)},`
    );
}

function renderFormDataAccessor(
  field: GeneratedProductResource["resource"]["fields"][number]
) {
  switch (field.type) {
    case "boolean":
      return `coerceBoolean(formData.get(${JSON.stringify(field.name)}))`;
    case "datetime":
      return field.required
        ? `new Date(String(formData.get(${JSON.stringify(field.name)}) ?? "")).toISOString()`
        : `coerceDatetime(formData.get(${JSON.stringify(field.name)}))`;
    default:
      return field.required
        ? `String(formData.get(${JSON.stringify(field.name)}) ?? "")`
        : `coerceString(formData.get(${JSON.stringify(field.name)}))`;
  }
}

function getProductResourceParamName(resourceEntry: GeneratedProductResource) {
  return `${camelCase(resourceEntry.resource.resource)}Id`;
}

function getProductResourceDisplayField(
  resourceEntry: GeneratedProductResource
) {
  return (
    resourceEntry.resource.fields.find((field) => !field.hidden)?.name ?? "id"
  );
}

function renderProductResourceDetailFields(
  resourceEntry: GeneratedProductResource
) {
  return resourceEntry.resource.fields
    .filter((field) => !field.hidden)
    .map((field) => {
      const label = field.label ?? toTitleCase(field.name);

      return [
        '            <div className="grid gap-1">',
        `              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">${label}</p>`,
        `              <p>{data.item?.${field.name}?.toString() ?? "Not set"}</p>`,
        "            </div>"
      ].join("\n");
    });
}

function patchDomainPackageExports(contents: string, productId: string) {
  const parsed = JSON.parse(contents) as {
    exports?: Record<string, { import: string; types: string }>;
  };
  const exportKey = `./${productId}`;

  parsed.exports ??= {};

  if (!parsed.exports[exportKey]) {
    parsed.exports[exportKey] = {
      import: `./src/${productId}/index.ts`,
      types: `./src/${productId}/index.ts`
    };
  }

  return `${JSON.stringify(parsed, null, 2)}\n`;
}

function patchApiProductRuntime(contents: string, productId: string) {
  const pascalName = toPascalCase(productId);
  const camelName = camelCase(productId);
  const importLine = `import { ${camelName}ProductModule } from "@auditrail/domain/${productId}";`;

  const withImport = insertAfterAnchor({
    anchor: 'import { projectsProductModule } from "@auditrail/domain/projects";',
    contents,
    insertion: importLine
  });

  return withImport.replace(
    /const registeredProductModules = \[\n([\s\S]*?)\n\] as const satisfies readonly ApiProductModule\[\];/,
    (match, body: string) => {
      if (body.includes(`${camelName}ProductModule`)) {
        return match;
      }

      return `const registeredProductModules = [\n${body},\n  ${camelName}ProductModule\n] as const satisfies readonly ApiProductModule[];`;
    }
  );
}

function patchWebProductRuntime(contents: string, productId: string) {
  const camelName = camelCase(productId);
  const importLine = `import { ${camelName}ProductModule } from "@auditrail/domain/${productId}";`;

  const withImport = insertAfterAnchor({
    anchor: 'import { projectsProductModule } from "@auditrail/domain/projects";',
    contents,
    insertion: importLine
  });

  return withImport.replace(
    /const registeredProductModules = \[\n([\s\S]*?)\n\] as const satisfies readonly RegisteredProductModule\[\];/,
    (match, body: string) => {
      if (body.includes(`${camelName}ProductModule`)) {
        return match;
      }

      return `const registeredProductModules = [\n${body},\n  ${camelName}ProductModule\n] as const satisfies readonly RegisteredProductModule[];`;
    }
  );
}

function patchApiProductRuntimeTest(
  contents: string,
  product: GeneratedProductSpec
) {
  const productEntry = `      {\n        id: ${JSON.stringify(product.id)},\n        name: ${JSON.stringify(product.name)}\n      }`;

  return contents.replace(
    /expect\(runtime\.listRegisteredProducts\(\)\)\.toEqual\(\[\n([\s\S]*?)\n    \]\);/,
    (match, body: string) => {
      if (body.includes(`id: "${product.id}"`) || body.includes(`id: '${product.id}'`)) {
        return match;
      }

      return `expect(runtime.listRegisteredProducts()).toEqual([\n${body},\n${productEntry}\n    ]);`;
    }
  );
}

function patchRootFile(input: {
  filePath: string;
  repoRoot: string;
  update: (contents: string) => string;
}) {
  const absolutePath = resolve(input.repoRoot, input.filePath);

  if (!existsSync(absolutePath)) {
    throw new Error(`Missing required root file '${input.filePath}'.`);
  }

  const nextContents = input.update(readFileSync(absolutePath, "utf8"));
  writeFileSync(absolutePath, ensureTrailingNewline(nextContents));
}

function ensureWritableFiles(input: {
  files: readonly PendingProductFile[];
  force: boolean;
  repoRoot: string;
}) {
  const conflicts = input.files
    .map((file) => resolve(input.repoRoot, file.path))
    .filter((path) => existsSync(path));

  if (conflicts.length > 0 && !input.force) {
    throw new Error(
      [
        "Refusing to overwrite existing generated product files without --force.",
        ...conflicts.slice(0, 10).map((path) =>
          `- ${relative(input.repoRoot, path).replace(/\\/g, "/")}`
        )
      ].join("\n")
    );
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

function ensureTrailingNewline(value: string) {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function trimLeadingSlash(value: string) {
  return value.startsWith("/") ? value.slice(1) : value;
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

function camelCase(value: string) {
  const pascal = toPascalCase(value);

  return pascal[0]!.toLowerCase() + pascal.slice(1);
}

function toTitleCase(value: string) {
  return toKebabCase(value)
    .split("-")
    .filter((segment) => segment.length > 0)
    .map((segment) => segment[0]!.toUpperCase() + segment.slice(1))
    .join(" ");
}
