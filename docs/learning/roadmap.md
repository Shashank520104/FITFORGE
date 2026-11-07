# Learning roadmap

1. **Auth and request routing (implemented, database integration still environment-dependent):** understand Express middleware, JWT signing/verification, password hashing, PostgreSQL transactions, refresh-token rotation, and proxy timeouts.
2. **Workout API (implemented with MongoDB integration test gated):** understand Mongoose schemas/indexes, embedded aggregates, ObjectId references, pagination, validation, and resource ownership.
3. **Local operations (implemented and locally validated):** understand image layers, container health checks, migration ordering, persistent volumes, configurable loopback ports, and service networking.
4. **Profile and relational nutrition (implemented):** learn SQL constraints, migrations, reporting, and cross-service API contracts.
5. **Progress analytics (logged workout trends implemented):** compare actual completed-set volume in Workout; continue exploring time-series and read-model strategies using real API data.
6. **Redis and BullMQ (implemented for shared limits, caches, and insight refresh jobs):** explore TTL/invalidation policies, worker retries, idempotency, and transactional outbox delivery guarantees.
7. **AI/RAG:** add permitted source data, embeddings, retrieval, grounded outputs, and fixed evaluations only after the domain APIs exist.
8. **Frontend and delivery (core flows and motion implemented):** build user journeys against actual APIs, keep visualizations accessible and respect reduced-motion preferences, then add deployment documentation.

For each completed phase, be able to explain its code path and failure modes without relying on generated notes.
