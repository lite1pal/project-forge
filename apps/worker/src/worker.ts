import type { JobHandlerRegistry } from "./handlers.js";
import type { WorkerConfig } from "./config.js";

const keepAliveIntervalMs = 60_000;

export interface WorkerLogger {
  error(message: string, details?: Record<string, unknown>): void;
  info(message: string, details?: Record<string, unknown>): void;
  warn(message: string, details?: Record<string, unknown>): void;
}

export interface WorkerLifecycle {
  onStart?(): Promise<void> | void;
  onStop?(): Promise<void> | void;
}

export interface WorkerApp {
  isRunning(): boolean;
  start(): Promise<void>;
  stop(options?: {
    reason?: string;
  }): Promise<void>;
}

export interface WorkerSignalSource {
  off(event: WorkerSignal, listener: () => void): void;
  on(event: WorkerSignal, listener: () => void): void;
}

export type WorkerSignal = "SIGINT" | "SIGTERM";

interface KeepAliveHandle {
  clear(): void;
}

export function createWorker(options: {
  config: WorkerConfig;
  handlers: JobHandlerRegistry;
  lifecycle?: WorkerLifecycle;
  logger?: WorkerLogger;
  scheduleKeepAlive?: () => KeepAliveHandle;
}): WorkerApp {
  const logger = options.logger ?? console;
  const scheduleKeepAlive =
    options.scheduleKeepAlive ?? createKeepAliveHandle;
  let running = false;
  let keepAliveHandle: KeepAliveHandle | undefined;

  return {
    isRunning() {
      return running;
    },
    async start() {
      if (running) {
        return;
      }

      await options.lifecycle?.onStart?.();
      keepAliveHandle = scheduleKeepAlive();
      running = true;
      logger.info("worker_started", {
        handlerCount: options.handlers.listNames().length,
        shutdownTimeoutMs: options.config.WORKER_SHUTDOWN_TIMEOUT_MS,
        workerName: options.config.WORKER_NAME
      });
    },
    async stop(stopOptions = {}) {
      if (!running) {
        return;
      }

      running = false;
      keepAliveHandle?.clear();
      keepAliveHandle = undefined;
      await withTimeout(
        Promise.resolve(options.lifecycle?.onStop?.()),
        options.config.WORKER_SHUTDOWN_TIMEOUT_MS,
        "worker_shutdown_timeout"
      );
      logger.info("worker_stopped", {
        reason: stopOptions.reason ?? "stop",
        workerName: options.config.WORKER_NAME
      });
    }
  };
}

export function registerWorkerSignalHandlers(options: {
  logger?: WorkerLogger;
  setExitCode?: (code: number) => void;
  signalSource?: WorkerSignalSource;
  worker: WorkerApp;
}): () => void {
  const logger = options.logger ?? console;
  const signalSource = options.signalSource ?? process;
  const setExitCode =
    options.setExitCode ?? ((code: number) => void (process.exitCode = code));
  let shuttingDown = false;

  const cleanup = () => {
    signalSource.off("SIGINT", handleSigint);
    signalSource.off("SIGTERM", handleSigterm);
  };

  const handleSignal = (signal: WorkerSignal) => {
    void shutdown(signal);
  };
  const handleSigint = () => handleSignal("SIGINT");
  const handleSigterm = () => handleSignal("SIGTERM");

  signalSource.on("SIGINT", handleSigint);
  signalSource.on("SIGTERM", handleSigterm);

  return cleanup;

  async function shutdown(signal: WorkerSignal) {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.warn("worker_shutdown_signal", {
      signal
    });

    try {
      await options.worker.stop({
        reason: signal
      });
      setExitCode(0);
    } catch (error) {
      logger.error("worker_shutdown_failed", {
        error: error instanceof Error ? error.message : String(error),
        signal
      });
      setExitCode(1);
    } finally {
      cleanup();
    }
  }
}

function createKeepAliveHandle(): KeepAliveHandle {
  const interval = setInterval(() => undefined, keepAliveIntervalMs);

  return {
    clear() {
      clearInterval(interval);
    }
  };
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(errorMessage));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
