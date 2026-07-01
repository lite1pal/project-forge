export type ExtractionPathKind = "file" | "directory" | "glob";

export type ExtractionCategory =
  | "platform-core"
  | "platform-extension"
  | "audit-product"
  | "mixed"
  | "documentation"
  | "branding"
  | "repo-tooling"
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
  allowEmptyMatch?: boolean;
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
    path: "apps/api/src/plugins/**",
    pathKind: "glob",
    category: "platform-core",
    extractionAction: "copy",
    reason: "Fastify plugin seams for auth, database, rate limiting, request runtime, and session resolution are reusable platform infrastructure.",
    notes: [
      "Keep plugin behavior generic and audit-free.",
      "Review app composition separately."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/api/src/api-version.ts",
    pathKind: "file",
    category: "platform-core",
    extractionAction: "copy",
    reason: "API version helpers are reusable platform runtime metadata.",
    notes: [
      "Keep the versioned prefix contract generic."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/api/src/config.ts",
    pathKind: "file",
    category: "platform-core",
    extractionAction: "copy",
    reason: "API env parsing and validation are reusable runtime foundations.",
    notes: [
      "Template default product-facing cookie names only if needed."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/api/src/env-files.ts",
    pathKind: "file",
    category: "platform-core",
    extractionAction: "copy",
    reason: "Repo and app env-file loading precedence is reusable platform behavior.",
    notes: [
      "Preserve root then app-local then process-env precedence."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/api/src/http-errors.ts",
    pathKind: "file",
    category: "platform-core",
    extractionAction: "copy",
    reason: "Centralized API error handling is platform runtime infrastructure.",
    notes: [
      "Keep safe production error collapsing and request correlation behavior."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/api/src/validate-env.ts",
    pathKind: "file",
    category: "platform-core",
    extractionAction: "copy",
    reason: "The build and startup env validator is reusable platform tooling.",
    notes: [
      "Keep it aligned with config parsing."
    ],
    requiredForMinimalScaffold: true
  }),
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
    path: "packages/db/src/schema/products.ts",
    pathKind: "file",
    category: "platform-core",
    extractionAction: "copy",
    reason: "Installed-product persistence is reusable platform storage for multi-product organization state.",
    notes: [
      "Keep product enablement generic and separate from product-owned runtime modules."
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
    path: "apps/web/src/components/layout/**",
    pathKind: "glob",
    category: "platform-core",
    extractionAction: "copy",
    reason: "Shared layout components and their tests belong with the reusable shell.",
    notes: [
      "Keep shell composition generic and product-config driven."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/web/app/auth/**",
    pathKind: "glob",
    category: "platform-core",
    extractionAction: "copy",
    reason: "Auth route composition pages are generic hosted-SaaS browser flows.",
    notes: [
      "Template any product-facing copy only through feature or product seams."
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
    path: "apps/web/src/test/**",
    pathKind: "glob",
    category: "platform-core",
    extractionAction: "copy",
    reason: "Web test-only helper shims are reusable support code for the platform UI test suite.",
    notes: [
      "Keep these helpers generic and test-only."
    ],
    requiredForMinimalScaffold: false
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
    path: "tools/saas/**",
    pathKind: "glob",
    category: "platform-extension",
    extractionAction: "copy",
    reason: "The framework doctor CLI is reusable platform-extension tooling for validating a repo before generators or agent automation are added.",
    notes: [
      "Keep the command deterministic, local-only, and inspection-based.",
      "Do not add scaffold mutation or runtime code generation in this tooling slice."
    ],
    requiredForMinimalScaffold: false
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
    path: "packages/db/src/schema/identity.ts",
    pathKind: "file",
    category: "platform-core",
    extractionAction: "copy",
    reason: "The shared tenant, auth, invitation, onboarding-state, export-job, and generic meter schema currently live in one reusable DB module.",
    notes: [
      "This file is broad but not AuditTrail-specific anymore.",
      "Later cleanup can split concerns further without blocking the first extraction cut."
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
  }),
  entry({
    path: "packages/db/src/job-outbox.ts",
    pathKind: "file",
    category: "platform-extension",
    extractionAction: "copy",
    reason: "The Postgres outbox repository is reusable platform-extension infrastructure for background jobs.",
    notes: [
      "Keep job semantics provider- and product-neutral at this layer."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "packages/db/src/schema/webhooks.ts",
    pathKind: "file",
    category: "platform-extension",
    extractionAction: "copy",
    reason: "Project webhook storage is reusable platform-extension infrastructure for outbound event delivery.",
    notes: [
      "Keep transport contracts generic even when the first product event is audit-event based."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "packages/db/src/migrations/0001_platform_foundation.sql",
    pathKind: "file",
    category: "platform-core",
    extractionAction: "copy",
    reason: "The platform foundation migration adds reusable auth, membership, invitation, and export-job storage.",
    notes: [
      "This migration is broad but reusable.",
      "Keep later refinements mechanical instead of leaving it in the unknown bucket."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "packages/db/src/migrations/0002_unique_memberships.sql",
    pathKind: "file",
    category: "platform-core",
    extractionAction: "copy",
    reason: "Membership uniqueness is a generic tenant-isolation constraint.",
    notes: [
      "This migration should move with the shared organization model."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "packages/db/src/migrations/0003_unique_pending_invitations.sql",
    pathKind: "file",
    category: "platform-core",
    extractionAction: "copy",
    reason: "Pending invitation uniqueness is reusable platform behavior.",
    notes: [
      "Keep the same duplicate-revocation safety behavior."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "packages/db/src/migrations/0004_organization_pricing.sql",
    pathKind: "file",
    category: "platform-core",
    extractionAction: "copy",
    reason: "Organization plan selection and monthly usage storage are now generic platform metering seams.",
    notes: [
      "Product labels and plan catalogs stay outside the migration.",
      "This migration still fits the reusable meter model."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "packages/db/src/migrations/0005_onboarding_states.sql",
    pathKind: "file",
    category: "platform-core",
    extractionAction: "copy",
    reason: "User-specific onboarding dismissal state is generic platform UX persistence.",
    notes: [
      "Keep milestone completion derived elsewhere."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "packages/db/src/migrations/0006_windy_mister_fear.sql",
    pathKind: "file",
    category: "platform-core",
    extractionAction: "copy",
    reason: "The generic meter-key migration is reusable platform metering infrastructure.",
    notes: [
      "This removed an old product-shaped column and should move with the shared usage seam."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "packages/db/src/migrations/0007_job_outbox.sql",
    pathKind: "file",
    category: "platform-extension",
    extractionAction: "copy",
    reason: "The outbox table migration is reusable platform-extension infrastructure.",
    notes: [
      "Keep it with the jobs and worker seams."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "packages/db/src/migrations/0008_billing_storage.sql",
    pathKind: "file",
    category: "platform-core",
    extractionAction: "copy",
    reason: "Billing storage is reusable platform persistence for provider-backed billing state.",
    notes: [
      "The migration is provider-neutral and does not contain AuditTrail-specific behavior."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "packages/db/src/migrations/0009_internal_support_role.sql",
    pathKind: "file",
    category: "platform-core",
    extractionAction: "copy",
    reason: "Internal support-role persistence is reusable platform support tooling.",
    notes: [
      "Keep the conservative `none` default."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "packages/db/src/migrations/0010_project_webhooks.sql",
    pathKind: "file",
    category: "platform-extension",
    extractionAction: "copy",
    reason: "Project webhook persistence is reusable platform-extension infrastructure for outbound delivery.",
    notes: [
      "Keep the migration aligned with the shared webhook schema and delivery-tracking seam."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "packages/db/src/migrations/0011_installed_products.sql",
    pathKind: "file",
    category: "platform-core",
    extractionAction: "copy",
    reason: "Installed-product state is a reusable platform migration for multi-product organization enablement.",
    notes: [
      "Keep the migration aligned with the generic installed-product runtime seam."
    ],
    requiredForMinimalScaffold: true
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
  }),
  entry({
    path: "packages/domain/src/webhooks/**",
    pathKind: "glob",
    category: "platform-extension",
    extractionAction: "copy",
    reason: "Webhook domain contracts are reusable platform-extension vocabulary for outbound delivery.",
    notes: [
      "Keep event and signature contracts generic enough for future scaffold consumers."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "packages/framework/**",
    pathKind: "glob",
    category: "platform-extension",
    extractionAction: "copy",
    reason: "The framework contract vocabulary is a reusable tooling seam for future CLI, generator, extraction, and agent workflows.",
    notes: [
      "Keep the package pure and product-neutral.",
      "Do not add generators, runtime adapters, or produced output in this layer."
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
  }),
  entry({
    path: "apps/web/src/__tests__/product-module.test.ts",
    pathKind: "file",
    category: "audit-product",
    extractionAction: "exclude",
    reason: "The AuditTrail-backed product module test proves product-owned shell copy and routing behavior.",
    notes: [
      "Replace it with placeholder product-module tests only when a generic scaffold product exists."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "packages/db/src/schema/audit-events.ts",
    pathKind: "file",
    category: "audit-product",
    extractionAction: "exclude",
    reason: "Audit event persistence is AuditTrail product-specific and must not move into the generic boilerplate.",
    notes: [
      "Keep this table out of the boilerplate.",
      "The DB schema barrel template should stop exporting it in the extracted package."
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
    path: "apps/web/app/product-module.ts",
    pathKind: "file",
    category: "branding",
    extractionAction: "template",
    reason: "The web product module should point at placeholder product config in the extracted boilerplate.",
    notes: [
      "Keep workspace-scoped href composition behavior plus product-owned metadata, onboarding, and settings copy in one seam.",
      "Generate a placeholder product module instead of copying AuditTrail-specific module wiring."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/api/src/product-module.ts",
    pathKind: "file",
    category: "branding",
    extractionAction: "template",
    reason: "The API product module should point at placeholder product runtime registrations in the extracted boilerplate.",
    notes: [
      "Keep the registry-driven runtime seam while replacing AuditTrail-owned route registrations and OpenAPI copy."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "packages/db/src/seed.ts",
    pathKind: "file",
    category: "branding",
    extractionAction: "template",
    reason: "Demo seed data should become placeholder boilerplate sample data rather than copy the current example names.",
    notes: [
      "Replace example organization, project, and API key names.",
      "Keep the generic seed helper shape only if the boilerplate still wants demo data."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "packages/db/src/index.ts",
    pathKind: "file",
    category: "branding",
    extractionAction: "template",
    reason: "The top-level DB barrel currently re-exports the mixed schema barrel and should become a boilerplate-specific export surface.",
    notes: [
      "Keep the client export.",
      "Replace the schema export shape so the boilerplate barrel does not automatically expose AuditTrail-owned tables."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "packages/db/src/schema/index.ts",
    pathKind: "file",
    category: "branding",
    extractionAction: "template",
    reason: "The schema barrel currently exports both reusable tables and the AuditTrail audit-events table.",
    notes: [
      "Generate a boilerplate barrel that exports only the reusable schema set.",
      "Do not silently carry the audit-events table into the generic package."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "packages/db/src/schema/__tests__/index.test.ts",
    pathKind: "file",
    category: "branding",
    extractionAction: "template",
    reason: "The schema export test currently asserts AuditTrail audit-event exports and should track the boilerplate barrel instead.",
    notes: [
      "Replace with assertions for the extracted generic schema exports."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "packages/db/src/migrations/0000_dry_mattie_franklin.sql",
    pathKind: "file",
    category: "branding",
    extractionAction: "template",
    reason: "The initial migration mixes reusable project tables with the AuditTrail audit-events table and needs a boilerplate-specific replacement.",
    notes: [
      "A future extraction script should generate or substitute a non-audit initial migration instead of copying this file unchanged."
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

const repoToolingExcludeEntries = [
  entry({
    path: "tools/check-extraction-manifest.ts",
    pathKind: "file",
    category: "repo-tooling",
    extractionAction: "exclude",
    reason: "Extraction-manifest validation is source-repo preparation tooling and should stay out of generic boilerplate output.",
    notes: [
      "Keep it with the source repo unless a later task deliberately ships self-auditing extraction tooling with the scaffold."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "tools/architecture-boundaries/__fixtures__/**",
    pathKind: "glob",
    category: "repo-tooling",
    extractionAction: "exclude",
    reason: "Boundary-scanner fixtures are source-repo-only test assets and should not be copied into extracted scaffold candidates.",
    notes: [
      "Keep fixture-only scanner inputs with the source repo unless the scaffold also adopts the same boundary test suite."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "tools/extraction/**",
    pathKind: "glob",
    category: "repo-tooling",
    extractionAction: "exclude",
    reason: "Extraction planning and output tooling are source-repo preparation tools, not scaffold runtime or app-source output.",
    notes: [
      "Keep extraction tooling with the source repo unless a later task explicitly promotes it into shipped framework tooling."
    ],
    requiredForMinimalScaffold: false
  })
] as const satisfies readonly ExtractionManifestEntry[];

const generatedProofExcludeEntries = [
  entry({
    path: "apps/api/src/modules/generated/**",
    pathKind: "glob",
    category: "platform-extension",
    extractionAction: "exclude",
    reason: "Committed generated-resource proof modules validate the framework but should not ship as default scaffold runtime code.",
    notes: [
      "Regenerate these slices explicitly in downstream repos instead of copying the proof resource."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "packages/domain/src/generated/**",
    pathKind: "glob",
    category: "platform-extension",
    extractionAction: "exclude",
    reason: "Generated domain proof slices are framework output samples, not default boilerplate source.",
    notes: [
      "Keep the generated-resource seam available through tooling rather than through a preinstalled example resource."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "apps/web/app/customers/**",
    pathKind: "glob",
    category: "platform-extension",
    extractionAction: "exclude",
    reason: "The committed customer pages exist as generated-resource proof output and should not become default scaffold routes.",
    notes: [
      "Downstream products should add generated resources deliberately through the CLI."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "apps/web/src/features/customer/**",
    pathKind: "glob",
    category: "platform-extension",
    extractionAction: "exclude",
    reason: "The generated customer feature is proof output for the framework, not reusable scaffold baseline UI.",
    notes: [
      "Keep generated-resource proof slices out of the extracted default product shell."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "packages/db/src/schema/customer.ts",
    pathKind: "file",
    category: "platform-extension",
    extractionAction: "exclude",
    reason: "The customer table is part of the committed generated-resource proof slice and should not ship as baseline scaffold schema.",
    notes: [
      "Future generated resources should be created explicitly by the downstream repo owner."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "packages/db/src/migrations/0012_customer.sql",
    pathKind: "file",
    category: "platform-extension",
    extractionAction: "exclude",
    reason: "The customer migration belongs to the committed generated-resource proof slice, not the default scaffold schema set.",
    notes: [
      "Do not copy proof-resource schema into extracted boilerplate by default."
    ],
    requiredForMinimalScaffold: false
  })
] as const satisfies readonly ExtractionManifestEntry[];

const manualReviewEntries = [
  entry({
    path: "apps/api/src/__tests__/**",
    pathKind: "glob",
    category: "mixed",
    extractionAction: "manual-review",
    reason: "Root API tests mix platform runtime coverage with app composition assumptions.",
    notes: [
      "Split generic runtime tests from product-composition tests during extraction."
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
    path: "apps/api/src/server.ts",
    pathKind: "file",
    category: "mixed",
    extractionAction: "manual-review",
    reason: "The runtime entrypoint is generic structurally but depends on mixed app composition.",
    notes: [
      "Keep bootstrap flow and env loading.",
      "Review route registration dependencies before extraction."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/api/src/server-local-auth.ts",
    pathKind: "file",
    category: "mixed",
    extractionAction: "manual-review",
    reason: "The dev-only auth entrypoint mixes generic startup with local AuditTrail development assumptions.",
    notes: [
      "Decide whether the extracted boilerplate should keep a local-auth harness."
    ],
    requiredForMinimalScaffold: false
  }),
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
    path: "packages/db/src/README.md",
    pathKind: "file",
    category: "documentation",
    extractionAction: "manual-review",
    reason: "DB package docs may mix reusable storage guidance with current product assumptions.",
    notes: [
      "Rewrite or trim docs to match the extracted schema surface."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "packages/db/src/migrations/meta/**",
    pathKind: "glob",
    category: "mixed",
    extractionAction: "manual-review",
    reason: "Drizzle migration snapshots and journals still need regeneration or explicit curation during extraction.",
    notes: [
      "Keep these files fail-closed until a later task decides whether the boilerplate regenerates them or ships curated metadata."
    ],
    requiredForMinimalScaffold: false
  }),
  entry({
    path: "apps/web/app/api-keys/page.tsx",
    pathKind: "file",
    category: "mixed",
    extractionAction: "manual-review",
    reason: "The API keys page composes generic features through an AuditTrail-specific shell adapter.",
    notes: [
      "Keep the page shell.",
      "Swap in placeholder product navigation wiring."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/web/app/error.tsx",
    pathKind: "file",
    category: "mixed",
    extractionAction: "manual-review",
    reason: "The top-level error route is generic structurally but depends on product-owned chrome copy.",
    notes: [
      "Keep the route shell.",
      "Point it at placeholder product chrome."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/web/app/favicon.ico",
    pathKind: "file",
    category: "branding",
    extractionAction: "manual-review",
    reason: "App icon assets require a branding decision before extraction.",
    notes: [
      "Replace with placeholder branding or omit from the first boilerplate cut."
    ],
    requiredForMinimalScaffold: false
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
    path: "apps/web/app/loading.tsx",
    pathKind: "file",
    category: "mixed",
    extractionAction: "manual-review",
    reason: "The loading route is generic structurally but depends on product-owned chrome copy.",
    notes: [
      "Keep the route shell.",
      "Point it at placeholder product chrome."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/web/app/globals.css",
    pathKind: "file",
    category: "mixed",
    extractionAction: "manual-review",
    reason: "Global app styles may need brand and scaffold cleanup before extraction.",
    notes: [
      "Keep only generic tokens, reset, and base styles in the first boilerplate cut."
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
    path: "apps/web/app/members/page.tsx",
    pathKind: "file",
    category: "mixed",
    extractionAction: "manual-review",
    reason: "The members page composes generic features through an AuditTrail-specific shell adapter.",
    notes: [
      "Keep the page shell.",
      "Swap in placeholder product navigation wiring."
    ],
    requiredForMinimalScaffold: true
  }),
  entry({
    path: "apps/web/app/page.module.css",
    pathKind: "file",
    category: "mixed",
    extractionAction: "manual-review",
    reason: "The dashboard page styles should be reviewed alongside any replacement product landing screen.",
    notes: [
      "Remove or rewrite styles when the boilerplate landing or dashboard is templated."
    ],
    requiredForMinimalScaffold: false
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
  ...productSpecificEntries,
  ...repoToolingExcludeEntries,
  ...generatedProofExcludeEntries
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
