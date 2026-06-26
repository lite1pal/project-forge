import { describe, expect, it, vi } from "vitest";

import { createJobHandlerRegistry } from "../handlers.js";

describe("createJobHandlerRegistry", () => {
  it("registers and lists handlers by job name", () => {
    const registry = createJobHandlerRegistry();
    const handler = vi.fn();

    registry.register({
      handle: handler,
      name: "email.delivery.requested"
    });

    expect(registry.has("email.delivery.requested")).toBe(true);
    expect(registry.get("email.delivery.requested")).toBe(handler);
    expect(registry.listNames()).toEqual(["email.delivery.requested"]);
  });

  it("rejects duplicate handler registration", () => {
    const registry = createJobHandlerRegistry([
      {
        handle: vi.fn(),
        name: "billing.webhook.received"
      }
    ]);

    expect(() =>
      registry.register({
        handle: vi.fn(),
        name: "billing.webhook.received"
      })
    ).toThrow("duplicate_job_handler:billing.webhook.received");
  });
});
