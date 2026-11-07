import "dotenv/config";
import { readFile } from "node:fs/promises";
import { Server } from "node:http";
import { Redis } from "ioredis";
import { createGatewayApp } from "./app.js";
import { loadGatewayConfig } from "./config.js";
import { RedisRateLimitStore } from "./redisRateLimitStore.js";

async function startServer(): Promise<void> {
  let redis: Redis | undefined;
  try {
    const config = loadGatewayConfig();
    redis = new Redis(config.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    await redis.connect();
    const openApiDocument = await readFile(
      new URL("../openapi.yaml", import.meta.url),
      "utf8",
    );
    const server: Server = createGatewayApp(
      config,
      new RedisRateLimitStore(redis),
      openApiDocument,
    ).listen(config.PORT);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.once("listening", resolve);
    });
    console.log(`API Gateway listening on port ${config.PORT}`);

    const shutdown = (signal: NodeJS.Signals): void => {
      console.log(`API Gateway received ${signal}; shutting down`);
      server.close((error) => {
        if (error) {
          console.error("API Gateway HTTP shutdown failed", error.name);
          process.exitCode = 1;
        }
        void redis?.quit().catch((redisError: unknown) => {
          console.error(
            "API Gateway Redis shutdown failed",
            redisError instanceof Error ? redisError.name : "UnknownError",
          );
          process.exitCode = 1;
        });
      });
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } catch (error) {
    console.error(
      "Failed to start API Gateway",
      error instanceof Error ? error.name : "UnknownError",
    );
    if (redis) {
      await redis.quit().catch((redisError: unknown) => {
        console.error(
          "API Gateway Redis cleanup failed",
          redisError instanceof Error ? redisError.name : "UnknownError",
        );
      });
    }
    process.exitCode = 1;
  }
}

void startServer();
