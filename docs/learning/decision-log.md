# Learning decision log

| Decision                                           | Why                                                                                     | Revisit when                                                      |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| PostgreSQL owns Auth accounts and refresh sessions | Relational uniqueness, foreign keys, and refresh transactions                           | Auth schema or retention requirements change                      |
| MongoDB owns exercises and bounded plans           | Exercise catalogue plus embedded plan-day/set aggregate                                 | Plan size, reporting, or transactional requirements change        |
| External user ID is stored as `ownerId`            | Preserves service data ownership and avoids cross-database joins                        | User deletion/eventual consistency policy is designed             |
| Refresh tokens rotate and are stored as digests    | Reuse detection without persisting bearer secrets in plaintext                          | Key/session revocation requirements change                        |
| Gateway rate limits use Redis fixed windows        | Atomic increments share a quota across replicas and fail closed if Redis is unavailable | A dedicated edge policy replaces application limits               |
| BullMQ refreshes workout insights asynchronously   | Session completion stays responsive while owner-scoped derived insights are refreshed   | A transactional outbox is needed for stronger delivery guarantees |
