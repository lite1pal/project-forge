import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { registerApiSchemas } from "../../http-schemas.js";
import type { CurrentUserContextService } from "../platform/context.js";
import { toCurrentUserResponse } from "../platform/presenters.js";
import type { AuthService } from "./service.js";
import {
  confirmSessionRouteSchema,
  createSessionRouteSchema,
  deleteSessionRouteSchema,
  getMeRouteSchema,
  logoutSessionRouteSchema,
  requestMagicLinkRouteSchema
} from "./http-contract.js";

const requestMagicLinkBodySchema = z.object({
  email: z.string().email()
});

const createSessionBodySchema = z.object({
  email: z.string().email(),
  token: z.string().min(1)
});

const confirmSessionQuerySchema = z.object({
  email: z.string().email(),
  redirectTo: z.string().optional(),
  token: z.string().min(1)
});

const logoutSessionQuerySchema = z.object({
  redirectTo: z.string().optional()
});

export interface AuthCookieOptions {
  domain?: string;
  name?: string;
  path?: string;
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  maxAgeSeconds?: number;
}

export interface AuthRoutesOptions {
  cookie?: AuthCookieOptions;
  currentUserContext?: CurrentUserContextService;
  service: AuthService;
  webPublicUrl?: string;
}

interface ResolvedAuthCookieOptions {
  domain?: string;
  maxAgeSeconds: number;
  name: string;
  path: string;
  sameSite: "Lax" | "Strict" | "None";
  secure: boolean;
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  options: AuthRoutesOptions
) {
  registerApiSchemas(app);

  const cookie: ResolvedAuthCookieOptions = {
    maxAgeSeconds: 60 * 60 * 24 * 30,
    name: "auditrail_session",
    path: "/",
    sameSite: "Lax" as const,
    secure: true,
    ...options.cookie
  };
  const webPublicUrl = options.webPublicUrl ?? "http://localhost:3000";

  app.post(
    "/auth/magic-links",
    { schema: requestMagicLinkRouteSchema },
    async (request, reply) => {
    const body = requestMagicLinkBodySchema.safeParse(request.body);

    if (!body.success) {
      return reply.code(400).send({
        error: "invalid_auth_request"
      });
    }

    await options.service.requestMagicLink(body.data.email);

    return reply.code(202).send({
      accepted: true
    });
    }
  );

  app.post(
    "/auth/sessions",
    { schema: createSessionRouteSchema },
    async (request, reply) => {
    try {
      const body = createSessionBodySchema.safeParse(request.body);

      if (!body.success) {
        return reply.code(400).send({
          error: "invalid_auth_request"
        });
      }

      const result = await options.service.createSessionFromMagicLink(
        body.data.token,
        body.data.email
      );

      reply.header(
        "set-cookie",
        serializeSessionCookie(cookie, result.sessionToken)
      );

      return reply.code(201).send({
        user: result.user
      });
    } catch (error) {
      if (error instanceof Error && error.message === "invalid_magic_link") {
        return reply.code(401).send({
          error: "invalid_magic_link"
        });
      }

      throw error;
    }
    }
  );

  app.post(
    "/auth/sessions/confirm",
    { schema: confirmSessionRouteSchema },
    async (request, reply) => {
      const query = confirmSessionQuerySchema.safeParse(request.query);

      if (!query.success) {
        return reply
          .code(303)
          .header("location", buildAuthErrorUrl(webPublicUrl, "invalid_magic_link"))
          .send();
      }

      try {
        const result = await options.service.createSessionFromMagicLink(
          query.data.token,
          query.data.email
        );

        return reply
          .code(303)
          .header("location", buildWebRedirectUrl(webPublicUrl, query.data.redirectTo, "/"))
          .header("set-cookie", serializeSessionCookie(cookie, result.sessionToken))
          .send();
      } catch (error) {
        if (error instanceof Error && error.message === "invalid_magic_link") {
          return reply
            .code(303)
            .header("location", buildAuthErrorUrl(webPublicUrl, "invalid_magic_link"))
            .send();
        }

        throw error;
      }
    }
  );

  app.delete(
    "/auth/sessions/current",
    { schema: deleteSessionRouteSchema },
    async (request, reply) => {
    const sessionToken = getCookieValue(request.headers.cookie, cookie.name);

    if (sessionToken) {
      await options.service.revokeSession(sessionToken);
    }

    reply.header("set-cookie", serializeExpiredSessionCookie(cookie));

    return reply.code(204).send();
    }
  );

  app.post(
    "/auth/sessions/current/logout",
    { schema: logoutSessionRouteSchema },
    async (request, reply) => {
      const query = logoutSessionQuerySchema.safeParse(request.query);
      const sessionToken = getCookieValue(request.headers.cookie, cookie.name);

      if (sessionToken) {
        await options.service.revokeSession(sessionToken);
      }

      return reply
        .code(303)
        .header(
          "location",
          buildWebRedirectUrl(webPublicUrl, query.success ? query.data.redirectTo : undefined, "/auth/sign-in")
        )
        .header("set-cookie", serializeExpiredSessionCookie(cookie))
        .send();
    }
  );

  app.get("/me", { schema: getMeRouteSchema }, async (request, reply) => {
    const sessionToken = getCookieValue(request.headers.cookie, cookie.name);
    const user = sessionToken
      ? await options.service.getSessionUser(sessionToken)
      : undefined;

    if (!user) {
      return reply.code(401).send({
        error: "missing_session"
      });
    }

    const context = options.currentUserContext
      ? await options.currentUserContext.getCurrentUserContext(user)
      : {
          memberships: [],
          user
        };

    return reply.send(toCurrentUserResponse(context));
  });
}

function serializeSessionCookie(cookie: ResolvedAuthCookieOptions, value: string) {
  return [
    `${cookie.name}=${value}`,
    cookie.domain ? `Domain=${cookie.domain}` : undefined,
    `Path=${cookie.path}`,
    "HttpOnly",
    `SameSite=${cookie.sameSite}`,
    `Max-Age=${cookie.maxAgeSeconds}`,
    cookie.secure ? "Secure" : undefined
  ]
    .filter(Boolean)
    .join("; ");
}

function serializeExpiredSessionCookie(cookie: ResolvedAuthCookieOptions) {
  return [
    `${cookie.name}=`,
    cookie.domain ? `Domain=${cookie.domain}` : undefined,
    `Path=${cookie.path}`,
    "HttpOnly",
    `SameSite=${cookie.sameSite}`,
    "Max-Age=0",
    cookie.secure ? "Secure" : undefined
  ]
    .filter(Boolean)
    .join("; ");
}

function getCookieValue(cookieHeader: string | undefined, name: string) {
  return cookieHeader
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function buildAuthErrorUrl(webPublicUrl: string, error: string) {
  const url = new URL("/auth/sign-in", webPublicUrl);
  url.searchParams.set("error", error);
  return url.toString();
}

function buildWebRedirectUrl(
  webPublicUrl: string,
  redirectTo: string | undefined,
  fallbackPath: string
) {
  const safePath = toSafeRedirectPath(redirectTo) ?? fallbackPath;
  return new URL(safePath, webPublicUrl).toString();
}

function toSafeRedirectPath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return undefined;
  }

  return value;
}
