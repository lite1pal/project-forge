import { API_VERSION_PREFIX } from "../api-version.js";
import rateLimit from "@fastify/rate-limit";
import fp from "fastify-plugin";
import { z } from "zod";

import { loadEnvFiles } from "../env-files.js";

export interface RateLimitPluginOptions {
  max?: number;
  timeWindow?: string;
}

const rateLimitEnvironmentSchema = z.object({
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW: z.string().default("1 minute")
});

export const rateLimitPlugin = fp<RateLimitPluginOptions>(async (app, options) => {
  const envConfig = rateLimitEnvironmentSchema.parse(loadEnvFiles());

  await app.register(rateLimit, {
    global: true,
    max: options.max ?? envConfig.RATE_LIMIT_MAX,
    timeWindow: options.timeWindow ?? envConfig.RATE_LIMIT_WINDOW,
    skipOnError: false,
    hook: "preHandler",
    allowList(request) {
      return (
        request.routeOptions.url === "/health" ||
        request.routeOptions.url === `${API_VERSION_PREFIX}/health`
      );
    }
  });
});
