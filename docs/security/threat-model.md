# Security threat model (current implementation)

## Assets

- Account email and bcrypt password hash in the Auth-owned PostgreSQL database.
- Hashed refresh sessions and the raw refresh token held by the client cookie.
- Access-token signing secret and short-lived bearer tokens.
- Private workout plan documents and their owner identifiers.

## Trust boundaries and controls

- The browser/client-to-Gateway boundary is the only published application entry point in Compose.
- Gateway and Workout verify HS256 access tokens; plan queries include the verified JWT subject.
- Refresh cookies are HttpOnly, SameSite=Strict, scoped to `/api/v1/auth`, and can be Secure in HTTPS deployments.
- Passwords are bcrypt-hashed and never returned. SQL values are parameterized.
- Request body sizes are capped; query and body values are schema-validated. Internal errors do not expose stack traces or database messages.
- Request logs omit credentials, cookies, and query values.
- Gateway rate limits use atomic Redis fixed-window counters shared across Gateway replicas. A Redis outage fails closed for API routes instead of bypassing the limit.
- Cached insights are keyed by verified user ID; insight-job status checks also verify that the job belongs to the requesting user.

## Residual risks / not yet implemented

- JWT signing uses one shared symmetric secret. No key rotation or asymmetric key separation is configured.
- Access JWTs remain usable until expiry after logout; there is no access-token denylist.
- Auth has no additional account-level credential-stuffing throttle. Redis-backed IP limits are not a substitute for a dedicated authentication abuse policy.
- Local Redis has no authentication or TLS, is internal to the Compose network, and is for development only.
- Email verification, account recovery, MFA, and audit events are absent.
- Local MongoDB Compose has no authentication; it is bound to loopback and intended for development only.
- There is no deployment TLS termination, secret manager, backup/restore proof, or external security review.

## Abuse cases to test before deployment

Credential stuffing and registration abuse; refresh-token replay; signing-secret compromise; direct access to internal service ports; malformed/oversized JSON; cross-account plan IDs; database outages; and log leakage. Do not deploy the local configuration as production security.
