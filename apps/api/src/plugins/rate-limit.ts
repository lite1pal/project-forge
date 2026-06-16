import rateLimit from "@fastify/rate-limit";
import fp from "fastify-plugin";

import { loadConfig } from "../config.js";
import { loadEnvFiles } from "../env-files.js";

export const rateLimitPlugin = fp(async (app) => {
  const config = loadConfig(loadEnvFiles());

  await app.register(rateLimit, {
    global: true,
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW,
    skipOnError: false,
    hook: "preHandler",
    allowList(request) {
      return request.routeOptions.url === "/health";
    }
  });
});
