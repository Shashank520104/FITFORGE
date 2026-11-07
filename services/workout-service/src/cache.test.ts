import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Redis } from "ioredis";
import { RedisCacheStore } from "./services/cache.js";

const redisUrl = process.env.WORKOUT_TEST_REDIS_URL;

test(
  "stores and invalidates cached workout data in Redis",
  { skip: !redisUrl },
  async () => {
    if (!redisUrl) {
      throw new Error(
        "WORKOUT_TEST_REDIS_URL is required for Redis integration tests",
      );
    }

    const redis = new Redis(redisUrl);
    const cache = new RedisCacheStore(redis);
    const key = `fitforge:test:${randomUUID()}`;
    const payload = { data: [{ id: "exercise-1" }], sessionsAnalyzed: 2 };

    try {
      await redis.ping();
      await cache.set(key, payload, 30);
      assert.deepEqual(await cache.get<typeof payload>(key), payload);
      await cache.delete(key);
      assert.equal(await cache.get(key), null);

      const originalGeneration = await cache.getGeneration(key);
      await cache.invalidateVersioned(key);
      const currentGeneration = await cache.getGeneration(key);
      assert.equal(currentGeneration, originalGeneration + 1);
      assert.equal(
        await cache.setIfGenerationMatches(
          key,
          originalGeneration,
          payload,
          30,
        ),
        false,
      );
      assert.equal(await cache.getVersioned(key), null);
      assert.equal(
        await cache.setIfGenerationMatches(key, currentGeneration, payload, 30),
        true,
      );
      assert.deepEqual(await cache.getVersioned<typeof payload>(key), {
        generation: currentGeneration,
        value: payload,
      });
      await cache.invalidateVersioned(key);
      assert.equal(await cache.getVersioned(key), null);
    } finally {
      await redis.del(key, `${key}:generation`);
      await cache.close();
    }
  },
);
