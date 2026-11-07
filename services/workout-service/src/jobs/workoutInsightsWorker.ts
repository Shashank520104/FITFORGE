import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { workoutInsightsQueueName } from "./insightsQueue.js";
import { CacheStore, writeCacheForGeneration } from "../services/cache.js";
import { buildInsightsForOwner } from "../services/workoutInsightsQuery.js";

const insightsCacheTtlSeconds = 15 * 60;

export function createWorkoutInsightsWorker(
  redis: Redis,
  cache: CacheStore,
): Worker {
  const worker = new Worker(
    workoutInsightsQueueName,
    async (job) => {
      const cacheKey = `fitforge:workout:insights:${job.data.ownerId}`;
      const generation = await cache.getGeneration(cacheKey);
      const insights = await buildInsightsForOwner(job.data.ownerId);
      const cacheUpdated = await writeCacheForGeneration(
        cache,
        cacheKey,
        generation,
        insights,
        insightsCacheTtlSeconds,
      );
      return { cacheUpdated };
    },
    { connection: redis, concurrency: 4 },
  );

  worker.on("failed", (job, error) => {
    console.error(
      JSON.stringify({
        event: "workout_insights_job_failed",
        jobId: job?.id,
        error: error.name,
      }),
    );
  });
  worker.on("error", (error) => {
    console.error(
      JSON.stringify({
        event: "workout_insights_worker_error",
        error: error.name,
      }),
    );
  });

  return worker;
}
