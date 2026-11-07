# Project progress

## Completed code in the current repository

- Independent Auth Service: account registration/login, short-lived HS256 JWTs, hashed refresh sessions, rotation/logout, readiness, and SQL migration.
- API Gateway: service routing, request IDs, structured access logs, readiness, bounded proxy timeout/body size, Redis-backed shared rate limits, interactive Swagger UI, and JWT verification on protected routes.
- Workout Service: exercise list/detail, authenticated owner-scoped workout-plan CRUD, and workout execution/history with set logging.
- Workout progression insights: owner-scoped comparison of actual logged exercise volume across the two most recent completed sessions, capped to 100 sessions analyzed.
- Redis exercise/insight caching and BullMQ background insight refresh after workout completion, with owner-checked job status reads.
- Nutrition Service: source-labelled user foods, owner-scoped meal logs, transactional nutrient snapshots and date totals.
- Progress Service: owner-scoped body measurements and strength records, max-load personal-record detection, and recent summary endpoints.
- Profile Service: separate owner-scoped preferences for display name, units, training goals, experience, equipment, and dietary labels.
- Web App: responsive sign-in/register, plan management, exercise discovery, workout execution/history, sourced nutrition logging, progress forms/charts, profile preferences, and an explicit unavailable state for unfinished AI.
- Dockerfiles and Compose configuration for Auth, Gateway, Workout, Nutrition, Progress, Profile, Web App, PostgreSQL, MongoDB, Redis, and a BullMQ worker.
- Unit/API tests and OpenAPI documents for the implemented services.

## Verification status

- All service and frontend TypeScript/production builds pass.
- Workout sessions snapshot plan days, record actual sets, and support completion, abandonment, and owner-scoped history.
- Nutrition and Progress TypeScript builds and database-independent tests pass.
- Frontend production build, lint, formatting, and browser validation pass; five non-blocking React effect lint warnings remain.
- Unit/API and isolated PostgreSQL/MongoDB integration tests pass.
- Docker Compose configuration, image builds, service startup/migrations, gateway readiness, and browser-backed product flows have been verified locally.
- PostgreSQL uses a configurable loopback host port; this development machine used `15432` because its default `5432` binding was unavailable.

## Not started

Curated/licensed food data, provider-backed AI/RAG/Qdrant, Prometheus/Grafana, and production deployment remain outstanding.
