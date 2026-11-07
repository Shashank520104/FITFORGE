export type RateLimitResult = {
  count: number;
  resetAt: number;
};

export interface RateLimitStore {
  readonly isReady: boolean;
  consume(
    client: string,
    max: number,
    windowMs: number,
    now: number,
  ): Promise<RateLimitResult>;
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, RateLimitResult>();

  get isReady(): boolean {
    return true;
  }

  async consume(
    client: string,
    _max: number,
    windowMs: number,
    now: number,
  ): Promise<RateLimitResult> {
    const bucket = this.buckets.get(client);
    if (!bucket || bucket.resetAt <= now) {
      const next = { count: 1, resetAt: now + windowMs };
      this.buckets.set(client, next);
      return next;
    }

    bucket.count += 1;
    return bucket;
  }
}
