import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import Fastify from "fastify";

import {
  API_BASE_PATH,
  API_VERSION,
  API_VERSION_PREFIX,
  getApiDescriptor
} from "./api-version.js";
import { loadConfig } from "./config.js";
import { loadEnvFiles } from "./env-files.js";
import { registerApiErrorHandler } from "./http-errors.js";
import { registerApiSchemas, schemaIds } from "./http-schemas.js";
import { createPostgresAuthRepo } from "./modules/auth/postgres-repo.js";
import {
  registerAuthRoutes,
  type AuthCookieOptions
} from "./modules/auth/routes.js";
import { createInMemoryMagicLinkSender } from "./modules/auth/senders.js";
import {
  createAuthService,
  type AuthService,
  type MagicLinkSender
} from "./modules/auth/service.js";
import { registerEventRoutes } from "./modules/audit-events/routes.js";
import { registerExportRoutes } from "./modules/exports/routes.js";
import type { ExportService } from "./modules/exports/service.js";
import type { ExportObjectStorage } from "./modules/exports/storage.js";
import { createCurrentUserContextService } from "./modules/platform/context.js";
import { createPostgresPlatformRepo } from "./modules/platform/postgres-repo.js";
import { registerPlatformRoutes } from "./modules/platform/routes.js";
import {
  createPlatformService,
  type PlatformService
} from "./modules/platform/service.js";
import { authPlugin } from "./plugins/auth.js";
import { databasePlugin } from "./plugins/database.js";
import { rateLimitPlugin } from "./plugins/rate-limit.js";
import { sessionAuthPlugin } from "./plugins/session-auth.js";

export interface RateLimitOptions {
  max?: number;
  timeWindow?: string;
}

export interface InfrastructureOptions {
  databaseUrl?: string;
}

export interface BuildAppOptions {
  auth?: {
    cookie?: AuthCookieOptions;
    service: AuthService;
  };
  platform?: {
    service: PlatformService;
  };
  exports?: {
    organizationId: string;
    service: ExportService;
    storage: ExportObjectStorage;
  };
  useInfrastructure?: boolean;
  useRateLimit?: boolean;
  rateLimit?: RateLimitOptions;
  infrastructure?: InfrastructureOptions;
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: true
  });

  registerApiErrorHandler(app);
  registerApiSchemas(app);

  app.register(swagger, {
    openapi: {
      info: {
        title: "AuditTrail API",
        version: API_VERSION,
        description:
          "Versioned audit event ingestion and query API. The canonical contract is /api/v1."
      },
      tags: [
        {
          name: "meta",
          description: "API metadata and health"
        },
        {
          name: "events",
          description: "Audit event ingestion and query"
        },
        {
          name: "auth",
          description: "Browser session authentication"
        }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer"
          }
        }
      }
    }
  });

  app.register(cors, {
    origin: true
  });
  if (options.useRateLimit ?? true) {
    if (options.rateLimit) {
      app.register(rateLimitPlugin, options.rateLimit);
    } else {
      app.register(rateLimitPlugin);
    }
  }

  app.get(
    "/health",
    {
      schema: {
        tags: ["meta"],
        summary: "Returns operational health for infrastructure checks",
        response: {
          200: {
            $ref: `${schemaIds.healthResponse}#`
          }
        }
      }
    },
    async () => {
      return {
        status: "ok"
      };
    }
  );
  app.get(
    API_BASE_PATH,
    {
      schema: {
        tags: ["meta"],
        summary: "Returns API version metadata",
        response: {
          200: {
            $ref: `${schemaIds.apiDescriptorResponse}#`
          }
        }
      }
    },
    async () => getApiDescriptor()
  );
  app.get(
    `${API_VERSION_PREFIX}/health`,
    {
      schema: {
        tags: ["meta"],
        summary: "Returns versioned API health",
        response: {
          200: {
            $ref: `${schemaIds.healthResponse}#`
          }
        }
      }
    },
    async () => {
      return {
        status: "ok"
      };
    }
  );
  app.get(
    `${API_VERSION_PREFIX}/openapi.json`,
    {
      schema: {
        tags: ["meta"],
        summary: "Returns the OpenAPI document for the current API version",
        response: {
          200: {
            $ref: `${schemaIds.openApiDocumentResponse}#`
          }
        }
      }
    },
    async () => app.swagger()
  );

  if (options.useInfrastructure) {
    if (options.infrastructure) {
      app.register(databasePlugin, options.infrastructure);
    } else {
      app.register(databasePlugin);
    }
    app.register(authPlugin);
    app.register(async (infrastructureApp) => {
      const config = loadConfig(loadEnvFiles());
      const authRepo = createPostgresAuthRepo(infrastructureApp.db);
      const platformRepo = createPostgresPlatformRepo(infrastructureApp.db);
      const magicLinkSender = createRuntimeMagicLinkSender(app, config);
      const authService = createAuthService(authRepo, magicLinkSender, {
        magicLinkTtlMs: config.AUTH_MAGIC_LINK_TTL_SECONDS * 1000,
        sessionTtlMs: config.AUTH_SESSION_TTL_SECONDS * 1000,
        tokenSecret: config.AUTH_TOKEN_SECRET
      });
      const platformService = createPlatformService(platformRepo);

      infrastructureApp.register(sessionAuthPlugin, {
        cookieName: config.AUTH_SESSION_COOKIE_NAME,
        service: authService
      });

      infrastructureApp.register(registerAuthRoutes, {
        cookie: {
          maxAgeSeconds: config.AUTH_SESSION_TTL_SECONDS,
          name: config.AUTH_SESSION_COOKIE_NAME,
          secure: config.AUTH_SESSION_COOKIE_SECURE
        },
        currentUserContext: createCurrentUserContextService(platformRepo),
        prefix: API_VERSION_PREFIX,
        service: authService
      });
      infrastructureApp.register(registerPlatformRoutes, {
        invitationTokenSecret: config.AUTH_TOKEN_SECRET,
        prefix: API_VERSION_PREFIX,
        service: platformService
      });
    });
  }

  app.register(registerEventRoutes, {
    prefix: API_VERSION_PREFIX
  });

  if (options.auth) {
    const authRouteOptions = options.auth.cookie
      ? {
          prefix: API_VERSION_PREFIX,
          service: options.auth.service,
          cookie: options.auth.cookie
        }
      : {
          prefix: API_VERSION_PREFIX,
          service: options.auth.service
        };

    app.register(registerAuthRoutes, authRouteOptions);
  }

  if (options.platform) {
    app.register(registerPlatformRoutes, {
      prefix: API_VERSION_PREFIX,
      service: options.platform.service
    });
  }

  if (options.exports) {
    app.register(registerExportRoutes, {
      prefix: API_VERSION_PREFIX,
      organizationId: options.exports.organizationId,
      service: options.exports.service,
      storage: options.exports.storage
    });
  }

  return app;
}

function createRuntimeMagicLinkSender(
  app: ReturnType<typeof Fastify>,
  config: ReturnType<typeof loadConfig>
): MagicLinkSender {
  const sender = createInMemoryMagicLinkSender({
    webPublicUrl: config.WEB_PUBLIC_URL
  });

  return {
    async sendMagicLink(input) {
      await sender.sendMagicLink(input);

      if (config.NODE_ENV !== "production") {
        app.log.info(
          {
            email: input.email,
            magicLinkUrl: sender.sent.at(-1)?.url
          },
          "created local magic link"
        );
      }
    }
  };
}
