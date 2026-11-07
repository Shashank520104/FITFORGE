# FITFORGE Auth Service

The Auth Service owns account credentials and refresh sessions in PostgreSQL. Access tokens are signed JWTs; refresh tokens are random opaque values stored only as SHA-256 hashes and delivered in an HttpOnly, SameSite=Strict cookie. Passwords are hashed with bcrypt. The service exposes registration, login, refresh rotation, logout, and current-account endpoints.

## Configuration

Create a local `.env` file in this directory:

```env
PORT=3002
DATABASE_URL=postgres://fitforge:replace-with-a-local-secret@localhost:5432/fitforge_auth
JWT_SECRET=replace-with-at-least-32-random-characters
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_DAYS=30
COOKIE_SECURE=false
```

Use a unique secret of at least 32 characters; set `COOKIE_SECURE=true` when served over HTTPS. If `COOKIE_SECURE` is omitted, it defaults to true when `NODE_ENV=production` and false otherwise. Never use the example values in a deployed environment or commit `.env`.

## Local operation

From this directory:

```powershell
npm install
npm run migrate
npm run build
npm start
```

`npm run migrate` applies versioned SQL transactionally and safely skips an already-applied migration. The service verifies PostgreSQL before listening. `GET /health` is liveness; `GET /ready` checks the database. SIGINT/SIGTERM shut down the HTTP server and connection pool.

## API

| Method | Path                    | Behavior                                                    |
| ------ | ----------------------- | ----------------------------------------------------------- |
| `GET`  | `/health`               | Liveness                                                    |
| `GET`  | `/ready`                | PostgreSQL readiness                                        |
| `POST` | `/api/v1/auth/register` | Create account; returns access token and refresh cookie     |
| `POST` | `/api/v1/auth/login`    | Verify credentials; returns access token and refresh cookie |
| `POST` | `/api/v1/auth/refresh`  | Rotate refresh cookie and issue a new access token          |
| `POST` | `/api/v1/auth/logout`   | Revoke the refresh session and clear its cookie             |
| `GET`  | `/api/v1/auth/me`       | Return the account associated with a valid access token     |

Passwords must be at least 12 characters and no more than 72 UTF-8 bytes (bcrypt's supported maximum). Account lookup errors do not distinguish an unknown email from a wrong password. Refresh-token reuse is rejected after rotation. Access tokens are short-lived and are not individually revocable; logging out revokes the refresh session, while an already issued access token remains valid until expiration.

This service does not yet implement distributed login rate limiting, account recovery, email verification, or production key rotation. Do not expose it as a production identity provider until those controls and a security review are complete.

## Tests

```powershell
npm test
```

Unit/API tests run without PostgreSQL. The complete auth-flow integration test is skipped unless `AUTH_TEST_DATABASE_URL` points to a migrated, isolated database whose name includes `test`:

```powershell
$env:AUTH_TEST_DATABASE_URL = "postgres://fitforge:local-secret@localhost:5432/fitforge_auth_test"
npm run migrate
npm test
Remove-Item Env:AUTH_TEST_DATABASE_URL
```

The test exercises registration, duplicate registration, login, token verification, refresh rotation/reuse rejection, and logout, then removes its test user. Do not point it at shared or production data.
