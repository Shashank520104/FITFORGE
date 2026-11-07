import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Redis } from "ioredis";
import { RedisRateLimitStore } from "./redisRateLimitStore.js";

const redisUrl = process.env.REDIS_TEST_URL;

test(
  "shares an atomic rate-limit window between gateway instances",
  { skip: !redisUrl },
  async () => {
    if (!redisUrl) {
      throw new Error("REDIS_TEST_URL is required for Redis integration tests");
    }

    const [firstRedis, secondRedis] = [
      new Redis(redisUrl),
      new Redis(redisUrl),
    ];
    try {
      await Promise.all([firstRedis.ping(), secondRedis.ping()]);
      const firstGateway = new RedisRateLimitStore(firstRedis);
      const secondGateway = new RedisRateLimitStore(secondRedis);
      const client = `integration-${randomUUID()}`;
      const now = Date.now();
      const first = await firstGateway.consume(client, 2, 60_000, now);
      const second = await secondGateway.consume(client, 2, 60_000, now);

      assert.equal(first.count, 1);
      assert.equal(second.count, 2);
      assert.equal(first.resetAt, second.resetAt);
    } finally {
      await Promise.all([firstRedis.quit(), secondRedis.quit()]);
    }
  },
);
