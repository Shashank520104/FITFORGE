# FITFORGE Workout Service

This independently runnable Express and TypeScript service owns the exercise catalogue, workout plans, and workout sessions in MongoDB. It seeds a small starter set of movements idempotently on startup, exposes public exercise discovery, and provides authenticated owner-scoped plan management and session tracking.

## Configuration

Create a local `.env` file in this directory (it is ignored by Git):

```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/fitforge_workout
REDIS_URL=redis://localhost:6379
JWT_SECRET=the-same-random-secret-used-by-the-auth-service
```

`MONGODB_URI` must point to a database this service owns. `REDIS_URL` is used for short-lived cache entries and the BullMQ insights queue. `JWT_SECRET` must be at least 32 characters and match the Auth Service and API Gateway secret. The service does not log connection strings. Startup fails explicitly when configuration is missing, MongoDB or Redis cannot be reached, or `PORT` is invalid.

## Run

From this directory:

```powershell
npm install
npm run build
npm start
```

Run the asynchronous insights processor in a second terminal:

```powershell
npm run start:worker
```

For development with automatic TypeScript reload:

```powershell
npm run dev
```

The API connects to MongoDB and Redis before listening. `GET /health` is a liveness endpoint; `GET /ready` returns `503` until MongoDB is connected. Redis cache health is reported as a dependency; cache read/write failures are logged and fall back to MongoDB. `SIGINT` and `SIGTERM` close the HTTP server and connections. The separate BullMQ worker consumes the `workout-insights` queue and refreshes owner-scoped insight cache entries.

On startup, eight generic starter exercises are inserted only when their names do not already exist. Existing catalogue records are not overwritten.

## API

Exercise catalogue endpoints are read-only and public. Workout-plan and workout-session endpoints require a valid Auth Service access token and enforce ownership using the token subject; the service validates tokens itself rather than trusting identity headers from the gateway.

| Method   | Path                                            | Behavior                                                                     |
| -------- | ----------------------------------------------- | ---------------------------------------------------------------------------- |
| `GET`    | `/health`                                       | Liveness                                                                     |
| `GET`    | `/ready`                                        | MongoDB readiness                                                            |
| `GET`    | `/api/v1/exercises`                             | Alphabetical list, optionally filtered by `muscle` and `difficulty`          |
| `GET`    | `/api/v1/exercises/:id`                         | Exercise detail by MongoDB ObjectId                                          |
| `GET`    | `/api/v1/workout-plans`                         | List the authenticated user's plans; supports `page` and `limit`             |
| `POST`   | `/api/v1/workout-plans`                         | Create a validated plan referencing existing exercises                       |
| `GET`    | `/api/v1/workout-plans/:id`                     | Read an owned plan with exercise details                                     |
| `PATCH`  | `/api/v1/workout-plans/:id`                     | Update owned plan fields                                                     |
| `DELETE` | `/api/v1/workout-plans/:id`                     | Delete an owned plan                                                         |
| `GET`    | `/api/v1/workout-sessions`                      | List session history and the current active session                          |
| `GET`    | `/api/v1/workout-sessions/insights`             | Compare logged exercise volume across completed sessions                     |
| `GET`    | `/api/v1/workout-sessions/insights/jobs/:jobId` | Read the status of an owner-scoped insight refresh job                       |
| `POST`   | `/api/v1/workout-sessions`                      | Start a session from an owned plan day                                       |
| `PATCH`  | `/api/v1/workout-sessions/:id/sets`             | Record actual reps/load for a planned set                                    |
| `POST`   | `/api/v1/workout-sessions/:id/finish`           | Finish a session and enqueue an insight refresh; incomplete sets are allowed |
| `POST`   | `/api/v1/workout-sessions/:id/abandon`          | Abandon a session while preserving recorded sets                             |

List parameters: `muscle` (case-insensitive substring), `difficulty` (`beginner`, `intermediate`, or `advanced`), `page` (integer from `1` to `1,000,000`, default `1`), and `limit` (positive integer, default `20`, maximum `100`). Invalid query values and malformed IDs return `400`; a valid but missing ID returns `404`. Unexpected failures use a consistent error envelope and do not return internal error details.

Workout plans are bounded MongoDB aggregates containing up to seven unique workout days, twelve exercises per day, and ten sets per exercise. Plans store the external Auth Service user ID as an owner key, not as a cross-service MongoDB reference. Requests that reference missing exercises return `422`; accessing another user's plan returns the same `404` as a missing plan.

Sessions snapshot the selected plan day, exercise names, and planned set values at start, so later plan edits or deletion do not rewrite workout history. A MongoDB partial unique index permits at most one active session per user. Set logging records actual reps, load, and completion time; repeated set logging and updates to closed sessions are rejected. History and active-session lookup are owner-scoped.

The insights endpoint analyzes at most the 100 most recent completed sessions
for the authenticated user. Per-exercise comparisons use the two most recent
sessions with completed sets and compare logged load × repetitions volume,
alongside the latest top set. It reports new, up, steady, or down trends and
does not prescribe training changes or infer missing sets.
Finishing a session returns the background analytics job ID when it is
successfully queued. Poll the job status route to read its state and whether
the refresh updated the cache. The
insights endpoint remains available during processing and computes from MongoDB
on a cache miss.
Insight refreshes use a Redis generation check so a job that started before a
new workout cannot replace the newer cache entry. The job result reports
whether it updated the cache; read the insights endpoint for the current data.

## Tests

Run the unit/API validation tests without MongoDB:

```powershell
npm test
```

The live MongoDB API integration test is skipped unless `WORKOUT_TEST_MONGODB_URI` is set. Configure it explicitly to point to an isolated database whose name includes `test`, for example:

```powershell
$env:WORKOUT_TEST_MONGODB_URI = "mongodb://localhost:27017/fitforge_workout_test"
npm test
Remove-Item Env:WORKOUT_TEST_MONGODB_URI
```

The integration test inserts uniquely named fixtures, checks readiness, exercise filtering/detail behavior, plan CRUD, session start/set logging/finish/history, and owner isolation, then removes its fixtures. Never point this setting at a production or shared database.

Redis cache integration tests run when `WORKOUT_TEST_REDIS_URL` is set. Use an
isolated test Redis instance; the test uses unique keys and removes them after
checking read/write/invalidation.
