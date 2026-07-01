import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/__tests__/**/*.test.ts"],
    exclude: [
      ...configDefaults.exclude,
      "dist/**",
      "src/**/__tests__/**/*.integration.test.ts"
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/app.ts",
        "src/server.ts",
        "src/validate-env.ts",
        "src/server-local-auth.ts",
        "src/plugins/**",
        "src/product-module.ts",
        "src/modules/generated/**",
        "src/modules/api-keys/repo.ts",
        "src/modules/jobs/**",
        "src/modules/audit-events/jobs.ts",
        "src/modules/audit-events/postgres-repo.ts",
        "src/modules/platform/access.ts",
        "src/modules/platform/billing/repo.ts",
        "src/modules/platform/context.ts",
        "src/modules/platform/support/repo.ts",
        "src/modules/platform/support/postgres-repo.ts",
        "src/modules/platform/support/routes.ts",
        "src/modules/platform/webhooks/**",
      ],
      thresholds: {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  },
});
