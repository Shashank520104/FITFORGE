# System overview

## Current implementation

The current code includes a React web app, Express API Gateway, Auth Service, Workout Service, Nutrition Service, Progress Service, Profile Service, and a Workout Insights Worker. Auth owns account credentials and refresh sessions in its PostgreSQL database. Workout owns exercises, bounded workout-plan aggregates, and session history in MongoDB. Nutrition owns user-entered foods and meal-log snapshots in a separate PostgreSQL database. Progress owns body measurements and strength records in its own PostgreSQL database. Profile owns private user preferences in another PostgreSQL database. Redis supports shared gateway rate limits, expiring Workout caches, and the BullMQ queue. Each domain service only connects to its own system of record.

Authentication uses bcrypt hashes, opaque random refresh tokens stored by SHA-256 digest, rotating HttpOnly cookies, and short-lived HS256 access JWTs. The web app keeps access tokens in memory and uses the HttpOnly cookie for refresh. The gateway checks bearer tokens on protected paths; domain services verify them independently. Workout plans/sessions, foods, nutrition logs, measurements, strength records, and profile preferences are scoped to the verified token subject.

## API boundaries

- Auth: `/api/v1/auth/*`.
- Workout: public `GET /api/v1/exercises`; protected `/api/v1/workout-plans` and `/api/v1/workout-sessions`.
- Nutrition: protected `/api/v1/foods` and `/api/v1/nutrition/logs`.
- Progress: protected `/api/v1/progress/*`.
- Profile: protected `/api/v1/profile`.
- Workout completion enqueues owner-scoped insight refresh work; the worker reads MongoDB and refreshes the Redis cache. The existing insights route computes directly from MongoDB on a cache miss.
- The current Compose stack provisions PostgreSQL, MongoDB, Redis, service containers, the workout worker, and separate Auth/Nutrition/Progress/Profile databases. The local web app is published on port `8080`; the gateway is published on port `3000`.
- Interactive gateway API documentation is available at `/docs/`; the OpenAPI contract is served at `/openapi.yaml`.

## Still outstanding

There is no provider-backed AI Service/RAG/Qdrant, Prometheus/Grafana setup, or production deployment. The assistant remains explicitly unavailable rather than returning simulated answers. Architecture diagrams distinguish implemented systems from proposed work. No measured load or deployment results are claimed.

## Request flow

```mermaid
sequenceDiagram
    participant W as Browser Web App
    participant G as API Gateway
    participant A as Auth Service
    participant P as Auth PostgreSQL
    participant N as Nutrition Service
    participant NP as Nutrition PostgreSQL

    W->>G: POST /api/v1/auth/login
    G->>A: Forward request and request ID
    A->>P: Verify password and persist refresh digest
    P-->>A: Account and session
    A-->>G: Access JWT and HttpOnly refresh cookie
    G-->>W: Forward response
    W->>G: POST /api/v1/nutrition/logs with bearer JWT
    G->>G: Verify HS256 token and assign request ID
    G->>N: Forward bearer token
    N->>N: Verify token; scope records by subject
    N->>NP: Transactionally snapshot food nutrients
    NP-->>N: Committed meal log
    N-->>G: API response
    G-->>W: API response and request ID
```
