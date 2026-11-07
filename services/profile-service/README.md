# FITFORGE Profile Service

The Profile Service stores private user preferences in its own PostgreSQL database. It does not duplicate account credentials or email addresses owned by Auth. Profile rows are keyed by the verified Auth JWT subject and are created with safe defaults when first read.

## Run

Requires PostgreSQL and Node.js 22+.

```powershell
npm ci
$env:DATABASE_URL = "postgres://localhost:5432/fitforge_profile"
$env:JWT_SECRET = "replace-with-at-least-32-random-characters"
npm run migrate
npm run dev
```

Health endpoints are `/health` and `/ready`. API requests require an Auth Service HS256 bearer token.

## API

- `GET /api/v1/profile`: get or initialize the authenticated user's profile.
- `PATCH /api/v1/profile`: update explicitly provided preferences. Omitted values are preserved; `displayName` and `trainingGoal` may be cleared with `null`.

Supported preferences include metric/imperial units, training goal, experience level, available equipment labels, and dietary preference labels. Dietary labels are not allergy verification or medical advice, and equipment labels are not safety assessments. Records are owner-scoped and held separately from Auth and other domain databases.

## Tests

`npm test` runs database-independent authentication and validation tests. Set `PROFILE_TEST_DATABASE_URL` to an isolated database whose name contains `test` and apply the migration to run the database integration test. The test runner refuses other database names.
