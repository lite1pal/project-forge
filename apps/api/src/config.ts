import { z } from "zod";

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    API_HOST: z.string().default("0.0.0.0"),
    PORT: z.coerce.number().int().positive().optional(),
    API_PORT: z.coerce.number().int().positive().default(4000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    RATE_LIMIT_WINDOW: z.string().default("1 minute"),
    API_KEY_PEPPER: z.string().min(16),
    AUTH_TOKEN_SECRET: z.string().min(32).optional(),
    AUTH_MAGIC_LINK_SENDER: z.enum(["log", "resend"]).optional(),
    AUTH_MAGIC_LINK_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    AUTH_RESEND_API_KEY: z.string().min(1).optional(),
    AUTH_RESEND_FROM_EMAIL: z.string().email().optional(),
    AUTH_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(2592000),
    AUTH_SESSION_COOKIE_NAME: z.string().default("auditrail_session"),
    AUTH_SESSION_COOKIE_SECURE: z.coerce.boolean().default(true),
    WEB_PUBLIC_URL: z.string().url().optional(),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url()
  })
  .superRefine((env, context) => {
    if (env.AUTH_MAGIC_LINK_SENDER === "resend") {
      if (!env.AUTH_RESEND_API_KEY) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "AUTH_RESEND_API_KEY is required when AUTH_MAGIC_LINK_SENDER=resend",
          path: ["AUTH_RESEND_API_KEY"]
        });
      }

      if (!env.AUTH_RESEND_FROM_EMAIL) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "AUTH_RESEND_FROM_EMAIL is required when AUTH_MAGIC_LINK_SENDER=resend",
          path: ["AUTH_RESEND_FROM_EMAIL"]
        });
      }
    }

    if (env.NODE_ENV !== "production") {
      return;
    }

    if (!env.AUTH_MAGIC_LINK_SENDER) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "AUTH_MAGIC_LINK_SENDER must be set explicitly in production",
        path: ["AUTH_MAGIC_LINK_SENDER"]
      });
      return;
    }

    if (env.AUTH_MAGIC_LINK_SENDER === "log") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "AUTH_MAGIC_LINK_SENDER=log is not allowed in production; configure a provider-backed sender",
        path: ["AUTH_MAGIC_LINK_SENDER"]
      });
    }
  });

export type ApiConfig = z.infer<typeof environmentSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return environmentSchema.parse(normalizeEnvironment(env));
}

export function loadRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
): ApiConfig {
  const config = loadConfig(env);

  if (!config.AUTH_MAGIC_LINK_SENDER) {
    throw new Error(
      "AUTH_MAGIC_LINK_SENDER must be set explicitly for standard runtime startup"
    );
  }

  if (config.AUTH_MAGIC_LINK_SENDER === "log") {
    throw new Error(
      "AUTH_MAGIC_LINK_SENDER=log is not allowed in standard runtime; use the local auth harness instead"
    );
  }

  return config;
}

function normalizeEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  if (!env.API_PORT && env.PORT) {
    return {
      ...env,
      API_PORT: env.PORT
    };
  }

  return env;
}
