# FITFORGE API Gateway

The API Gateway is the public HTTP entry point for the implemented services. It assigns request IDs, emits structured request logs, enforces a Redis-backed shared rate limit, validates bearer access tokens on protected routes, serves interactive Swagger UI, and proxies requests with bounded timeouts.

## Configuration

```env
PORT=3000
AUTH_SERVICE_URL=http://localhost:3002
WORKOUT_SERVICE_URL=http://localhost:3001
NUTRITION_SERVICE_URL=http://localhost:3004
PROGRESS_SERVICE_URL=http://localhost:3005
PROFILE_SERVICE_URL=http://localhost:3006
PERSONALIZATION_SERVICE_URL=http://localhost:3007
REDIS_URL=redis://localhost:6379
JWT_SECRET=the-same-random-secret-used-by-the-auth-service
UPSTREAM_TIMEOUT_MS=5000
RATE_LIMIT_MAX=120
RATE_LIMIT_WINDOW_MS=60000
```

The JWT secret must be at least 32 characters and must match the Auth Service secret. Redis is required for shared rate limiting; if it is unavailable the gateway rejects API requests with `503` rather than silently reverting to per-process limits. Internal services and Redis should not be exposed publicly; in the local Compose setup, publish only the gateway port.

## Routes

| Route prefix                             | Authentication      | Upstream          |
| ---------------------------------------- | ------------------- | ----------------- |
| `/api/v1/auth/*`                         | Auth Service policy | Auth Service      |
| `/api/v1/exercises/*`                    | Public catalogue    | Workout Service   |
| `/api/v1/workout-plans/*`                | Bearer token        | Workout Service   |
| `/api/v1/workout-sessions/*`             | Bearer token        | Workout Service   |
| `/api/v1/foods/*`, `/api/v1/nutrition/*` | Bearer token        | Nutrition Service |
| `/api/v1/progress/*`                     | Bearer token        | Progress Service  |
| `/api/v1/profile/*`                      | Bearer token        | Profile Service   |

`POST /api/v1/coach/chat` and `POST /api/v1/coach/stream` forward authenticated questions to the Nutrition Service's local Ollama model. The streaming route forwards server-sent events without buffering so answers appear as they are generated. The coach provides general fitness and healthy-habit education, not medical advice. Only the question and recent conversation supplied by the browser are sent; profile, meal, and workout records are not attached.

The Personalization Service provides owner-scoped encrypted medical report storage, user-requested non-diagnostic summaries, and general seven-day meal and exercise ideas. Report contents are never used to generate plans. Uploading a report revokes workout confirmation; workouts remain hidden until the user explicitly confirms clinician clearance. Reports are forwarded as raw PDF/JPEG/PNG bytes with an 8 MB upload limit.

`GET /health` reports gateway liveness. `GET /ready` checks Redis and every upstream service. `/openapi.yaml` serves the gateway API contract; `/docs/` serves interactive Swagger UI. Each request receives a generated `x-request-id`, forwarded to the selected upstream and included in structured logs. The proxy forwards a limited set of headers; regular request bodies are capped at 1 MiB and report uploads at 8 MiB.

The rate limit uses atomic Redis fixed-window counters shared by Gateway replicas. Auth has no additional account-level credential-stuffing throttle.

## Run and test

```powershell
npm ci
npm run build
npm test
npm start
```

Do not treat the local configuration as production-ready; use TLS, managed Redis, observability, and an external security review before deployment.
