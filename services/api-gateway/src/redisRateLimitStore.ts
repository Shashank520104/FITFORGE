import { Redis } from "ioredis";
import { RateLimitResult, RateLimitStore } from "./rateLimitStore.js";

const incrementWindow = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
return { count, redis.call("PTTL", KEYS[1]) }
`;

export class RedisRateLimitStore implements RateLimitStore {
  constructor(private readonly redis: Redis) {}

  get isReady(): boolean {
    return this.redis.status === "ready";
  }

  async consume(
    client: string,
    _max: number,
    windowMs: number,
    now: number,
  ): Promise<RateLimitResult> {
    const window = Math.floor(now / windowMs);
    const result = await this.redis.eval(
      incrementWindow,
      1,
      `fitforge:gateway:rate-limit:${window}:${client}`,
      String(windowMs),
    );
    if (!Array.isArray(result) || result.length !== 2) {
      throw new Error("Redis returned an invalid rate-limit result");
    }

    const [count, ttl] = result.map(Number);
    if (!Number.isSafeInteger(count) || !Number.isFinite(ttl) || ttl < 0) {
      throw new Error("Redis returned an invalid rate-limit window");
    }

    return { count, resetAt: now + ttl };
  }
}
