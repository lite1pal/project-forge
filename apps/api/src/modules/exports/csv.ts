import type { AuditEventRecord } from "../audit-events/repo.js";

export function toAuditEventsCsv(events: AuditEventRecord[]) {
  return [
    ["id", "event", "actor", "target", "createdAt", "metadata"].join(","),
    ...events.map((event) =>
      [
        event.id,
        event.eventType,
        event.actorId ?? "",
        event.targetId ?? "",
        event.createdAt,
        JSON.stringify(event.metadata)
      ]
        .map(escapeCsvValue)
        .join(",")
    )
  ].join("\n");
}

function escapeCsvValue(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}
