# Service map

| Service             | Owns                                            | Current API/runtime                                                                      |
| ------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| API Gateway         | Request routing and cross-cutting HTTP concerns | Express, Redis rate limiting, Swagger UI, request IDs, proxy timeout, HS256 verification |
| Auth Service        | Accounts and refresh sessions                   | Express, bcrypt, JWT, PostgreSQL, versioned SQL migration                                |
| Workout Service     | Exercise catalogue and workout plans            | Express, MongoDB/Mongoose, Redis cache, BullMQ insights producer, owner-scoped APIs      |
| Workout Jobs Worker | Asynchronous workout insights                   | BullMQ worker, Redis queue/cache, owner-scoped MongoDB queries                           |
| Redis               | Shared ephemeral data                           | Atomic gateway rate windows, expiring workout caches, BullMQ queue                       |
| Nutrition Service   | User-owned custom foods and meal logs           | Express, own PostgreSQL DB/role, source labels and immutable log snapshots               |
| Progress Service    | Body measurements and strength records          | Express, own PostgreSQL DB/role, owner-scoped logs and personal-record summaries         |
| Profile Service     | Private user preferences                        | Express, own PostgreSQL DB/role, owner-scoped preference reads and partial updates       |
| Web App             | Browser UI                                      | React/Vite, Nginx, API Gateway proxy, D3 progress charts                                 |
| AI Service          | Nothing yet                                     | Planned; no simulated answers or unsupported source data                                 |

The API Gateway verifies tokens before protected domain routes. Domain services re-verify bearer tokens and scope records to their subject. Services never query another service's private database.
