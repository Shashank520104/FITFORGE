# Scaling and bottlenecks

No throughput benchmarks or production scale measurements have been collected. The following are architectural observations, not measured capacity claims.

- Gateway limit windows are stored atomically in Redis, so Gateway replicas share a quota. Auth still has no separate account-level login throttle.
- Auth's refresh session state is PostgreSQL-backed. The unique token digest index and user foreign key support lookup and cleanup. Expired/revoked session retention cleanup is not yet implemented.
- Workout plan reads are owner-filtered and paginated. The `{ ownerId, updatedAt }` index supports list order. Exercise muscle-group substring regex filtering is not guaranteed to use its index and may need a dedicated search strategy as the catalogue grows.
- Gateway request bodies and upstream response buffers are currently bounded by the inbound body limit, but response buffering can increase memory use for large downstream responses. Streaming is a future improvement if large responses are introduced.
- MongoDB and PostgreSQL are each single local Compose instances with persistent volumes; no replication, backups, or failover are configured.
- Workout caches public exercise catalogue queries for five minutes and owner-scoped insights for fifteen minutes. Completing a workout advances that user's Redis cache generation and enqueues an asynchronous BullMQ refresh; workers only write if the generation is unchanged, preventing an older job from replacing newer insights. Cache failures are logged and reads fall back to MongoDB.
- Redis and MongoDB remain single local Compose instances without replication or failover; no throughput benchmark has established suitable production TTLs, limits, or queue concurrency.
