# Service communication

The current stack uses synchronous HTTP inside the Compose network. The Gateway forwards authentication, exercise, plan, and nutrition requests to their owner services. Protected requests carry the signed bearer token to the domain service, which verifies it independently. Services do not query another service's private database.

The gateway generates one UUID request ID per request, sends it upstream as `x-request-id`, and returns it to the client. Gateway logs include method, route path (not query values), status, elapsed time, and request ID. Authorization and cookie headers are forwarded only to their intended service and are not logged.

Proxy requests have a configurable timeout. A timeout returns `504`; connection failures return `503`; the gateway does not retry state-changing requests. Auth refresh tokens use database-backed rotation to reject replay. Workout plan writes are owner-scoped but do not yet accept an idempotency key.

No message broker or background queue exists yet. Add one only when a concrete asynchronous workload is implemented.
