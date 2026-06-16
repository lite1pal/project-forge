import cors from "@fastify/cors";
import Fastify from "fastify";

import { registerEventRoutes } from "./modules/audit-events/routes.js";
import { authPlugin } from "./plugins/auth.js";
import { databasePlugin } from "./plugins/database.js";
import { rateLimitPlugin } from "./plugins/rate-limit.js";

export interface BuildAppOptions {
  useInfrastructure?: boolean;
  useRateLimit?: boolean;
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: true
  });

  app.register(cors, {
    origin: true
  });
  if (options.useRateLimit ?? true) {
    app.register(rateLimitPlugin);
  }

  app.get("/health", async () => {
    return {
      status: "ok"
    };
  });

  if (options.useInfrastructure) {
    app.register(databasePlugin);
    app.register(authPlugin);
  }

  app.register(registerEventRoutes, {
    prefix: "/v1"
  });

  return app;
}
