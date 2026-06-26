import { describe, expect, it } from "vitest";

import {
  architectureBoundaryCategoryIds,
  architectureBoundaryRules
} from "../index.js";

describe("architecture boundary rules", () => {
  it("exports the expected category ids in stable order", () => {
    expect(architectureBoundaryCategoryIds).toEqual([
      "platform-core",
      "platform-extension",
      "audit-product",
      "mixed"
    ]);
  });

  it("keeps the platform-extension category available even before roots exist", () => {
    const platformExtension = architectureBoundaryRules.categories.find(
      (category) => category.id === "platform-extension"
    );

    expect(platformExtension).toMatchObject({
      id: "platform-extension",
      globPatterns: []
    });
  });
});
