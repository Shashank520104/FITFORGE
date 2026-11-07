# Interview questions for the current implementation

1. Why use both an API Gateway and service-level token verification?
2. What does storing only the refresh-token digest protect against, and what does it not protect against?
3. How does a transaction make refresh rotation single-use under concurrent requests?
4. Why is a refresh token in an HttpOnly cookie while the access token is returned in the response body?
5. How does the Workout Service prevent insecure direct object references?
6. When is embedding days and sets in a MongoDB plan appropriate, and what bounds keep the aggregate manageable?
7. Why does the Gateway avoid retrying writes after a timeout?
8. What breaks about the in-memory rate limiter when the gateway scales horizontally?
9. How do readiness and liveness differ when PostgreSQL is unavailable?
10. What indexes support the current queries, and how would you verify whether the muscle substring filter uses one?
11. Which additional controls would be required before deploying Auth publicly?
12. Why is the existing monolithic backend not deleted as part of this incremental migration?

## Defensible summary

“I extracted authentication and workout ownership into independent Express services. Auth persists password hashes and refresh-token digests in PostgreSQL; Workout owns exercise and plan documents in MongoDB. A gateway routes requests and verifies short-lived JWTs, while the Workout Service independently verifies them and scopes plan operations by subject. The deployment and database integration still need to be run and verified in an environment with Docker and test databases.”
