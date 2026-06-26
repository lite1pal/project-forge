import {
  extractionManifest,
  type ExtractionAction,
  type ExtractionManifestEntry
} from "./extraction/manifest.js";

const sectionEntries = [
  ["copyToBoilerplate", extractionManifest.copyToBoilerplate.entries],
  ["excludeFromBoilerplate", extractionManifest.excludeFromBoilerplate.entries],
  ["replaceWithTemplate", extractionManifest.replaceWithTemplate.entries],
  ["requiresManualReview", extractionManifest.requiresManualReview.entries],
  ["productSpecific", extractionManifest.productSpecific.entries],
  ["platformCore", extractionManifest.platformCore.entries],
  ["platformExtension", extractionManifest.platformExtension.entries]
] as const;

const allowedActionsBySection: Record<
  (typeof sectionEntries)[number][0],
  readonly ExtractionAction[]
> = {
  copyToBoilerplate: ["copy"],
  excludeFromBoilerplate: ["exclude"],
  replaceWithTemplate: ["template"],
  requiresManualReview: ["manual-review"],
  productSpecific: ["exclude"],
  platformCore: ["copy"],
  platformExtension: ["copy"]
};

const errors: string[] = [];

if (extractionManifest.version !== 1) {
  errors.push(`Expected manifest version 1 but received ${extractionManifest.version}.`);
}

if (extractionManifest.status !== "advisory") {
  errors.push("Manifest status must stay 'advisory'.");
}

if (extractionManifest.extractionSupport !== "planned-not-implemented") {
  errors.push("Manifest must not claim extraction support is implemented.");
}

if (!extractionManifest.futureScriptPolicy.failClosedOnUnknownPaths) {
  errors.push("Future script policy must require fail-closed behavior on unknown paths.");
}

for (const [sectionName, entries] of sectionEntries) {
  if (entries.length === 0) {
    errors.push(`Section '${sectionName}' must contain at least one entry.`);
  }

  const duplicatePaths = findDuplicatePaths(entries);

  if (duplicatePaths.length > 0) {
    errors.push(
      `Section '${sectionName}' contains duplicate paths: ${duplicatePaths.join(", ")}.`
    );
  }

  for (const item of entries) {
    validateEntry({
      sectionName,
      entry: item,
      errors
    });
  }
}

if (errors.length > 0) {
  console.error("Extraction manifest validation failed:");

  for (const error of errors) {
    console.error(`- ${error}`);
  }

  process.exit(1);
}

console.log("Extraction manifest validation passed.");

function validateEntry(input: {
  sectionName: keyof typeof allowedActionsBySection;
  entry: ExtractionManifestEntry;
  errors: string[];
}) {
  const { sectionName, entry, errors } = input;

  if (entry.path.trim().length === 0) {
    errors.push(`[${sectionName}] path must not be blank.`);
  }

  if (entry.reason.trim().length === 0) {
    errors.push(`[${sectionName}] '${entry.path}' must include a reason.`);
  }

  if (entry.notes.length === 0) {
    errors.push(`[${sectionName}] '${entry.path}' must include at least one note.`);
  }

  if (!allowedActionsBySection[sectionName].includes(entry.extractionAction)) {
    errors.push(
      `[${sectionName}] '${entry.path}' has invalid action '${entry.extractionAction}'.`
    );
  }
}

function findDuplicatePaths(entries: readonly ExtractionManifestEntry[]) {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    counts.set(entry.path, (counts.get(entry.path) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([path]) => path)
    .sort();
}

