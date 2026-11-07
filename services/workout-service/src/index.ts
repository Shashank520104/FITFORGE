import "dotenv/config";
import { Server } from "node:http";
import { Redis } from "ioredis";
import { connectDB, disconnectDB } from "./config/db.js";
import { createWorkoutApp } from "./app.js";
import { BullWorkoutInsightsQueue } from "./jobs/insightsQueue.js";
import { RedisCacheStore } from "./services/cache.js";
import { seedExerciseCatalog } from "./services/exerciseCatalog.js";

function getPort(value: string | undefined): number {
  if (value === undefined) {
    return 3001;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  return port;
}

async function startServer(): Promise<void> {
  let server: Server | undefined;
  let queueRedis: Redis | undefined;
  let cache: RedisCacheStore | undefined;
  let insightsQueue: BullWorkoutInsightsQueue | undefined;

  try {
    const port = getPort(process.env.PORT);
    const jwtSecret = process.env.JWT_SECRET;
    const redisUrl = process.env.REDIS_URL;
    if (!jwtSecret || jwtSecret.length < 32) {
      throw new Error("JWT_SECRET must contain at least 32 characters");
    }
    if (!redisUrl) throw new Error("REDIS_URL is missing from environment");

    await connectDB();
    queueRedis = new Redis(redisUrl, { maxRetriesPerRequest: null });
    const cacheRedis = new Redis(redisUrl);
    cache = new RedisCacheStore(cacheRedis);
    await Promise.all([queueRedis.ping(), cache.waitUntilReady()]);
    insightsQueue = new BullWorkoutInsightsQueue(queueRedis);
    await seedExerciseCatalog();

    server = createWorkoutApp(jwtSecret, { cache, insightsQueue }).listen(port);
    await new Promise<void>((resolve, reject) => {
      server?.once("error", reject);
      server?.once("listening", resolve);
    });

    console.log(`Workout Service listening on port ${port}`);

    const shutdown = (signal: NodeJS.Signals): void => {
      console.log(`Workout Service received ${signal}; shutting down`);
      server?.close(async (error) => {
        if (error) {
          console.error("Workout Service HTTP shutdown failed", error.name);
          process.exitCode = 1;
        }
        try {
          await insightsQueue?.close();
          await cache?.close();
          await disconnectDB();
          await queueRedis?.quit();
        } catch (shutdownError) {
          console.error(
            "Workout Service dependency shutdown failed",
            shutdownError instanceof Error
              ? shutdownError.name
              : "UnknownError",
          );
          process.exitCode = 1;
        }
      });
    };

    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } catch (error) {
    console.error(
      "Failed to start Workout Service",
      error instanceof Error ? error.name : "UnknownError",
    );
    if (server?.listening) {
      server.close();
    }
    try {
      await insightsQueue?.close();
    } catch (disconnectError) {
      console.error(
        "Workout Service queue cleanup failed",
        disconnectError instanceof Error
          ? disconnectError.name
          : "UnknownError",
      );
      process.exitCode = 1;
    }
    try {
      await cache?.close();
    } catch (cleanupError) {
      console.error(
        "Workout Service cache cleanup failed",
        cleanupError instanceof Error ? cleanupError.name : "UnknownError",
      );
      process.exitCode = 1;
    }
    try {
      await disconnectDB();
    } catch (cleanupError) {
      console.error(
        "Workout Service database cleanup failed",
        cleanupError instanceof Error ? cleanupError.name : "UnknownError",
      );
      process.exitCode = 1;
    }
    if (queueRedis) {
      await queueRedis.quit().catch((cleanupError: unknown) => {
        console.error(
          "Workout Service Redis cleanup failed",
          cleanupError instanceof Error ? cleanupError.name : "UnknownError",
        );
        process.exitCode = 1;
      });
    }
    process.exitCode = 1;
  }
}

void startServer();
