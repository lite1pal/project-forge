import { describe, expect, it } from "vitest";

import { toInvitationStatus } from "@/src/features/invitations/domain/presenters";
import type { Invitation } from "@/src/features/invitations/domain/schemas";

describe("toInvitationStatus", () => {
  it("returns accepted for accepted invitations", () => {
    expect(
      toInvitationStatus({
        ...baseInvitation(),
        acceptedAt: "2026-01-01T00:00:00.000Z"
      })
    ).toBe("accepted");
  });

  it("returns revoked before other terminal states", () => {
    expect(
      toInvitationStatus({
        ...baseInvitation(),
        acceptedAt: "2026-01-01T00:00:00.000Z",
        revokedAt: "2026-01-02T00:00:00.000Z"
      })
    ).toBe("revoked");
  });
});

function baseInvitation(): Invitation {
  return {
    email: "user@example.com",
    expiresAt: "2099-01-01T00:00:00.000Z",
    id: "invitation-1",
    organizationId: "org-1",
    role: "member"
  };
}
