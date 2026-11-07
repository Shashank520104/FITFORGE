import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import {
  BullWorkoutInsightsQueue,
  workoutInsightsQueueName,
} from "./jobs/insightsQueue.js";

const redisUrl = process.env.WORKOUT_TEST_REDIS_URL;

test(
  "processes and retrieves an owner-scoped BullMQ insights job",
  { skip: !redisUrl },
  async () => {
    if (!redisUrl) {
      throw new Error(
        "WORKOUT_TEST_REDIS_URL is required for BullMQ integration tests",
      );
    }

    const queueRedis = new Redis(redisUrl, { maxRetriesPerRequest: null });
    const workerRedis = new Redis(redisUrl, { maxRetriesPerRequest: null });
    const queue = new BullWorkoutInsightsQueue(queueRedis);
    const worker = new Worker(
      workoutInsightsQueueName,
      async (job) => ({ sessionId: job.data.sessionId }),
      { connection: workerRedis },
    );
    const ownerId = randomUUID();
    const sessionId = randomUUID();

    try {
      await Promise.all([queueRedis.ping(), worker.waitUntilReady()]);
      const jobId = await queue.enqueue({ ownerId, sessionId });
      const deadline = Date.now() + 10_000;
      let job = await queue.getJob(jobId);
      while (job && (await job.getState()) !== "completed") {
        if (Date.now() >= deadline) {
          throw new Error("BullMQ integration job did not complete in time");
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
        job = await queue.getJob(jobId);
      }

      assert.ok(job);
      assert.equal(job.ownerId, ownerId);
      assert.equal(await job.getState(), "completed");
      assert.deepEqual(job.getResult(), { sessionId });
    } finally {
      await worker.close();
      await queue.close();
      await Promise.all([queueRedis.quit(), workerRedis.quit()]);
    }
  },
);
