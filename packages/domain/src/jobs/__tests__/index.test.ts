import { describe, expect, it } from "vitest";

import {
  getJobOwnerProductId,
  jobEnvelopeSchema,
  jobNameSchema,
  jobPayloadSchema,
  jobStatusSchema
} from "../index.js";

describe("jobs domain", () => {
  it("parses a valid generic job envelope", () => {
    expect(
      jobEnvelopeSchema.parse({
        id: "job_123",
        name: "audit-event.created",
        payload: {
          attempts: 0,
          metadata: {
            source: "ingest-api",
            traceId: "trace_123"
          },
          notify: true,
          tags: ["audit", "ingest"]
        },
        status: "pending"
      })
    ).toEqual({
      id: "job_123",
      name: "audit-event.created",
      payload: {
        attempts: 0,
        metadata: {
          source: "ingest-api",
          traceId: "trace_123"
        },
        notify: true,
        tags: ["audit", "ingest"]
      },
      status: "pending"
    });
  });

  it("rejects an unknown job name", () => {
    expect(() => jobNameSchema.parse("audit-event.deleted")).toThrow();
  });

  it("rejects an unknown job status", () => {
    expect(() => jobStatusSchema.parse("queued")).toThrow();
  });

  it("accepts nested JSON-like payload values", () => {
    expect(
      jobPayloadSchema.parse({
        attributes: {
          retries: 1,
          sentAt: null
        },
        recipients: ["owner@example.com", "admin@example.com"]
      })
    ).toEqual({
      attributes: {
        retries: 1,
        sentAt: null
      },
      recipients: ["owner@example.com", "admin@example.com"]
    });
  });

  it("rejects non-JSON payload values", () => {
    expect(() =>
      jobPayloadSchema.parse({
        invalid: new Date("2026-06-26T10:00:00.000Z")
      })
    ).toThrow();
  });

  it("exposes product ownership for product-owned jobs", () => {
    expect(getJobOwnerProductId("audit-event.created")).toBe("audit-events");
    expect(getJobOwnerProductId("project.webhook.deliver")).toBe("audit-events");
    expect(getJobOwnerProductId("billing.webhook.received")).toBeUndefined();
  });
});
