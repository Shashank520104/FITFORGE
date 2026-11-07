# Request lifecycle

1. The Gateway assigns a fresh request ID and records a monotonic start time.
2. Health endpoints are handled locally. `/ready` checks both current downstream service readiness endpoints.
3. API requests pass the gateway's bounded in-process fixed-window limiter.
4. Workout-plan, food, and nutrition-log paths require a valid HS256 bearer access token at the gateway. Domain services verify the token again.
5. The Gateway forwards a constrained set of headers, the original URL/query, and request body (capped at 1 MiB) to a configured service with a timeout.
6. Auth validates JSON bodies, performs parameterized PostgreSQL operations, and returns an access token plus an HttpOnly refresh cookie where applicable.
7. Workout validates plan data, checks referenced exercise IDs, and scopes MongoDB operations by JWT subject. Nutrition validates user-entered food values and snapshots those values into meal entries transactionally.
8. Responses carry the gateway request ID. Gateway logs provide the status and elapsed time without including credentials or query strings.

Auth and Workout readiness depend on their databases. Liveness remains independent of database health. The Gateway is live when its process is running and ready only when both services are ready.
