export class WorkerRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkerRetryableError";
  }
}

export class WorkerTerminalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkerTerminalError";
  }
}
