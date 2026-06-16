import { describe, expect, it } from "vitest";

import {
  createInMemoryAuditEventRepo,
  type AuditEventTenant
} from "../src/modules/audit-events/repo.js";

const tenant: AuditEventTenant = {
  organizationId: "org_1",
  projectId: "project_1"
};

describe("in-memory audit event repo", () => {
  it("summarizes top event types with stable tie ordering", async () => {
    const repo = createInMemoryAuditEventRepo({
      now: sequentialNow([
        "2026-06-16T12:00:00.000Z",
        "2026-06-16T12:01:00.000Z",
        "2026-06-16T12:02:00.000Z",
        "2026-06-16T12:03:00.000Z"
      ])
    });

    await repo.append(tenant, { event: "role.changed", metadata: {} });
    await repo.append(tenant, { event: "user.deleted", metadata: {} });
    await repo.append(tenant, { event: "user.deleted", metadata: {} });
    await repo.append(tenant, { event: "user.created", metadata: {} });

    await expect(
      repo.summarize(tenant, {
        top: 2
      })
    ).resolves.toEqual({
      totalEvents: 4,
      topEventTypes: [
        {
          event: "user.deleted",
          count: 2
        },
        {
          event: "role.changed",
          count: 1
        }
      ]
    });
  });

  it("builds hourly and daily timeseries buckets", async () => {
    const repo = createInMemoryAuditEventRepo({
      now: sequentialNow([
        "2026-06-16T12:05:00.000Z",
        "2026-06-16T12:35:00.000Z",
        "2026-06-17T00:10:00.000Z"
      ])
    });

    await repo.append(tenant, { event: "user.created", metadata: {} });
    await repo.append(tenant, { event: "user.deleted", metadata: {} });
    await repo.append(tenant, { event: "role.changed", metadata: {} });

    await expect(
      repo.timeseries(tenant, {
        from: "2026-06-16T00:00:00.000Z",
        to: "2026-06-18T00:00:00.000Z",
        bucket: "hour"
      })
    ).resolves.toEqual([
      {
        bucketStart: "2026-06-16T12:00:00.000Z",
        count: 2
      },
      {
        bucketStart: "2026-06-17T00:00:00.000Z",
        count: 1
      }
    ]);

    await expect(
      repo.timeseries(tenant, {
        from: "2026-06-16T00:00:00.000Z",
        to: "2026-06-18T00:00:00.000Z",
        bucket: "day"
      })
    ).resolves.toEqual([
      {
        bucketStart: "2026-06-16T00:00:00.000Z",
        count: 2
      },
      {
        bucketStart: "2026-06-17T00:00:00.000Z",
        count: 1
      }
    ]);
  });
});

function sequentialNow(values: string[]) {
  let index = 0;

  return () => values[index++] ?? values.at(-1) ?? "2026-06-16T00:00:00.000Z";
}
