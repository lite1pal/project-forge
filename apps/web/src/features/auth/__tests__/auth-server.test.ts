import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/src/lib/api/api-errors";
import { loadCurrentUser } from "@/src/features/auth/server/auth-server";

const getCurrentUserMock = vi.fn();

vi.mock("@/src/lib/api/server-api-client", () => ({
  createServerApiClient: vi.fn(() => ({}))
}));

vi.mock("@/src/features/auth/api/auth-client", () => ({
  createAuthClient: vi.fn(() => ({})),
  getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args)
}));

describe("loadCurrentUser", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
  });

  it("returns undefined only for missing session errors", async () => {
    getCurrentUserMock.mockRejectedValue(
      new ApiError("missing_session", 401, "missing_session")
    );

    await expect(loadCurrentUser()).resolves.toBeUndefined();
  });

  it("rethrows non-auth API failures", async () => {
    getCurrentUserMock.mockRejectedValue(
      new ApiError("forbidden", 403, "forbidden")
    );

    await expect(loadCurrentUser()).rejects.toThrow("forbidden");
  });
});
