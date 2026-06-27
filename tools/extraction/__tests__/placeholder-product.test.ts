import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  collectAuditTrailSpecificImports,
  createPlaceholderProductFiles,
  findMissingRequiredScaffoldFiles,
  validatePlaceholderProductConfig
} from "../placeholder-product.js";

describe("placeholder product validation", () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    for (const root of createdRoots) {
      rmSync(root, {
        force: true,
        recursive: true
      });
    }
  });

  it("accepts the placeholder product config through the generic product schema", () => {
    expect(validatePlaceholderProductConfig()).toMatchObject({
      id: "placeholder-product",
      navItems: [{ id: "overview" }],
      onboardingSteps: [{ id: "workspace_connected", required: true }]
    });
  });

  it("fails when a placeholder file imports AuditTrail-specific code", () => {
    expect(
      collectAuditTrailSpecificImports([
        {
          path: "packages/domain/src/placeholder-product/product.ts",
          contents: 'import { auditTrailProduct } from "@auditrail/domain/audit-events";\n'
        }
      ])
    ).toEqual([
      "packages/domain/src/placeholder-product/product.ts -> @auditrail/domain/audit-events"
    ]);
  });

  it("reports missing required scaffold files", () => {
    const outputRoot = createOutputRoot(createdRoots, {
      "packages/domain/src/product/index.ts": 'export * from "./product-definition.js";\n'
    });

    expect(
      findMissingRequiredScaffoldFiles({
        outputRoot,
        requiredFiles: [
          "packages/domain/src/product/index.ts",
          "apps/web/src/components/layout/app-shell.tsx"
        ]
      })
    ).toEqual(["apps/web/src/components/layout/app-shell.tsx"]);
  });

  it("keeps placeholder validation paths outside AuditTrail product code paths", () => {
    expect(createPlaceholderProductFiles().map((file) => file.path)).toEqual([
      "packages/domain/src/placeholder-product/index.ts",
      "packages/domain/src/placeholder-product/product.ts",
      "apps/web/app/placeholder-product-navigation.ts",
      "apps/web/app/getting-started/placeholder-product-onboarding.ts"
    ]);
  });
});

function createOutputRoot(
  createdRoots: string[],
  files: Record<string, string>
) {
  const root = mkdtempSync(join(tmpdir(), "auditrail-placeholder-validation-"));

  createdRoots.push(root);

  for (const [path, contents] of Object.entries(files)) {
    const absolutePath = join(root, path);
    const directory = join(absolutePath, "..");

    mkdirSync(directory, {
      recursive: true
    });
    writeFileSync(absolutePath, contents);
  }

  return root;
}
