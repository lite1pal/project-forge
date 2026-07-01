import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import Fastify, { type FastifyServerOptions } from "fastify";

import {
  API_BASE_PATH,
  API_VERSION,
  API_VERSION_PREFIX,
  getApiDescriptor,
} from "./api-version.js";
import { loadConfig, type ApiConfig } from "./config.js";
import { loadEnvFiles } from "./env-files.js";
import { registerApiErrorHandler } from "./http-errors.js";
import { registerApiSchemas, schemaIds } from "./http-schemas.js";
import { createPostgresApiKeyRepo } from "./modules/api-keys/postgres-repo.js";
import { registerApiKeyRoutes } from "./modules/api-keys/routes.js";
import { createCustomerService } from "./modules/generated/customer/service.js";
import { registerCustomerRoutes } from "./modules/generated/customer/routes.js";
import { createPostgresCustomerRepo } from "./modules/generated/customer/postgres-repo.js";
import {
  createApiKeyService,
  type ApiKeyService,
} from "./modules/api-keys/service.js";
import { createPostgresAuthRepo } from "./modules/auth/postgres-repo.js";
import {
  registerAuthRoutes,
  type AuthCookieOptions,
} from "./modules/auth/routes.js";
import { createResendMagicLinkSender } from "./modules/auth/senders.js";
import {
  createAuthService,
  type AuthService,
  type MagicLinkSender,
} from "./modules/auth/service.js";
import { createWorkspaceAccessService } from "./modules/platform/access.js";
import { createPostgresPlatformBillingRepo } from "./modules/platform/billing/postgres-repo.js";
import {
  createBillingProviderRegistry,
  createPlatformBillingRuntime,
  createNoopBillingProviderAdapter,
  createStripeBillingPlanResolver,
  createStripeBillingProviderAdapter
} from "./modules/platform/billing/provider.js";
import { registerPlatformBillingRoutes } from "./modules/platform/billing/routes.js";
import {
  createPlatformBillingService,
  type PlatformBillingService,
} from "./modules/platform/billing/service.js";
import { createCurrentUserContextService } from "./modules/platform/context.js";
import { createPlatformEntitlementService } from "./modules/platform/entitlements/service.js";
import { createPostgresPlatformRepo } from "./modules/platform/postgres-repo.js";
import { registerPlatformRoutes } from "./modules/platform/routes.js";
import { createPostgresPlatformSupportRepo } from "./modules/platform/support/postgres-repo.js";
import { registerPlatformSupportRoutes } from "./modules/platform/support/routes.js";
import {
  createPlatformSupportService,
  type PlatformSupportService
} from "./modules/platform/support/service.js";
import {
  createPlatformService,
  type PlatformService,
} from "./modules/platform/service.js";
import { createPostgresPlatformProjectWebhooksRepo } from "./modules/platform/webhooks/postgres-repo.js";
import { registerPlatformProjectWebhookRoutes } from "./modules/platform/webhooks/routes.js";
import { createPlatformProjectWebhooksService } from "./modules/platform/webhooks/service.js";
import { authPlugin } from "./plugins/auth.js";
import { databasePlugin } from "./plugins/database.js";
import { rateLimitPlugin } from "./plugins/rate-limit.js";
import {
  REQUEST_ID_HEADER,
  requestRuntimePlugin,
  resolveRequestId,
} from "./plugins/request-runtime.js";
import { sessionAuthPlugin } from "./plugins/session-auth.js";
import {
  currentProductId,
  getProductApiOpenApiInfo,
  listRegisteredProducts,
  registerProductApiRoutes
} from "./product-module.js";

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
  apiKeys?: {
    service: ApiKeyService;
  };
  platform?: {
    service: PlatformService;
  };
  billing?: {
    service: PlatformBillingService;
  };
  support?: {
    service: PlatformSupportService;
  };
  runtimeMagicLinkSender?: MagicLinkSender;
  useInfrastructure?: boolean;
  useRateLimit?: boolean;
  rateLimit?: RateLimitOptions;
  infrastructure?: InfrastructureOptions;
  logger?: FastifyServerOptions["logger"];
  nodeEnv?: ApiConfig["NODE_ENV"];
}

interface RuntimeMagicLinkSenderDependencies {
  fetch?: typeof fetch;
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: options.logger ?? true,
    disableRequestLogging: true,
    requestIdHeader: false,
    genReqId(request) {
      return resolveRequestId(request.headers[REQUEST_ID_HEADER]);
    },
  });

  app.register(requestRuntimePlugin);
  registerApiErrorHandler(app, {
    nodeEnv: options.nodeEnv
  });
  registerApiSchemas(app);

  app.register(swagger, {
    openapi: {
      info: {
        title: getProductApiOpenApiInfo().title,
        version: API_VERSION,
        description: getProductApiOpenApiInfo().description,
      },
      tags: [
        {
          name: "meta",
          description: "API metadata and health",
        },
        {
          name: "events",
          description: "Audit event ingestion and query",
        },
        {
          name: "auth",
          description: "Browser session authentication",
        },
        {
          name: "platform",
          description:
            "Workspace, membership, and machine credential management",
        },
        {
          name: "support",
          description: "Internal support lookup and troubleshooting"
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
          },
        },
      },
    },
  });

  app.register(cors, {
    origin: true,
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
            $ref: `${schemaIds.healthResponse}#`,
          },
        },
      },
    },
    async () => {
      return {
        status: "ok",
      };
    },
  );
  app.get(
    API_BASE_PATH,
    {
      schema: {
        tags: ["meta"],
        summary: "Returns API version metadata",
        response: {
          200: {
            $ref: `${schemaIds.apiDescriptorResponse}#`,
          },
        },
      },
    },
    async () => getApiDescriptor(listRegisteredProducts()),
  );
  app.get(
    `${API_VERSION_PREFIX}/health`,
    {
      schema: {
        tags: ["meta"],
        summary: "Returns versioned API health",
        response: {
          200: {
            $ref: `${schemaIds.healthResponse}#`,
          },
        },
      },
    },
    async () => {
      return {
        status: "ok",
      };
    },
  );
  app.get(
    `${API_VERSION_PREFIX}/openapi.json`,
    {
      schema: {
        tags: ["meta"],
        summary: "Returns the OpenAPI document for the current API version",
        response: {
          200: {
            $ref: `${schemaIds.openApiDocumentResponse}#`,
          },
        },
      },
    },
    async () => app.swagger(),
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
      const authTokenSecret = requireRuntimeConfig(
        config.AUTH_TOKEN_SECRET,
        "AUTH_TOKEN_SECRET",
      );
      const apiKeyPepper = requireRuntimeConfig(
        config.API_KEY_PEPPER,
        "API_KEY_PEPPER",
      );
      const authRepo = createPostgresAuthRepo(infrastructureApp.db);
      const apiKeyRepo = createPostgresApiKeyRepo(infrastructureApp.db);
      const billingRepo = createPostgresPlatformBillingRepo(infrastructureApp.db);
      const platformRepo = createPostgresPlatformRepo(infrastructureApp.db);
      const supportRepo = createPostgresPlatformSupportRepo(infrastructureApp.db);
      const projectWebhooksRepo = createPostgresPlatformProjectWebhooksRepo(
        infrastructureApp.db
      );
      const magicLinkSender =
        options.runtimeMagicLinkSender ?? createRuntimeMagicLinkSender(config);
      const webPublicUrl = requireRuntimeConfig(
        config.WEB_PUBLIC_URL,
        "WEB_PUBLIC_URL",
      );
      const apiKeyService = createApiKeyService(apiKeyRepo, {
        pepper: apiKeyPepper,
      });
      const workspaceAccessService = createWorkspaceAccessService({
        findMembership: apiKeyRepo.findMembership.bind(apiKeyRepo),
        findProject: apiKeyRepo.findProject.bind(apiKeyRepo),
        isOrganizationProductInstalled:
          platformRepo.isOrganizationProductInstalled.bind(platformRepo)
      });
      const authService = createAuthService(authRepo, magicLinkSender, {
        magicLinkTtlMs: config.AUTH_MAGIC_LINK_TTL_SECONDS * 1000,
        sessionTtlMs: config.AUTH_SESSION_TTL_SECONDS * 1000,
        tokenSecret: authTokenSecret,
      });
      const platformService = createPlatformService(platformRepo, {
        defaultInstalledProductIds: [currentProductId]
      });
      const billingProviderRegistry = createBillingProviderRegistry([
        config.BILLING_STRIPE_SECRET_KEY
          ? createStripeBillingProviderAdapter({
              resolvePriceId: createStripeBillingPlanResolver({
                growth: config.BILLING_STRIPE_PRICE_ID_GROWTH!,
                scale: config.BILLING_STRIPE_PRICE_ID_SCALE!,
                starter: config.BILLING_STRIPE_PRICE_ID_STARTER!
              }),
              secretKey: config.BILLING_STRIPE_SECRET_KEY
            })
          : createNoopBillingProviderAdapter("stripe"),
        createNoopBillingProviderAdapter("paddle")
      ]);
      const billingService = createPlatformBillingService({
        ...billingRepo,
        findMembership: platformRepo.findMembership
      }, {
        runtime: createPlatformBillingRuntime({
          activeProvider: config.BILLING_PROVIDER,
          registry: billingProviderRegistry
        })
      });
      const supportService =
        options.support?.service ??
        createPlatformSupportService(supportRepo, {
          billingRepo,
          entitlementService: createPlatformEntitlementService(platformRepo)
        });
      const projectWebhooksService = createPlatformProjectWebhooksService(
        projectWebhooksRepo
      );

      infrastructureApp.register(sessionAuthPlugin, {
        cookieName: config.AUTH_SESSION_COOKIE_NAME,
        service: authService,
      });

      infrastructureApp.register(registerAuthRoutes, {
        cookie: {
          domain: config.AUTH_SESSION_COOKIE_DOMAIN,
          maxAgeSeconds: config.AUTH_SESSION_TTL_SECONDS,
          name: config.AUTH_SESSION_COOKIE_NAME,
          secure: config.AUTH_SESSION_COOKIE_SECURE,
        },
        currentUserContext: createCurrentUserContextService(platformRepo),
        prefix: API_VERSION_PREFIX,
        service: authService,
        webPublicUrl,
      });
      infrastructureApp.register(registerPlatformRoutes, {
        invitationTokenSecret: authTokenSecret,
        prefix: API_VERSION_PREFIX,
        service: platformService,
      });
      infrastructureApp.register(registerPlatformBillingRoutes, {
        prefix: API_VERSION_PREFIX,
        service: billingService,
      });
      infrastructureApp.register(registerPlatformSupportRoutes, {
        prefix: API_VERSION_PREFIX,
        service: supportService,
      });
      infrastructureApp.register(registerPlatformProjectWebhookRoutes, {
        prefix: API_VERSION_PREFIX,
        service: projectWebhooksService
      });
      infrastructureApp.register(registerApiKeyRoutes, {
        prefix: API_VERSION_PREFIX,
        service: apiKeyService,
      });
      infrastructureApp.register(registerCustomerRoutes, {
        access: workspaceAccessService,
        prefix: API_BASE_PATH,
        service: createCustomerService(
          createPostgresCustomerRepo(infrastructureApp.db)
        )
      });
      infrastructureApp.register(registerProductApiRoutes, {
        prefix: API_VERSION_PREFIX,
        productAccess: workspaceAccessService,
        productId: currentProductId,
        projectAccess: workspaceAccessService
      });
    });
  }

  if (!options.useInfrastructure) {
    app.register(registerProductApiRoutes, {
      prefix: API_VERSION_PREFIX,
    });
  }

  if (options.auth) {
    const authRouteOptions = options.auth.cookie
      ? {
          prefix: API_VERSION_PREFIX,
          service: options.auth.service,
          cookie: options.auth.cookie,
        }
      : {
          prefix: API_VERSION_PREFIX,
          service: options.auth.service,
        };

    app.register(registerAuthRoutes, authRouteOptions);
  }

  if (options.platform) {
    app.register(registerPlatformRoutes, {
      prefix: API_VERSION_PREFIX,
      service: options.platform.service,
    });
  }

  if (options.billing) {
    app.register(registerPlatformBillingRoutes, {
      prefix: API_VERSION_PREFIX,
      service: options.billing.service,
    });
  }

  if (options.support) {
    app.register(registerPlatformSupportRoutes, {
      prefix: API_VERSION_PREFIX,
      service: options.support.service,
    });
  }

  if (options.apiKeys) {
    app.register(registerApiKeyRoutes, {
      prefix: API_VERSION_PREFIX,
      service: options.apiKeys.service,
    });
  }

  return app;
}

export function createRuntimeMagicLinkSender(
  config: ReturnType<typeof loadConfig>,
  dependencies: RuntimeMagicLinkSenderDependencies = {},
): MagicLinkSender {
  const webPublicUrl = requireRuntimeConfig(
    config.WEB_PUBLIC_URL,
    "WEB_PUBLIC_URL",
  );

  if (config.AUTH_MAGIC_LINK_SENDER !== "resend") {
    throw new Error(
      "invalid_runtime_magic_link_sender: standard runtime requires a provider-backed sender",
    );
  }

  return createResendMagicLinkSender({
    apiKey: requireRuntimeConfig(
      config.AUTH_RESEND_API_KEY,
      "AUTH_RESEND_API_KEY",
    ),
    fetch: dependencies.fetch,
    fromEmail: requireRuntimeConfig(
      config.AUTH_RESEND_FROM_EMAIL,
      "AUTH_RESEND_FROM_EMAIL",
    ),
    webPublicUrl,
  });
}

export function requireRuntimeConfig(
  value: string | undefined,
  name: string,
): string {
  if (!value) {
    throw new Error(`missing_runtime_config:${name}`);
  }

  return value;
}
