import { describe, expect, it } from "vitest";

import {
  getAuditTrailErrorHeading,
  getAuditTrailLoadingLabel,
  getAuditTrailMetadata
} from "@/app/audit-product-chrome";

describe("audit product chrome", () => {
  it("exposes metadata from the audit-owned product config", () => {
    expect(getAuditTrailMetadata()).toEqual({
      description: "AuditTrail event monitoring workspace",
      title: "AuditTrail"
    });
  });

  it("exposes loading and error copy from the audit-owned product config", () => {
    expect(getAuditTrailLoadingLabel()).toBe("Loading AuditTrail...");
    expect(getAuditTrailErrorHeading()).toBe("Unable to load AuditTrail");
  });
});
