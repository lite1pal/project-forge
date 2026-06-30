import type { RegisteredJobHandler } from "./handlers.js";
import type { WorkerLogger } from "./worker.js";

export function createDefaultJobHandlers(
  logger: Pick<WorkerLogger, "info"> = console
): RegisteredJobHandler[] {
  return [
    {
      name: "audit-event.created",
      async handle(input) {
        logger.info("audit_event_created_job_processed", {
          eventId: input.payload.eventId,
          organizationId: input.payload.organizationId,
          projectId: input.payload.projectId
        });
      }
    }
  ];
}
