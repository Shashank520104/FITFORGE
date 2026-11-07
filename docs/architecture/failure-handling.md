# Failure handling

| Failure                                  | Current behavior                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Missing or invalid service configuration | Service startup fails explicitly; no secret is printed.                                          |
| PostgreSQL unavailable at Auth startup   | Auth does not bind its HTTP port. `/ready` checks PostgreSQL while running.                      |
| MongoDB unavailable at Workout startup   | Workout does not bind its HTTP port. `/ready` reflects connection state.                         |
| Downstream unavailable at Gateway        | Proxy returns a generic `503`; readiness reports the unavailable dependency.                     |
| Downstream timeout                       | Gateway returns `504`; no automatic retry risks duplicate writes.                                |
| Invalid JSON / oversized body            | API returns `400` / `413` with a stable error code.                                              |
| Invalid access token                     | Gateway and Workout return `401`; no downstream plan query runs.                                 |
| Plan missing or owned by another user    | Workout returns the same `404` to avoid disclosing resource existence.                           |
| MongoDB/PostgreSQL request failure       | Generic service error response; internal error class is logged, database detail is not returned. |
| SIGINT/SIGTERM                           | Application closes its listener and database connection/pool.                                    |

Compose startup uses health checks and successful migration completion rather than relying solely on container start order. No automatic retry, circuit breaker, distributed lock, or message queue is configured.
