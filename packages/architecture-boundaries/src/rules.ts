export type ArchitectureBoundaryCategoryId =
  | "platform-core"
  | "platform-extension"
  | "audit-product"
  | "mixed";

export interface ArchitectureBoundaryCategory {
  id: ArchitectureBoundaryCategoryId;
  label: string;
  description: string;
  globPatterns: readonly string[];
  allowedDependencyTargets: readonly ArchitectureBoundaryCategoryId[];
}

export interface ArchitectureBoundaryRuleSet {
  version: 1;
  categories: readonly ArchitectureBoundaryCategory[];
}

export const architectureBoundaryCategories = [
  {
    id: "platform-core",
    label: "Platform Core",
    description:
      "Reusable multi-tenant SaaS foundations that must not import audit-product code.",
    globPatterns: [
      "apps/api/src/modules/auth/**",
      "apps/api/src/modules/platform/**",
      "apps/api/src/modules/api-keys/**",
      "apps/web/src/features/auth/**",
      "apps/web/src/features/organizations/**",
      "apps/web/src/features/invitations/**",
      "apps/web/src/features/api-keys/**",
      "apps/web/src/features/onboarding/**",
      "apps/web/src/components/ui/**",
      "apps/web/src/lib/**",
      "packages/config/**",
      "packages/testkit/**"
    ],
    allowedDependencyTargets: [
      "platform-core",
      "platform-extension",
      "mixed"
    ]
  },
  {
    id: "platform-extension",
    label: "Platform Extension",
    description:
      "Future reusable platform capabilities such as billing, jobs, notifications, exports, MFA, SSO, or support tooling.",
    globPatterns: ["apps/api/src/modules/jobs/**", "apps/worker/**"],
    allowedDependencyTargets: [
      "platform-core",
      "platform-extension",
      "mixed"
    ]
  },
  {
    id: "audit-product",
    label: "Audit Product",
    description:
      "AuditTrail-specific event ingestion, event reads, and product-owned audit domain code.",
    globPatterns: [
      "apps/api/src/modules/audit-events/**",
      "apps/web/src/features/audit-events/**",
      "packages/domain/src/audit-events/**"
    ],
    allowedDependencyTargets: [
      "platform-core",
      "platform-extension",
      "audit-product",
      "mixed"
    ]
  },
  {
    id: "mixed",
    label: "Mixed",
    description:
      "Broad source roots that still contain both platform and audit code and need finer-grained classification before strict enforcement.",
    globPatterns: [
      "packages/domain/**",
      "packages/db/**",
      "apps/api/**",
      "apps/web/**"
    ],
    allowedDependencyTargets: [
      "platform-core",
      "platform-extension",
      "audit-product",
      "mixed"
    ]
  }
] as const satisfies readonly ArchitectureBoundaryCategory[];

export const architectureBoundaryCategoryIds =
  architectureBoundaryCategories.map((category) => category.id);

export const architectureBoundaryRules = {
  version: 1,
  categories: architectureBoundaryCategories
} as const satisfies ArchitectureBoundaryRuleSet;
