export type ExtractionPathKind = "file" | "directory" | "glob";

export type ExtractionCategory =
  | "platform-core"
  | "platform-extension"
  | "audit-product"
  | "mixed"
  | "documentation"
  | "branding"
  | "workspace-config"
  | "deployment";

export type ExtractionAction =
  | "copy"
  | "exclude"
  | "template"
  | "manual-review";

export interface ExtractionManifestEntry {
  path: string;
  pathKind: ExtractionPathKind;
  category: ExtractionCategory;
  extractionAction: ExtractionAction;
  reason: string;
  notes: readonly string[];
  requiredForMinimalScaffold: boolean;
}

export interface ExtractionManifestSection {
  description: string;
  entries: readonly ExtractionManifestEntry[];
}

export interface ExtractionManifest {
  version: 1;
  status: "advisory";
  extractionSupport: "planned-not-implemented";
  futureScriptPolicy: {
    failClosedOnUnknownPaths: true;
    requireExplicitTemplateEntries: true;
    requireManualReviewForMixedOwnership: true;
  };
  copyToBoilerplate: ExtractionManifestSection;
  excludeFromBoilerplate: ExtractionManifestSection;
  replaceWithTemplate: ExtractionManifestSection;
  requiresManualReview: ExtractionManifestSection;
  productSpecific: ExtractionManifestSection;
  platformCore: ExtractionManifestSection;
  platformExtension: ExtractionManifestSection;
}

function entry(
  value: ExtractionManifestEntry
): ExtractionManifestEntry {
  return value;
}

const platformCoreEntries = [
  entry({
    path: "apps/api/src/modules/auth/**",
    pathKind: "glob",
    category: "platform-core",
    extractionAction: "copy",
    reason: "Browser-session auth and magic-link flows are reusable SaaS foundation work.",
    notes: [
      "Keep route and service boundaries generic.",
      "Replace sender copy and provider wiring through templated product branding."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/api/src/modules/api-keys/**",
    pathKind: "glob",
    category: "platform-core",
    extractionAction: "copy",
    reason: "API key management is a generic machine-credential platform surface.",
    notes: [
      "Preserve organization and project scoping.",
      "Do not couple generated boilerplate keys to AuditTrail naming."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/api/src/modules/platform/**",
    pathKind: "glob",
    category: "platform-core",
    extractionAction: "copy",
    reason: "Organizations, memberships, invitations, onboarding composition, billing status, entitlements, and support seams are platform-owned.",
    notes: [
      "Future extraction script should still inspect route composition for product-specific response content.",
      "Platform modules must remain free of audit-product imports."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/web/src/features/auth/**",
    pathKind: "glob",
    category: "platform-core",
    extractionAction: "copy",
    reason: "Hosted sign-in and session flows are generic SaaS UI surfaces.",
    notes: [
      "Template any product strings shown to end users.",
      "Keep API client wiring generic."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/web/src/features/organizations/**",
    pathKind: "glob",
    category: "platform-core",
    extractionAction: "copy",
    reason: "Workspace settings, memberships, projects, plan or usage shells, and billing UI seams are reusable platform UX.",
    notes: [
      "Template labels that currently mention AuditTrail event usage.",
      "Preserve provider-neutral billing behavior."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/web/src/features/invitations/**",
    pathKind: "glob",
    category: "platform-core",
    extractionAction: "copy",
    reason: "Invitation acceptance is generic multi-tenant SaaS behavior.",
    notes: [
      "Keep domain schemas reusable.",
      "Avoid product copy leakage in success and error screens."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/web/src/features/api-keys/**",
    pathKind: "glob",
    category: "platform-core",
    extractionAction: "copy",
    reason: "API key administration UI is reusable across products.",
    notes: [
      "Keep generated key display flow generic.",
      "Do not embed AuditTrail-specific ingest instructions here."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/web/src/features/onboarding/**",
    pathKind: "glob",
    category: "platform-core",
    extractionAction: "copy",
    reason: "The onboarding framework and reusable shells are platform-owned.",
    notes: [
      "Do not copy AuditTrail-specific step copy into the boilerplate.",
      "Pair with templated product onboarding adapters."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/web/src/components/layout/app-shell.tsx",
    pathKind: "file",
    category: "platform-core",
    extractionAction: "copy",
    reason: "The shared dashboard and settings shell should seed the boilerplate.",
    notes: [
      "Keep product name and nav items injected from product config.",
      "Manual review is still needed for route composition files under apps/web/app."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/web/src/components/ui/**",
    pathKind: "glob",
    category: "platform-core",
    extractionAction: "copy",
    reason: "UI primitives are reusable across products.",
    notes: [
      "These primitives should stay product-neutral.",
      "Icons or logos should be templated elsewhere."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/web/src/lib/**",
    pathKind: "glob",
    category: "platform-core",
    extractionAction: "copy",
    reason: "API clients and shared UI helpers are needed by the generic shell.",
    notes: [
      "Regenerate OpenAPI-derived types after extraction.",
      "Review generated schema files against the extracted API contract."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/web/src/config/**",
    pathKind: "glob",
    category: "platform-core",
    extractionAction: "copy",
    reason: "Web env parsing and validation should move with the reusable app shell.",
    notes: [
      "Template default cookie or branding values if they carry product naming.",
      "Preserve explicit env validation."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "packages/config/**",
    pathKind: "glob",
    category: "platform-core",
    extractionAction: "copy",
    reason: "Shared config parsing helpers are reusable platform infrastructure.",
    notes: [
      "Keep environment parsing centralized.",
      "This package is already product-neutral."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "packages/testkit/**",
    pathKind: "glob",
    category: "platform-core",
    extractionAction: "copy",
    reason: "Test helpers are needed for a reusable scaffold and validation flow.",
    notes: [
      "Review default connection strings and cookie names for templating.",
      "Keep helpers generic and test-only."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "packages/architecture-boundaries/**",
    pathKind: "glob",
    category: "platform-core",
    extractionAction: "copy",
    reason: "Boundary tooling should move with the platform code so product code stays isolated.",
    notes: [
      "Update boundary glob patterns after extraction.",
      "Retain the rule that platform code must not depend on product code."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "tools/architecture-boundaries/rules.ts",
    pathKind: "file",
    category: "platform-core",
    extractionAction: "copy",
    reason: "The canonical boundary map belongs with architecture enforcement tooling.",
    notes: [
      "Replace AuditTrail-specific roots with the extracted boilerplate roots.",
      "Keep this in sync with the boundary package."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "tools/check-architecture-boundaries.ts",
    pathKind: "file",
    category: "platform-core",
    extractionAction: "copy",
    reason: "The repo-level boundary scanner is part of quality-gate tooling for the boilerplate.",
    notes: [
      "Future boilerplate CI should run this early.",
      "Scanner output should remain fail-fast and readable."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "packages/domain/src/product/**",
    pathKind: "glob",
    category: "platform-core",
    extractionAction: "copy",
    reason: "The product-definition framework is intentionally generic and should seed future products.",
    notes: [
      "Extract without the AuditTrail-owned product config.",
      "Use this seam to inject placeholder product metadata."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "packages/domain/src/onboarding/**",
    pathKind: "glob",
    category: "platform-core",
    extractionAction: "copy",
    reason: "Generic onboarding step and progress logic is reusable platform domain code.",
    notes: [
      "Keep milestone ids product-owned outside this package.",
      "Do not reintroduce audit-specific step names here."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "packages/domain/src/entitlements/**",
    pathKind: "glob",
    category: "platform-core",
    extractionAction: "copy",
    reason: "Generic feature-gate and meter-limit vocabulary is reusable platform domain code.",
    notes: [
      "Keep entitlement logic pure.",
      "Product-specific meter labels belong in product config."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "packages/domain/src/billing/**",
    pathKind: "glob",
    category: "platform-core",
    extractionAction: "copy",
    reason: "Billing vocabulary and plan-to-entitlement linkage are reusable domain seams.",
    notes: [
      "Provider wiring stays outside the pure domain package.",
      "Do not copy provider secrets."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "packages/domain/src/internal-support/**",
    pathKind: "glob",
    category: "platform-core",
    extractionAction: "copy",
    reason: "Support-role predicates and safe lookup vocabulary are generic platform capabilities.",
    notes: [
      "Keep the seam read-only and conservative.",
      "Do not treat support roles as customer-org bypasses."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "packages/domain/src/pricing/**",
    pathKind: "glob",
    category: "platform-core",
    extractionAction: "copy",
    reason: "Generic quota and plan helpers are reusable if later products use metered pricing.",
    notes: [
      "Template product-facing labels elsewhere.",
      "Review plan ids for product naming before extraction."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "packages/domain/src/time/**",
    pathKind: "glob",
    category: "platform-core",
    extractionAction: "copy",
    reason: "UTC window helpers are shared pure domain utilities.",
    notes: [
      "No product-specific content belongs here."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "packages/domain/src/usage/**",
    pathKind: "glob",
    category: "platform-core",
    extractionAction: "copy",
    reason: "Generic usage summarization helpers support platform entitlements and plan usage screens.",
    notes: [
      "Keep meter keys product-neutral in the shared layer."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "packages/db/src/client.ts",
    pathKind: "file",
    category: "platform-core",
    extractionAction: "copy",
    reason: "Shared database client creation belongs in the extracted platform foundation.",
    notes: [
      "Schema exports still need manual review because the package is mixed overall."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "packages/db/src/schema/billing.ts",
    pathKind: "file",
    category: "platform-core",
    extractionAction: "copy",
    reason: "Billing persistence is generic storage for reusable billing capabilities.",
    notes: [
      "Preserve provider-neutral storage semantics.",
      "Review organization references alongside identity schema extraction."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "packages/db/src/schema/jobs.ts",
    pathKind: "file",
    category: "platform-extension",
    extractionAction: "copy",
    reason: "The generic outbox table is reusable platform infrastructure.",
    notes: [
      "Keep job names and payload ownership product-neutral at the schema layer."
    ],
    requiredForMinimalScaffold: false
  })
] as const satisfies readonly ExtractionManifestEntry[];

const platformExtensionEntries = [
  entry({
    path: "apps/api/src/modules/jobs/**",
    pathKind: "glob",
    category: "platform-extension",
    extractionAction: "copy",
    reason: "Generic jobs and outbox persistence adapters belong in the future boilerplate.",
    notes: [
      "This is intentionally a skeleton today.",
      "Do not add product-specific handlers during extraction."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "apps/worker/**",
    pathKind: "glob",
    category: "platform-extension",
    extractionAction: "copy",
    reason: "The worker runtime boundary is reusable platform infrastructure.",
    notes: [
      "Current worker remains idle and generic.",
      "Template worker naming if product-specific defaults exist."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "packages/domain/src/jobs/**",
    pathKind: "glob",
    category: "platform-extension",
    extractionAction: "copy",
    reason: "Generic job vocabulary is reusable across future capabilities.",
    notes: [
      "Keep payload schemas product-neutral.",
      "Pair with the outbox table and worker registry when extracting."
    ],
    requiredForMinimalScaffold: false
  })
] as const satisfies readonly ExtractionManifestEntry[];

const productSpecificEntries = [
  entry({
    path: "apps/api/src/modules/audit-events/**",
    pathKind: "glob",
    category: "audit-product",
    extractionAction: "exclude",
    reason: "Audit event ingest, reads, stats, and quota behavior are AuditTrail product code.",
    notes: [
      "Do not copy into the boilerplate.",
      "A future extraction script should fail if this path is selected without explicit templating rules."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "apps/web/src/features/audit-events/**",
    pathKind: "glob",
    category: "audit-product",
    extractionAction: "exclude",
    reason: "AuditTrail event stream, charts, empty states, and detail UI are product-specific.",
    notes: [
      "Keep all audit-event UI out of the generic SaaS scaffold."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "packages/domain/src/audit-events/**",
    pathKind: "glob",
    category: "audit-product",
    extractionAction: "exclude",
    reason: "The AuditTrail product definition, onboarding milestones, and ingest domain live here.",
    notes: [
      "This path is the main product-owned config seam.",
      "Only explicit templates may replace selected concerns from this area."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "apps/web/src/features/audit-events/product/**",
    pathKind: "glob",
    category: "audit-product",
    extractionAction: "exclude",
    reason: "AuditTrail feature-local copy adapters remain product-owned.",
    notes: [
      "These adapters intentionally bind generic UI to audit-owned config."
    ],
    requiredForMinimalScaffold: false
  })
] as const satisfies readonly ExtractionManifestEntry[];

const replaceWithTemplateEntries = [
  entry({
    path: "packages/domain/src/audit-events/product.ts",
    pathKind: "file",
    category: "audit-product",
    extractionAction: "template",
    reason: "The boilerplate needs a placeholder product definition, not the AuditTrail one.",
    notes: [
      "Generate a neutral example product id, name, nav item, onboarding copy, empty states, and usage meters.",
      "Keep the generic product-definition types and validation seam."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/web/app/audit-product-navigation.ts",
    pathKind: "file",
    category: "branding",
    extractionAction: "template",
    reason: "The app-shell nav adapter should point at placeholder product config in the extracted boilerplate.",
    notes: [
      "Rename away from the AuditTrail-specific filename during extraction.",
      "Keep workspace-scoped href composition behavior."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/web/app/audit-product-chrome.ts",
    pathKind: "file",
    category: "branding",
    extractionAction: "template",
    reason: "Top-level app metadata and loading or error copy need generic placeholders.",
    notes: [
      "Replace product name, metadata title, and descriptions.",
      "Preserve the adapter pattern so shared app files stay product-neutral."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/web/app/getting-started/audit-product-onboarding.ts",
    pathKind: "file",
    category: "branding",
    extractionAction: "template",
    reason: "Onboarding step copy and CTA targets must be product-owned in the boilerplate.",
    notes: [
      "Keep the reusable onboarding UI.",
      "Generate placeholder step descriptions instead of copying AuditTrail setup flow."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/web/app/audit-product-settings.ts",
    pathKind: "file",
    category: "branding",
    extractionAction: "template",
    reason: "Plan or usage labels and descriptions should become product-neutral placeholders.",
    notes: [
      "Preserve the composition boundary into generic settings components."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "README.md",
    pathKind: "file",
    category: "documentation",
    extractionAction: "template",
    reason: "Root setup docs currently describe AuditTrail and need boilerplate-specific wording.",
    notes: [
      "Replace product story, screenshots, and product-specific setup examples.",
      "Keep verification and architecture guidance where still accurate."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/api/src/modules/auth/senders.ts",
    pathKind: "file",
    category: "branding",
    extractionAction: "template",
    reason: "Magic-link email subject and copy currently name AuditTrail.",
    notes: [
      "Template sender copy and URLs only.",
      "Keep provider adapter behavior unchanged."
    ],
    requiredForMinimalScaffold: true
  })
] as const satisfies readonly ExtractionManifestEntry[];

const manualReviewEntries = [
  entry({
    path: "packages/domain/src/index.ts",
    pathKind: "file",
    category: "mixed",
    extractionAction: "manual-review",
    reason: "The root domain barrel is generic by design but must stay free of product exports after extraction.",
    notes: [
      "Verify no AuditTrail-only modules are re-exported.",
      "Future script should fail if this barrel references product paths."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "packages/db/src/index.ts",
    pathKind: "file",
    category: "mixed",
    extractionAction: "manual-review",
    reason: "DB package exports may include both generic and AuditTrail-specific schema surfaces.",
    notes: [
      "Split or prune exports during extraction rather than copying blindly."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "packages/db/src/schema/index.ts",
    pathKind: "file",
    category: "mixed",
    extractionAction: "manual-review",
    reason: "Schema export aggregation mixes platform and audit tables.",
    notes: [
      "Keep generic tables.",
      "Exclude or isolate audit-event tables."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "packages/db/src/schema/identity.ts",
    pathKind: "file",
    category: "mixed",
    extractionAction: "manual-review",
    reason: "Identity schema mixes generic tenant/auth tables with current pricing and onboarding assumptions.",
    notes: [
      "Most of this file should move to the boilerplate.",
      "Review plan ids, defaults, and product naming before extraction."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "packages/db/src/schema/audit-events.ts",
    pathKind: "file",
    category: "mixed",
    extractionAction: "manual-review",
    reason: "Audit event persistence is product-specific and lives beside generic schema exports.",
    notes: [
      "Exclude from the boilerplate unless later replaced with a different example product."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "packages/db/src/migrations/**",
    pathKind: "glob",
    category: "mixed",
    extractionAction: "manual-review",
    reason: "Migration history mixes platform foundation, generic extensions, and audit-product tables.",
    notes: [
      "A future extraction script should rebuild or filter migration history deliberately.",
      "Do not copy all migrations blindly."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/api/src/app.ts",
    pathKind: "file",
    category: "mixed",
    extractionAction: "manual-review",
    reason: "App route composition wires both platform and AuditTrail product modules together.",
    notes: [
      "Keep platform route registration.",
      "Remove audit-event registration in the extracted boilerplate."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/api/src/http-schemas.ts",
    pathKind: "file",
    category: "mixed",
    extractionAction: "manual-review",
    reason: "Shared API schemas currently include both platform and audit-product response shapes.",
    notes: [
      "Split generic schemas from audit-event contracts before automated extraction."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/web/app/page.tsx",
    pathKind: "file",
    category: "mixed",
    extractionAction: "manual-review",
    reason: "The home route currently composes audit-event dashboard content with generic shell infrastructure.",
    notes: [
      "Replace with a placeholder product landing screen or dashboard shell."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/web/app/settings/page.tsx",
    pathKind: "file",
    category: "mixed",
    extractionAction: "manual-review",
    reason: "The settings route is mostly platform-owned but composes product-specific plan or usage copy.",
    notes: [
      "Keep the generic settings shell.",
      "Rewire to placeholder product config adapters."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/web/app/getting-started/page.tsx",
    pathKind: "file",
    category: "mixed",
    extractionAction: "manual-review",
    reason: "The onboarding route uses reusable UI but composes AuditTrail-owned copy and CTA mapping.",
    notes: [
      "Retain the route shell.",
      "Swap in templated product onboarding config."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/web/app/layout.tsx",
    pathKind: "file",
    category: "mixed",
    extractionAction: "manual-review",
    reason: "The root layout is generic structurally but imports AuditTrail chrome metadata through an adapter.",
    notes: [
      "Keep the generic layout.",
      "Point it at boilerplate product chrome."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "docs/**",
    pathKind: "glob",
    category: "documentation",
    extractionAction: "manual-review",
    reason: "Docs contain a mix of platform guidance and AuditTrail-specific product, deployment, and ops details.",
    notes: [
      "Future extraction should template or rewrite docs selectively.",
      "Do not copy product-specific operational instructions into the boilerplate verbatim."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "docker-compose.yml",
    pathKind: "file",
    category: "deployment",
    extractionAction: "manual-review",
    reason: "Local compose config contains AuditTrail service naming and defaults.",
    notes: [
      "Template service names, database names, and any product-specific defaults."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "docker-compose.coolify.yml",
    pathKind: "file",
    category: "deployment",
    extractionAction: "manual-review",
    reason: "Hosted deployment config includes AuditTrail-specific service names and database identifiers.",
    notes: [
      "Template product naming and any public URLs.",
      "Preserve the platform deployment shape only if it fits the extracted scaffold."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "package.json",
    pathKind: "file",
    category: "workspace-config",
    extractionAction: "manual-review",
    reason: "Workspace scripts and package name reference AuditTrail package identities.",
    notes: [
      "Rename root package and any package filters during extraction.",
      "Keep quality-gate scripts that still apply."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "pnpm-workspace.yaml",
    pathKind: "file",
    category: "workspace-config",
    extractionAction: "manual-review",
    reason: "The workspace layout is likely reusable but should still be checked against the extracted package set.",
    notes: [
      "Fail closed if unexpected apps or packages remain."
    ],
    requiredForMinimalScaffold: true
  })
] as const satisfies readonly ExtractionManifestEntry[];

const copyToBoilerplateEntries = [
  ...platformCoreEntries,
  ...platformExtensionEntries
] as const satisfies readonly ExtractionManifestEntry[];

const excludeFromBoilerplateEntries = [
  ...productSpecificEntries
] as const satisfies readonly ExtractionManifestEntry[];

export const extractionManifest = {
  version: 1,
  status: "advisory",
  extractionSupport: "planned-not-implemented",
  futureScriptPolicy: {
    failClosedOnUnknownPaths: true,
    requireExplicitTemplateEntries: true,
    requireManualReviewForMixedOwnership: true
  },
  copyToBoilerplate: {
    description:
      "Paths that a future dry-run extraction script may copy into a generic SaaS boilerplate when no product-specific adaptation is required.",
    entries: copyToBoilerplateEntries
  },
  excludeFromBoilerplate: {
    description:
      "Paths that must stay in the AuditTrail product repo unless a later task adds explicit templating or a replacement strategy.",
    entries: excludeFromBoilerplateEntries
  },
  replaceWithTemplate: {
    description:
      "Paths whose current implementation is product-shaped and should be replaced with placeholder boilerplate equivalents during extraction.",
    entries: replaceWithTemplateEntries
  },
  requiresManualReview: {
    description:
      "Paths that mix platform and AuditTrail concerns, aggregate exports, or contain deployment and documentation details that are unsafe to copy blindly.",
    entries: manualReviewEntries
  },
  productSpecific: {
    description:
      "AuditTrail-owned modules and adapters that define the current audit-event product and must not become default boilerplate code.",
    entries: productSpecificEntries
  },
  platformCore: {
    description:
      "Reusable SaaS foundations that should remain audit-free and form the base of any future extracted boilerplate.",
    entries: platformCoreEntries
  },
  platformExtension: {
    description:
      "Reusable but optional platform capabilities that should stay generic when extracted, including jobs and the worker runtime boundary.",
    entries: platformExtensionEntries
  }
} as const satisfies ExtractionManifest;

