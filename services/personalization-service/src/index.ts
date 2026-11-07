import "dotenv/config";
import { Server } from "node:http";
import { Pool } from "pg";
import { createPersonalizationApp } from "./app.js";
import { loadPersonalizationConfig } from "./config.js";

async function startServer(): Promise<void> {
  let pool: Pool | undefined;
  try {
    const config = loadPersonalizationConfig();
    pool = new Pool({ connectionString: config.DATABASE_URL });
    await pool.query("SELECT 1");
    const server: Server = createPersonalizationApp(pool, config).listen(
      config.PORT,
    );
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.once("listening", resolve);
    });
    console.log(`Personalization Service listening on port ${config.PORT}`);
    const shutdown = (signal: NodeJS.Signals): void => {
      console.log(`Personalization Service received ${signal}; shutting down`);
      server.close((error) => {
        if (error) {
          console.error(
            "Personalization Service HTTP shutdown failed",
            error.name,
          );
          process.exitCode = 1;
        }
        void pool?.end().catch((poolError: unknown) => {
          console.error(
            "Personalization Service database shutdown failed",
            poolError instanceof Error ? poolError.name : "UnknownError",
          );
          process.exitCode = 1;
        });
      });
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } catch (error) {
    console.error(
      "Failed to start Personalization Service",
      error instanceof Error ? error.name : "UnknownError",
    );
    await pool?.end();
    process.exitCode = 1;
  }
}

void startServer();
