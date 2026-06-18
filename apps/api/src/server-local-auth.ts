import { buildApp, requireRuntimeConfig } from "./app.js";
import { loadConfig } from "./config.js";
import { loadEnvFiles } from "./env-files.js";
import { createInMemoryMagicLinkSender } from "./modules/auth/senders.js";

const config = loadConfig(loadEnvFiles());
const sender = createInMemoryMagicLinkSender({
  webPublicUrl: requireRuntimeConfig(config.WEB_PUBLIC_URL, "WEB_PUBLIC_URL")
});
const app = buildApp({
  useInfrastructure: true,
  runtimeMagicLinkSender: {
    async sendMagicLink(input) {
      await sender.sendMagicLink(input);

      console.info(
        JSON.stringify({
          email: input.email,
          magicLinkUrl: sender.sent.at(-1)?.url
        })
      );
    }
  }
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
