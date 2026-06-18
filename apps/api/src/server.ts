import { buildApp } from "./app.js";
import { loadRuntimeConfig } from "./config.js";
import { loadEnvFiles } from "./env-files.js";

const config = loadRuntimeConfig(loadEnvFiles());
const app = buildApp({
  useInfrastructure: true
});

try {
  await app.listen({
    host: config.API_HOST,
    port: config.API_PORT
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
