import "dotenv/config";
import { Server } from "node:http";
import { Pool } from "pg";
import { createNutritionApp } from "./app.js";
import { loadNutritionConfig } from "./config.js";

async function startServer(): Promise<void> {
  let pool: Pool | undefined;

  try {
    const config = loadNutritionConfig();
    pool = new Pool({ connectionString: config.DATABASE_URL });
    await pool.query("SELECT 1");

    const server: Server = createNutritionApp(pool, config).listen(config.PORT);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.once("listening", resolve);
    });
    console.log(`Nutrition Service listening on port ${config.PORT}`);

    const shutdown = (signal: NodeJS.Signals): void => {
      console.log(`Nutrition Service received ${signal}; shutting down`);
      server.close((error) => {
        if (error) {
          console.error("Nutrition Service HTTP shutdown failed", error.name);
          process.exitCode = 1;
        }
        void pool?.end().catch((poolError: unknown) => {
          console.error(
            "Nutrition Service database shutdown failed",
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
      "Failed to start Nutrition Service",
      error instanceof Error ? error.name : "UnknownError",
    );
    await pool?.end().catch((poolError: unknown) => {
      console.error(
        "Nutrition Service database cleanup failed",
        poolError instanceof Error ? poolError.name : "UnknownError",
      );
      process.exitCode = 1;
    });
    process.exitCode = 1;
  }
}

void startServer();
