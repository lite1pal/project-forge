import {
  createResourceAgentContextFromFile,
  formatResourceAgentContextMarkdown
} from "./agent-context.js";
import { createDoctorReport, formatDoctorReport } from "./doctor.js";
import {
  formatGeneratedResourceSummary,
  generateResourceFromFile
} from "./resource-generator.js";
import {
  createResourcePlanFromFile,
  formatResourcePlanReport
} from "./resource-planner.js";

export interface SaasCliExecutionResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

export function executeSaasCli(input: {
  args: readonly string[];
  repoRoot: string;
}): SaasCliExecutionResult {
  const [command] = input.args;

  if (command === "doctor") {
    const report = createDoctorReport({
      repoRoot: input.repoRoot
    });

    return {
      exitCode: report.exitCode,
      stderr: "",
      stdout: formatDoctorReport(report)
    };
  }

  if (command === "plan" && input.args[1] === "resource") {
    return executePlanResourceCommand({
      args: input.args.slice(2),
      repoRoot: input.repoRoot
    });
  }

  if (command === "add" && input.args[1] === "resource") {
    return executeAddResourceCommand({
      args: input.args.slice(2),
      repoRoot: input.repoRoot
    });
  }

  if (
    command === "agent" &&
    input.args[1] === "context" &&
    input.args[2] === "resource"
  ) {
    return executeAgentContextResourceCommand({
      args: input.args.slice(3),
      repoRoot: input.repoRoot
    });
  }

  return {
    exitCode: 1,
    stderr: [
      "Unknown or missing command.",
      "Usage:",
      "  pnpm saas doctor",
      "  pnpm saas plan resource <path-to-resource-spec.json> [--json]",
      "  pnpm saas add resource <path-to-resource-spec.json> [--output <preview-dir>] [--force]",
      "  pnpm saas agent context resource <path-to-resource-spec.json> [--json] [--output <context-file>]"
    ].join("\n"),
    stdout: ""
  };
}

if (isExecutedAsScript()) {
  const result = executeSaasCli({
    args: process.argv.slice(2),
    repoRoot: process.cwd()
  });

  if (result.stdout.length > 0) {
    console.log(result.stdout);
  }

  if (result.stderr.length > 0) {
    console.error(result.stderr);
  }

  process.exit(result.exitCode);
}

function isExecutedAsScript() {
  const entryPath = process.argv[1];

  if (!entryPath) {
    return false;
  }

  return entryPath.endsWith("tools/saas/cli.ts");
}

function executePlanResourceCommand(input: {
  args: readonly string[];
  repoRoot: string;
}): SaasCliExecutionResult {
  const options = new Set(input.args.filter((argument) => argument.startsWith("--")));
  const positionalArgs = input.args.filter((argument) => !argument.startsWith("--"));
  const [specPath] = positionalArgs;

  if (!specPath) {
    return {
      exitCode: 1,
      stderr: "Missing resource spec path. Usage: pnpm saas plan resource <path-to-resource-spec.json> [--json]",
      stdout: ""
    };
  }

  try {
    const report = createResourcePlanFromFile({
      repoRoot: input.repoRoot,
      specPath
    });

    return {
      exitCode: 0,
      stderr: "",
      stdout: options.has("--json")
        ? JSON.stringify(report, null, 2)
        : formatResourcePlanReport(report)
    };
  } catch (error) {
    return {
      exitCode: 1,
      stderr:
        error instanceof Error
          ? error.message
          : "Resource planning failed.",
      stdout: ""
    };
  }
}

function executeAddResourceCommand(input: {
  args: readonly string[];
  repoRoot: string;
}): SaasCliExecutionResult {
  try {
    const parsedArgs = parseCommandArguments(input.args, {
      booleanOptions: ["--force"]
    });
    const [specPath] = parsedArgs.positionalArgs;

    if (!specPath) {
      return {
        exitCode: 1,
        stderr:
          "Missing resource spec path. Usage: pnpm saas add resource <path-to-resource-spec.json> [--output <preview-dir>] [--force]",
        stdout: ""
      };
    }

    const result = generateResourceFromFile({
      force: parsedArgs.options.has("--force"),
      outputPath: parsedArgs.optionsWithValues.get("--output"),
      repoRoot: input.repoRoot,
      specPath
    });

    return {
      exitCode: 0,
      stderr: "",
      stdout: formatGeneratedResourceSummary(result)
    };
  } catch (error) {
    return {
      exitCode: 1,
      stderr:
        error instanceof Error
          ? error.message
          : "Resource generation failed.",
      stdout: ""
    };
  }
}

function executeAgentContextResourceCommand(input: {
  args: readonly string[];
  repoRoot: string;
}): SaasCliExecutionResult {
  try {
    const parsedArgs = parseCommandArguments(input.args, {
      booleanOptions: ["--json"]
    });
    const [specPath] = parsedArgs.positionalArgs;

    if (!specPath) {
      return {
        exitCode: 1,
        stderr:
          "Missing resource spec path. Usage: pnpm saas agent context resource <path-to-resource-spec.json> [--json] [--output <context-file>]",
        stdout: ""
      };
    }

    const result = createResourceAgentContextFromFile({
      format: parsedArgs.options.has("--json") ? "json" : "markdown",
      outputPath: parsedArgs.optionsWithValues.get("--output"),
      repoRoot: input.repoRoot,
      specPath
    });

    return {
      exitCode: 0,
      stderr: "",
      stdout: parsedArgs.options.has("--json")
        ? JSON.stringify(result.bundle, null, 2)
        : formatResourceAgentContextMarkdown(result.bundle)
    };
  } catch (error) {
    return {
      exitCode: 1,
      stderr:
        error instanceof Error
          ? error.message
          : "Resource agent context generation failed.",
      stdout: ""
    };
  }
}

function parseCommandArguments(
  args: readonly string[],
  configuration: {
    booleanOptions?: readonly string[];
  } = {}
) {
  const options = new Set<string>();
  const optionsWithValues = new Map<string, string>();
  const positionalArgs: string[] = [];
  const booleanOptions = new Set(configuration.booleanOptions ?? []);

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (!argument.startsWith("--")) {
      positionalArgs.push(argument);
      continue;
    }

    if (booleanOptions.has(argument)) {
      options.add(argument);
      continue;
    }

    if (argument === "--output") {
      const value = args[index + 1];

      if (!value || value.startsWith("--")) {
        throw new Error("Missing value for --output.");
      }

      optionsWithValues.set(argument, value);
      index += 1;
      continue;
    }

    throw new Error(`Unknown option '${argument}'.`);
  }

  return {
    options,
    optionsWithValues,
    positionalArgs
  };
}
