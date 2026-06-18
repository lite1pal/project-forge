import { describe, expect, it } from "vitest";

import { toExportJobViewModel } from "@/src/features/exports/domain/presenters";

describe("toExportJobViewModel", () => {
  it("marks completed jobs with object keys as downloadable", () => {
    expect(
      toExportJobViewModel({
        id: "export-1",
        objectKey: "exports/export-1.csv",
        organizationId: "org-1",
        projectId: "project-1",
        requestedByUserId: "user-1",
        status: "completed"
      })
    ).toMatchObject({
      canDownload: true,
      statusLabel: "Completed"
    });
  });
});
