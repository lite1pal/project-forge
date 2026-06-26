import { randomUUID } from "node:crypto";
import fp from "fastify-plugin";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export const REQUEST_ID_HEADER = "x-request-id";

declare module "fastify" {
  interface FastifyRequest {
    requestCompletedErrorCode?: string;
    requestStartedAtNs: bigint;
  }
}

export const requestRuntimePlugin = fp(async (app) => {
  app.decorateRequest("requestCompletedErrorCode");
  app.decorateRequest("requestStartedAtNs", 0n);

  app.addHook("onRequest", async (request, reply) => {
    request.requestStartedAtNs = process.hrtime.bigint();
    reply.header(REQUEST_ID_HEADER, request.id);
  });

  app.addHook("onSend", async (request, reply, payload) => {
    if (reply.statusCode >= 400 && !request.requestCompletedErrorCode) {
      request.requestCompletedErrorCode = extractErrorCode(payload);
    }

    return payload;
  });

  app.addHook("onResponse", async (request, reply) => {
    const durationMs =
      Number(process.hrtime.bigint() - request.requestStartedAtNs) / 1_000_000;
    const logPayload = {
      requestId: request.id,
      method: request.method,
      route: request.routeOptions.url,
      statusCode: reply.statusCode,
      durationMs: Number(durationMs.toFixed(3)),
      ...(request.requestCompletedErrorCode
        ? {
            errorCode: request.requestCompletedErrorCode
          }
        : {})
    };

    if (reply.statusCode >= 500) {
      request.log.error(logPayload, "request_completed");
      return;
    }

    if (reply.statusCode >= 400) {
      request.log.warn(logPayload, "request_completed");
      return;
    }

    request.log.info(logPayload, "request_completed");
  });
});

export function resolveRequestId(headerValue: string | string[] | undefined) {
  if (typeof headerValue === "string" && isValidRequestId(headerValue)) {
    return headerValue;
  }

  return randomUUID();
}

export function isValidRequestId(value: string) {
  return REQUEST_ID_PATTERN.test(value);
}

export function extractErrorCode(payload: unknown) {
  if (typeof payload === "string") {
    try {
      return extractErrorCode(JSON.parse(payload));
    } catch {
      return undefined;
    }
  }

  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  if ("error" in payload && typeof payload.error === "string") {
    return payload.error;
  }

  if ("code" in payload && typeof payload.code === "string") {
    return payload.code;
  }

  return undefined;
}
