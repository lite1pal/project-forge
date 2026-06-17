import { describe, expect, it } from "vitest";

import { createOpaqueToken, hashToken, verifyTokenHash } from "../tokens.js";

describe("auth tokens", () => {
  it("creates non-empty opaque tokens", () => {
    expect(createOpaqueToken()).toHaveLength(43);
  });

  it("hashes and verifies tokens with a secret", () => {
    const hash = hashToken("token", { secret: "secret" });

    expect(verifyTokenHash("token", hash, { secret: "secret" })).toBe(true);
    expect(verifyTokenHash("other", hash, { secret: "secret" })).toBe(false);
  });
});
