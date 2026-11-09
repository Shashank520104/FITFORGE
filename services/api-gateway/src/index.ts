import "dotenv/config";
import { readFile } from "node:fs/promises";
import { Server } from "node:http";
import { Redis } from "ioredis";
import { createGatewayApp } from "./app.js";
import { loadGatewayConfig } from "./config.js";
import { InMemoryRateLimitStore, RateLimitStore } from "./rateLimitStore.js";
import { RedisRateLimitStore } from "./redisRateLimitStore.js";

async function startServer(): Promise<void> {
  let redis: Redis | undefined;
  try {
    const config = loadGatewayConfig();
    let rateLimitStore: RateLimitStore;

    if (config.REDIS_URL && !config.REDIS_URL.includes("localhost")) {
      try {
        redis = new Redis(config.REDIS_URL, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          connectTimeout: 5000,
        });
        await redis.connect();
        rateLimitStore = new RedisRateLimitStore(redis);
        console.log("Connected to Redis for rate limiting");
      } catch (redisError) {
        console.warn(
          "Redis connection failed; falling back to in-memory rate limiting:",
          redisError instanceof Error ? redisError.message : String(redisError),
        );
        rateLimitStore = new InMemoryRateLimitStore();
      }
    } else {
      console.log("Using in-memory rate limit store");
      rateLimitStore = new InMemoryRateLimitStore();
    }

    const openApiDocument = await readFile(
      new URL("../openapi.yaml", import.meta.url),
      "utf8",
    );
    const server: Server = createGatewayApp(
      config,
      rateLimitStore,
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
      "Failed to start API Gateway:",
      error instanceof Error ? error.stack || error.message : error,
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
