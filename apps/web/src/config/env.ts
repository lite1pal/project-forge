import { z } from "zod";

const serverEnvironmentSchema = z.object({
  AUTH_SESSION_COOKIE_NAME: z.string().default("auditrail_session"),
  WEB_API_BASE_URL: z.string().url()
});

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url()
});

export type WebServerConfig = z.infer<typeof serverEnvironmentSchema>;
export type WebPublicConfig = z.infer<typeof publicEnvironmentSchema>;

export function loadServerConfig(
  env: NodeJS.ProcessEnv = process.env
): WebServerConfig {
  return serverEnvironmentSchema.parse(env);
}

export function loadPublicConfig(
  env: Pick<NodeJS.ProcessEnv, "NEXT_PUBLIC_API_BASE_URL"> = {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL
  }
): WebPublicConfig {
  return publicEnvironmentSchema.parse(env);
}
