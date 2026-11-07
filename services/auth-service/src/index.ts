import "dotenv/config";
import { Server } from "node:http";
import { Pool } from "pg";
import { createAuthApp } from "./app.js";
import { loadAuthConfig } from "./config.js";

async function startServer(): Promise<void> {
  let pool: Pool | undefined;
  let server: Server | undefined;

  try {
    const config = loadAuthConfig();
    pool = new Pool({ connectionString: config.DATABASE_URL });
    await pool.query("SELECT 1");

    server = createAuthApp(pool, config).listen(config.PORT);
    await new Promise<void>((resolve, reject) => {
      server?.once("error", reject);
      server?.once("listening", resolve);
    });
    console.log(`Auth Service listening on port ${config.PORT}`);

    const shutdown = (signal: NodeJS.Signals): void => {
      console.log(`Auth Service received ${signal}; shutting down`);
      server?.close((error) => {
        if (error) {
          console.error("Auth Service HTTP shutdown failed", error.name);
          process.exitCode = 1;
        }

        void pool?.end().catch((poolError: unknown) => {
          console.error(
            "Auth Service database shutdown failed",
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
      "Failed to start Auth Service",
      error instanceof Error ? error.name : "UnknownError",
    );
    await pool?.end().catch((poolError: unknown) => {
      console.error(
        "Auth Service database cleanup failed",
        poolError instanceof Error ? poolError.name : "UnknownError",
      );
      process.exitCode = 1;
    });
    process.exitCode = 1;
  }
}

void startServer();
