import { Redis } from "ioredis";

export interface CacheStore {
  readonly isReady: boolean;
  waitUntilReady(): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  getVersioned<T>(
    key: string,
  ): Promise<{ generation: number; value: T } | null>;
  getGeneration(key: string): Promise<number>;
  setIfGenerationMatches<T>(
    key: string,
    generation: number,
    value: T,
    ttlSeconds: number,
  ): Promise<boolean>;
  invalidateVersioned(key: string): Promise<void>;
  close(): Promise<void>;
}

const cacheVersionTtlSeconds = 7 * 24 * 60 * 60;

const getVersionedScript = `
return { redis.call("GET", KEYS[1]) or false, redis.call("GET", KEYS[2]) or "0" }
`;

const setIfGenerationMatchesScript = `
local currentGeneration = tonumber(redis.call("GET", KEYS[2]) or "0")
local incomingGeneration = tonumber(ARGV[1])
if incomingGeneration ~= currentGeneration then
  return 0
end
redis.call("SET", KEYS[1], ARGV[2], "EX", ARGV[3])
return 1
`;

const invalidateVersionedScript = `
redis.call("INCR", KEYS[2])
redis.call("EXPIRE", KEYS[2], ARGV[1])
redis.call("DEL", KEYS[1])
return 1
`;

export async function readCache<T>(
  cache: CacheStore | undefined,
  key: string,
): Promise<T | null> {
  if (!cache) return null;
  try {
    return await cache.get<T>(key);
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "workout_cache_read_failed",
        error: error instanceof Error ? error.name : "UnknownError",
      }),
    );
    return null;
  }
}

export async function writeCache<T>(
  cache: CacheStore | undefined,
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<void> {
  if (!cache) return;
  try {
    await cache.set(key, value, ttlSeconds);
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "workout_cache_write_failed",
        error: error instanceof Error ? error.name : "UnknownError",
      }),
    );
  }
}

export async function deleteCache(
  cache: CacheStore | undefined,
  key: string,
): Promise<void> {
  if (!cache) return;
  try {
    await cache.delete(key);
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "workout_cache_delete_failed",
        error: error instanceof Error ? error.name : "UnknownError",
      }),
    );
  }
}

export async function readVersionedCache<T>(
  cache: CacheStore | undefined,
  key: string,
): Promise<{ generation: number; value: T } | null> {
  if (!cache) return null;
  try {
    return await cache.getVersioned<T>(key);
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "workout_cache_read_failed",
        error: error instanceof Error ? error.name : "UnknownError",
      }),
    );
    return null;
  }
}

export async function readCacheGeneration(
  cache: CacheStore | undefined,
  key: string,
): Promise<number | null> {
  if (!cache) return null;
  try {
    return await cache.getGeneration(key);
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "workout_cache_generation_read_failed",
        error: error instanceof Error ? error.name : "UnknownError",
      }),
    );
    return null;
  }
}

export async function writeCacheForGeneration<T>(
  cache: CacheStore | undefined,
  key: string,
  generation: number,
  value: T,
  ttlSeconds: number,
): Promise<boolean> {
  if (!cache) return false;
  try {
    return await cache.setIfGenerationMatches(
      key,
      generation,
      value,
      ttlSeconds,
    );
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "workout_cache_write_failed",
        error: error instanceof Error ? error.name : "UnknownError",
      }),
    );
    return false;
  }
}

export async function invalidateVersionedCache(
  cache: CacheStore | undefined,
  key: string,
): Promise<void> {
  if (!cache) return;
  try {
    await cache.invalidateVersioned(key);
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "workout_cache_invalidation_failed",
        error: error instanceof Error ? error.name : "UnknownError",
      }),
    );
  }
}

export class RedisCacheStore implements CacheStore {
  constructor(private readonly redis: Redis) {}

  get isReady(): boolean {
    return this.redis.status === "ready";
  }

  async waitUntilReady(): Promise<void> {
    if (this.isReady) return;
    await new Promise<void>((resolve, reject) => {
      this.redis.once("ready", resolve);
      this.redis.once("error", reject);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    return value === null ? null : (JSON.parse(value) as T);
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async getVersioned<T>(
    key: string,
  ): Promise<{ generation: number; value: T } | null> {
    const [raw, generationValue] = (await this.redis.eval(
      getVersionedScript,
      2,
      key,
      `${key}:generation`,
    )) as [string | null, string];
    if (raw === null) return null;
    const generation = Number(generationValue);
    if (!Number.isSafeInteger(generation) || generation < 0) {
      throw new Error("Redis returned an invalid cache generation");
    }
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("generation" in parsed) ||
      typeof parsed.generation !== "number" ||
      !Number.isSafeInteger(parsed.generation) ||
      !("value" in parsed)
    ) {
      throw new Error("Redis returned an invalid versioned cache entry");
    }
    if (parsed.generation !== generation) return null;
    return { generation, value: parsed.value as T };
  }

  async getGeneration(key: string): Promise<number> {
    const value = await this.redis.get(`${key}:generation`);
    const generation = value === null ? 0 : Number(value);
    if (!Number.isSafeInteger(generation) || generation < 0) {
      throw new Error("Redis returned an invalid cache generation");
    }
    return generation;
  }

  async setIfGenerationMatches<T>(
    key: string,
    generation: number,
    value: T,
    ttlSeconds: number,
  ): Promise<boolean> {
    if (!Number.isSafeInteger(generation) || generation < 0) {
      throw new Error("Cache generation must be a non-negative safe integer");
    }
    const result = await this.redis.eval(
      setIfGenerationMatchesScript,
      2,
      key,
      `${key}:generation`,
      String(generation),
      JSON.stringify({ generation, value }),
      String(ttlSeconds),
    );
    if (result !== 0 && result !== 1) {
      throw new Error("Redis returned an invalid versioned cache result");
    }
    return result === 1;
  }

  async invalidateVersioned(key: string): Promise<void> {
    await this.redis.eval(
      invalidateVersionedScript,
      2,
      key,
      `${key}:generation`,
      String(cacheVersionTtlSeconds),
    );
  }

  async close(): Promise<void> {
    if (this.redis.status === "end") return;
    await this.redis.quit();
  }
}
