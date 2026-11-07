# FITFORGE Progress Service

The Progress Service stores owner-scoped body measurements, user-entered strength records, daily activities, and sleep logs. It calculates a weight-based personal record when a new strength log is submitted; it does not estimate one-repetition maximums or infer missing training history. Activity and sleep records are manually entered, not automatically detected by the website.

## Run

Requires PostgreSQL and Node.js 22+.

```powershell
npm ci
$env:DATABASE_URL = "postgres://progress_owner:password@localhost:5432/fitforge_progress"
$env:JWT_SECRET = "replace-with-at-least-32-random-characters"
npm run migrate
npm run dev
```

Health endpoints are `/health` and `/ready`. API requests are mounted under `/api/v1/progress` and require an Auth Service HS256 bearer token.

## API

- `POST /api/v1/progress/measurements`: create or replace a user's measurement for a date.
- `GET /api/v1/progress/measurements`: paginated measurements, optionally filtered by `from` and `to` dates.
- `POST /api/v1/progress/strength-records`: record exercise name, date, load in kg, and repetitions; returns whether it is a new max-load personal record.
- `GET /api/v1/progress/strength-records`: paginated history, optionally filtered by exercise name.
- `GET /api/v1/progress/summary`: recent measurements and max-load records for the authenticated user.
- `POST /api/v1/activity/activities`: log a date, start time, activity type, duration, and optional distance and note.
- `POST /api/v1/activity/sleep`: log bedtime and wake-up time for the date the user woke; duration is calculated across midnight.
- `GET /api/v1/activity?date=YYYY-MM-DD`: read that day's activities, sleep records, and total minutes.
- `GET /api/v1/activity/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`: read daily activity, distance, and sleep totals for up to 31 days.
- `DELETE /api/v1/activity/activities/:id` and `DELETE /api/v1/activity/sleep/:id`: delete an owned record.

All queries are owner-filtered. Numeric values are returned using PostgreSQL's JSON serialization for `NUMERIC` columns. Activity and sleep data is stored as manual user input; it is not medical or wearable data.

## Tests

`npm test` runs database-independent HTTP validation tests. Set `PROGRESS_TEST_DATABASE_URL` to an isolated database with the migration applied to run the database-backed ownership and record tests. The test runner refuses database names that do not contain `test`.
