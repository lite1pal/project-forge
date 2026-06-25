import { describe, expect, it } from "vitest";

import { summarizeUsageMeter } from "../index.js";

describe("summarizeUsageMeter", () => {
  it("summarizes a generic usage meter over the current UTC month", () => {
    expect(
      summarizeUsageMeter({
        meter: {
          id: "events",
          includedUnits: 100_000,
          name: "Events"
        },
        now: new Date("2026-06-25T13:45:12.000Z"),
        usedUnits: 42
      })
    ).toEqual({
      id: "events",
      includedUnits: 100_000,
      name: "Events",
      periodEnd: "2026-07-01T00:00:00.000Z",
      periodStart: "2026-06-01T00:00:00.000Z",
      remainingUnits: 99_958,
      usedUnits: 42
    });
  });
});
