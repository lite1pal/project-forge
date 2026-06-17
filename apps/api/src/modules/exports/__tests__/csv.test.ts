import { describe, expect, it } from "vitest";

import { toAuditEventsCsv } from "../csv.js";

describe("toAuditEventsCsv", () => {
  it("escapes CSV values", () => {
    expect(
      toAuditEventsCsv([
        {
          actorId: "user,1",
          createdAt: "2026-01-01T00:00:00.000Z",
          eventType: "user.created",
          id: "event-1",
          metadata: { source: "test" }
        }
      ])
    ).toContain('"user,1"');
  });
});
