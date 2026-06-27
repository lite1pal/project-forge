import {
  formatPlaceholderValidationSummary,
  validatePlaceholderCandidate
} from "./placeholder-product.js";

try {
  const result = validatePlaceholderCandidate({
    repoRoot: process.cwd()
  });

  console.log(formatPlaceholderValidationSummary(result));
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "Placeholder product validation failed."
  );
  process.exit(1);
}
