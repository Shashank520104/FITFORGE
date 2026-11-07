import "dotenv/config";
import { Redis } from "ioredis";
import { connectDB, disconnectDB } from "./config/db.js";
import { createWorkoutInsightsWorker } from "./jobs/workoutInsightsWorker.js";
import { RedisCacheStore } from "./services/cache.js";

async function startWorker(): Promise<void> {
  let redis: Redis | undefined;
  let cache: RedisCacheStore | undefined;
  let worker: ReturnType<typeof createWorkoutInsightsWorker> | undefined;

  try {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) throw new Error("REDIS_URL is missing from environment");

    redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
    cache = new RedisCacheStore(new Redis(redisUrl));
    await Promise.all([redis.ping(), cache.waitUntilReady()]);
    await connectDB();
    worker = createWorkoutInsightsWorker(redis, cache);
    await worker.waitUntilReady();
    console.log("Workout insights worker is ready");

    const shutdown = (signal: NodeJS.Signals): void => {
      console.log(`Workout insights worker received ${signal}; shutting down`);
      void (async () => {
        try {
          await worker?.close();
          await cache?.close();
          await disconnectDB();
          await redis?.quit();
        } catch (shutdownError) {
          console.error(
            "Workout insights worker shutdown failed",
            shutdownError instanceof Error
              ? shutdownError.name
              : "UnknownError",
          );
          process.exitCode = 1;
        }
      })();
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } catch (error) {
    console.error(
      "Failed to start workout insights worker",
      error instanceof Error ? error.name : "UnknownError",
    );
    try {
      await worker?.close();
    } catch (cleanupError) {
      console.error(
        "Workout insights worker cleanup failed",
        cleanupError instanceof Error ? cleanupError.name : "UnknownError",
      );
    }
    try {
      await cache?.close();
    } catch (cleanupError) {
      console.error(
        "Workout insights cache cleanup failed",
        cleanupError instanceof Error ? cleanupError.name : "UnknownError",
      );
    }
    try {
      await disconnectDB();
    } catch (cleanupError) {
      console.error(
        "Workout insights database cleanup failed",
        cleanupError instanceof Error ? cleanupError.name : "UnknownError",
      );
    }
    if (redis) {
      await redis.quit().catch((cleanupError: unknown) => {
        console.error(
          "Workout insights Redis cleanup failed",
          cleanupError instanceof Error ? cleanupError.name : "UnknownError",
        );
      });
    }
    process.exitCode = 1;
  }
}

void startWorker();
