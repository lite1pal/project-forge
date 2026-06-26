import { describe, expect, it } from "vitest";

import { getAuditTrailShellProductConfig } from "@/app/audit-product-navigation";

describe("getAuditTrailShellProductConfig", () => {
  it("returns the product name and workspace-aware nav hrefs", () => {
    expect(
      getAuditTrailShellProductConfig({
        activeOrganizationId: "org-1",
        activeProjectId: "project-1"
      })
    ).toEqual({
      navItems: [
        {
          href: "/?organizationId=org-1&projectId=project-1",
          id: "events",
          label: "Events"
        }
      ],
      productName: "AuditTrail"
    });
  });

  it("falls back to root hrefs when no workspace is selected", () => {
    expect(getAuditTrailShellProductConfig({})).toEqual({
      navItems: [
        {
          href: "/",
          id: "events",
          label: "Events"
        }
      ],
      productName: "AuditTrail"
    });
  });
});
