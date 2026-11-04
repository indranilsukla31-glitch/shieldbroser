import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

const cfg = loadConfig();
const { app } = await buildApp(cfg);
await app.listen({ port: cfg.PORT, host: cfg.HOST });
if (!cfg.MOCK_CATALOG && !cfg.JAMENDO_CLIENT_ID) {
  app.log.warn("JAMENDO_CLIENT_ID is empty — set it in .env, or run with MOCK_CATALOG=1 for the offline demo catalog.");
}
