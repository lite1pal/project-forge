import { describe, expect, it } from "vitest";

import {
  parseEventSearchParams,
  toDashboardRange,
  toEventListHref
} from "@/src/features/audit-events/domain/query";

describe("parseEventSearchParams", () => {
  it("applies API-aligned defaults", () => {
    expect(parseEventSearchParams({})).toEqual({
      limit: 25
    });
  });

  it("rejects inverted date ranges", () => {
    expect(() =>
      parseEventSearchParams({
        from: "2026-01-02T00:00:00.000Z",
        to: "2026-01-01T00:00:00.000Z"
      })
    ).toThrow();
  });
});

describe("toEventListHref", () => {
  it("builds cursor pagination links without dropping filters", () => {
    expect(
      toEventListHref({ event: "user.created", limit: 25 }, "cursor-1")
    ).toEqual({
      pathname: "/",
      query: {
        cursor: "cursor-1",
        event: "user.created",
        limit: 25
      }
    });
  });
});

describe("toDashboardRange", () => {
  it("uses explicit query dates when present", () => {
    expect(
      toDashboardRange({
        from: "2026-01-01T00:00:00.000Z",
        limit: 25,
        to: "2026-01-02T00:00:00.000Z"
      })
    ).toEqual({
      bucket: "day",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-02T00:00:00.000Z"
    });
  });
});
