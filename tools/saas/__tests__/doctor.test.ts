import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createDoctorReport,
  formatDoctorReport
} from "../doctor.js";
import { executeSaasCli } from "../cli.js";

describe("saas doctor", () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    for (const root of createdRoots) {
      rmSync(root, {
        force: true,
        recursive: true
      });
    }
  });

  it("reports all-pass health for a valid framework candidate repo", () => {
    const repoRoot = createRepo(createdRoots, createValidRepoFiles());

    const report = createDoctorReport({
      repoRoot
    });

    expect(report.exitCode).toBe(0);
    expect(report.summary).toEqual({
      fail: 0,
      pass: report.results.length,
      warn: 0
    });
  });

  it("fails when a required root script is missing", () => {
    const files = createValidRepoFiles();

    files["package.json"] = JSON.stringify(
      withRemovedScript(JSON.parse(files["package.json"]), "check:boundaries"),
      null,
      2
    );

    const repoRoot = createRepo(createdRoots, files);
    const report = createDoctorReport({
      repoRoot
    });

    expect(report.exitCode).toBe(1);
    expect(findResult(report, "boundary-scanner-command")?.status).toBe("fail");
  });

  it("fails when the extraction manifest is missing", () => {
    const files: Partial<Record<string, string>> = createValidRepoFiles();

    delete files["tools/extraction/manifest.ts"];

    const repoRoot = createRepo(createdRoots, files as Record<string, string>);
    const report = createDoctorReport({
      repoRoot
    });

    expect(report.exitCode).toBe(1);
    expect(findResult(report, "extraction-manifest-file")?.status).toBe("fail");
  });

  it("fails when the placeholder validation command is missing", () => {
    const files = createValidRepoFiles();

    files["package.json"] = JSON.stringify(
      withRemovedScript(
        JSON.parse(files["package.json"]),
        "check:extraction:placeholder"
      ),
      null,
      2
    );

    const repoRoot = createRepo(createdRoots, files);
    const report = createDoctorReport({
      repoRoot
    });

    expect(report.exitCode).toBe(1);
    expect(findResult(report, "placeholder-validation-command")?.status).toBe(
      "fail"
    );
  });

  it("fails when generated output is not git-ignored", () => {
    const files = createValidRepoFiles();

    files[".gitignore"] = "node_modules\n";

    const repoRoot = createRepo(createdRoots, files);
    const report = createDoctorReport({
      repoRoot
    });

    expect(report.exitCode).toBe(1);
    expect(findResult(report, "generated-output-ignored")?.status).toBe("fail");
  });

  it("formats output in deterministic check order", () => {
    const repoRoot = createRepo(createdRoots, createValidRepoFiles());
    const report = createDoctorReport({
      repoRoot
    });
    const output = formatDoctorReport(report);

    expect(output.indexOf("Architecture boundary rules file")).toBeLessThan(
      output.indexOf("Boundary scanner command")
    );
    expect(output.indexOf("Boundary scanner command")).toBeLessThan(
      output.indexOf("Extraction manifest file")
    );
  });

  it("keeps warning-only issues at exit code zero", () => {
    const files = createValidRepoFiles();

    files["package.json"] = JSON.stringify(
      withRemovedScript(JSON.parse(files["package.json"]), "saas:doctor"),
      null,
      2
    );

    const repoRoot = createRepo(createdRoots, files);
    const result = executeSaasCli({
      args: ["doctor"],
      repoRoot
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("[WARN] Convenience `saas:doctor` script");
  });

  it("returns a nonzero exit code when required checks fail", () => {
    const files: Partial<Record<string, string>> = createValidRepoFiles();

    delete files["packages/framework/src/index.ts"];

    const repoRoot = createRepo(createdRoots, files as Record<string, string>);
    const result = executeSaasCli({
      args: ["doctor"],
      repoRoot
    });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("[FAIL] Framework contract package");
  });
});

function createRepo(createdRoots: string[], files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "auditrail-saas-doctor-"));

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

function createValidRepoFiles() {
  return {
    ".gitignore": [".generated/", "node_modules"].join("\n"),
    "package.json": JSON.stringify(
      {
        name: "auditrail",
        private: true,
        scripts: {
          "check:boundaries": "tsx tools/check-architecture-boundaries.ts",
          "check:extraction":
            "pnpm check:extraction-manifest && tsx tools/extraction/dry-run.ts",
          "check:extraction:placeholder":
            "tsx tools/extraction/validate-placeholder-product.ts",
          "check:extraction-manifest": "tsx tools/check-extraction-manifest.ts",
          "extract:boilerplate": "tsx tools/extraction/extract.ts",
          "saas": "tsx tools/saas/cli.ts",
          "saas:doctor": "tsx tools/saas/cli.ts doctor",
          "test": "pnpm -r test",
          "typecheck": "pnpm -r typecheck",
          "verify": "pnpm check:boundaries && pnpm typecheck && pnpm test"
        }
      },
      null,
      2
    ),
    "packages/domain/package.json": JSON.stringify(
      {
        name: "@auditrail/domain",
        exports: {
          "./product": {
            import: "./src/product/index.ts",
            types: "./src/product/index.ts"
          }
        }
      },
      null,
      2
    ),
    "packages/domain/src/index.ts": 'export * from "./product/index.js";\n',
    "packages/domain/src/product/index.ts":
      'export * from "./product-definition.js";\n',
    "packages/domain/src/product/product-definition.ts":
      "export const productDefinition = {};\n",
    "packages/domain/src/audit-events/product.ts":
      "export const auditTrailProduct = {};\n",
    "packages/framework/package.json": JSON.stringify(
      {
        name: "@auditrail/framework",
        exports: {
          ".": {
            import: "./src/index.ts",
            types: "./src/index.ts"
          }
        }
      },
      null,
      2
    ),
    "packages/framework/src/index.ts": "export interface FrameworkCheckDefinition {}\n",
    "tools/architecture-boundaries/rules.ts":
      'export { architectureBoundaryRules } from "../../packages/architecture-boundaries/src/rules.js";\n',
    "tools/check-architecture-boundaries.ts": "console.log('ok');\n",
    "tools/check-extraction-manifest.ts": "console.log('ok');\n",
    "tools/saas/cli.ts": "console.log('ok');\n",
    "tools/saas/generated-resource-smoke.ts": "console.log('ok');\n",
    "tools/saas/resource-apply.ts": "console.log('ok');\n",
    "tools/extraction/dry-run.ts": "console.log('ok');\n",
    "tools/extraction/extract.ts": "console.log('ok');\n",
    "tools/extraction/validate-placeholder-product.ts": "console.log('ok');\n",
    "tools/extraction/manifest.ts": [
      'const productSpecificEntries = [',
      '  {',
      '    path: "packages/domain/src/audit-events/**",',
      '    category: "audit-product"',
      "  }",
      "];",
      'const replaceWithTemplateEntries = [',
      '  {',
      '    path: "packages/domain/src/audit-events/product.ts",',
      '    category: "audit-product"',
      "  }",
      "];",
      'const platformExtensionEntries = [',
      '  {',
      '    path: "tools/saas/**",',
      '    category: "platform-extension"',
      "  }",
      "];"
    ].join("\n")
  };
}

function findResult(
  report: ReturnType<typeof createDoctorReport>,
  id: string
) {
  return report.results.find((result) => result.id === id);
}

function withRemovedScript(
  packageJson: {
    scripts?: Record<string, string>;
  },
  scriptName: string
) {
  if (!packageJson.scripts) {
    return packageJson;
  }

  const scripts = {
    ...packageJson.scripts
  };

  delete scripts[scriptName];

  return {
    ...packageJson,
    scripts
  };
}
