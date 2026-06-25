import { describe, expect, it } from "vitest";

import { buildAuthActionUrl } from "@/src/features/auth/domain/action-urls";

describe("buildAuthActionUrl", () => {
  it("builds API form actions with encoded query params", () => {
    expect(
      buildAuthActionUrl("https://api.example.com", "/api/v1/auth/sessions/confirm", {
        email: "user@example.com",
        redirectTo: "/settings?organizationId=org-1",
        token: "magic-token"
      })
    ).toBe(
      "https://api.example.com/api/v1/auth/sessions/confirm?email=user%40example.com&redirectTo=%2Fsettings%3ForganizationId%3Dorg-1&token=magic-token"
    );
  });
});
