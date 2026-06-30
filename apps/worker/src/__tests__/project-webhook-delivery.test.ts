import { describe, expect, it } from "vitest";

import { createWebhookSignature } from "../project-webhook-delivery.js";

describe("createWebhookSignature", () => {
  it("creates a stable HMAC signature from the timestamp and payload", () => {
    expect(
      createWebhookSignature({
        payload: "{\"id\":\"evt_123\"}",
        secret: "whsec_test_123",
        timestamp: "2026-06-30T10:00:00.000Z"
      })
    ).toBe("dbe743709f21e5b04bcd9374fa97b8f2762c331cc562f9735606e5c1aa6ce9c4");
  });
});
