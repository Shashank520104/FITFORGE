import "dotenv/config";
import { Server } from "node:http";
import { Pool } from "pg";
import { createProgressApp } from "./app.js";
import { loadProgressConfig } from "./config.js";

async function startServer(): Promise<void> {
  let pool: Pool | undefined;

  try {
    const config = loadProgressConfig();
    pool = new Pool({ connectionString: config.DATABASE_URL });
    await pool.query("SELECT 1");

    const server: Server = createProgressApp(pool, config).listen(config.PORT);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.once("listening", resolve);
    });
    console.log(`Progress Service listening on port ${config.PORT}`);

    const shutdown = (signal: NodeJS.Signals): void => {
      console.log(`Progress Service received ${signal}; shutting down`);
      server.close((error) => {
        if (error) {
          console.error("Progress Service HTTP shutdown failed", error.name);
          process.exitCode = 1;
        }
        void pool?.end().catch((poolError: unknown) => {
          console.error(
            "Progress Service database shutdown failed",
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
      "Failed to start Progress Service",
      error instanceof Error ? error.name : "UnknownError",
    );
    await pool?.end().catch((poolError: unknown) => {
      console.error(
        "Progress Service database cleanup failed",
        poolError instanceof Error ? poolError.name : "UnknownError",
      );
      process.exitCode = 1;
    });
    process.exitCode = 1;
  }
}

void startServer();
