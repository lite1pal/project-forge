import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./", import.meta.url).pathname,
      "server-only": new URL("./src/test/server-only.ts", import.meta.url).pathname
    }
  },
  test: {
    coverage: {
      provider: "v8",
      thresholds: {
        branches: 85,
        functions: 90,
        lines: 90,
        statements: 90
      }
    },
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"]
  }
});
