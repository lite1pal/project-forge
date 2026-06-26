import type { JobName, JobPayload } from "@auditrail/domain/jobs";

export interface JobHandlerInput {
  id: string;
  name: JobName;
  payload: JobPayload;
}

export type JobHandler = (input: JobHandlerInput) => Promise<void> | void;

export interface RegisteredJobHandler {
  name: JobName;
  handle: JobHandler;
}

export interface JobHandlerRegistry {
  get(name: JobName): JobHandler | undefined;
  has(name: JobName): boolean;
  listNames(): JobName[];
  register(handler: RegisteredJobHandler): void;
}

export function createJobHandlerRegistry(
  initialHandlers: RegisteredJobHandler[] = []
): JobHandlerRegistry {
  const handlers = new Map<JobName, JobHandler>();

  for (const handler of initialHandlers) {
    registerHandler(handlers, handler);
  }

  return {
    get(name) {
      return handlers.get(name);
    },
    has(name) {
      return handlers.has(name);
    },
    listNames() {
      return [...handlers.keys()].sort();
    },
    register(handler) {
      registerHandler(handlers, handler);
    }
  };
}

function registerHandler(
  handlers: Map<JobName, JobHandler>,
  handler: RegisteredJobHandler
) {
  if (handlers.has(handler.name)) {
    throw new Error(`duplicate_job_handler:${handler.name}`);
  }

  handlers.set(handler.name, handler.handle);
}
