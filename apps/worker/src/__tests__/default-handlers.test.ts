import { describe, expect, it, vi } from "vitest";

import { createDefaultJobHandlers } from "../default-handlers.js";

describe("createDefaultJobHandlers", () => {
  it("registers an audit-event.created handler that logs a safe summary", async () => {
    const logger = {
      info: vi.fn()
    };
    const [handler] = createDefaultJobHandlers(logger);

    expect(handler?.name).toBe("audit-event.created");

    await handler?.handle({
      id: "job-1",
      name: "audit-event.created",
      payload: {
        createdAt: "2026-06-30T12:00:00.000Z",
        eventId: "evt_123",
        organizationId: "org_123",
        projectId: "proj_123"
      }
    });

    expect(logger.info).toHaveBeenCalledWith(
      "audit_event_created_job_processed",
      {
        eventId: "evt_123",
        organizationId: "org_123",
        projectId: "proj_123"
      }
    );
  });
});
