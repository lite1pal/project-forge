import { describe, expect, it } from "vitest";

import { toCurrentUserViewModel } from "../domain/presenters";

describe("toCurrentUserViewModel", () => {
  it("uses email as the display name fallback", () => {
    expect(
      toCurrentUserViewModel({
        memberships: [],
        user: {
          email: "user@example.com",
          id: "user-1"
        }
      })
    ).toEqual({
      email: "user@example.com",
      hasMemberships: false,
      name: "user@example.com",
      userId: "user-1"
    });
  });
});
