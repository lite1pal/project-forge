export function fixedDate(isoDate = "2026-06-16T00:00:00.000Z"): Date {
  return new Date(isoDate);
}

export function createTestEnv(
  overrides: Record<string, string | undefined> = {}
): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    API_HOST: "127.0.0.1",
    API_PORT: "4000",
    RATE_LIMIT_MAX: "100",
    RATE_LIMIT_WINDOW: "1 minute",
    API_KEY_PEPPER: "test-api-key-pepper",
    DATABASE_URL: "postgres://auditrail:auditrail@localhost:5433/auditrail",
    REDIS_URL: "redis://localhost:6379",
    ...overrides
  };
}
