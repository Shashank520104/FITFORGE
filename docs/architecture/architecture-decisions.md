# Architecture decisions

## Auth and workout data have separate owners

Accounts and refresh sessions use PostgreSQL because uniqueness, foreign keys, transactions, and token rotation matter. Workout plans use MongoDB as bounded aggregates containing days and planned sets; exercise documents remain independently addressable. Workout plans store the Auth user UUID as an external owner key and never join against private Auth data.

## Gateway is transport-only

The Gateway provides request IDs, routing, timeouts, a common error envelope, Redis-backed shared rate limiting, interactive OpenAPI docs, and access-token verification on protected paths. Domain validation and owner filtering remain in the owning service; account credential logic remains in Auth.

## Redis and BullMQ have bounded responsibilities

Redis stores atomic Gateway rate-limit windows and expiring Workout cache entries. BullMQ uses Redis to enqueue workout-insight refreshes after completed sessions; a separate worker reads the MongoDB-owned workout data and caches owner-scoped results. Cache misses compute insights directly from MongoDB, so Redis is not the source of truth.

## Access and refresh tokens

Access tokens are signed HS256 JWTs with a short configurable lifetime. Refresh tokens are opaque random values; only their SHA-256 digests are stored, and rotation revokes the presented session before issuing a new one inside a database transaction. Logout revokes refresh capability but does not revoke an already issued access token before expiry. Signing-key rotation and distributed revocation are not implemented.

## Local stack and migration

Compose runs independent application containers, MongoDB, PostgreSQL, Redis, a BullMQ worker, and one-shot SQL migration containers. Named volumes preserve local data. Database, Redis, and service ports are not published to non-loopback interfaces; only the Gateway is the public entry point.

## Not decided / not implemented

Nutrition/progress schemas, AI providers and vector storage, deployment target, observability backend, and multi-region behavior remain outside the current implementation.
