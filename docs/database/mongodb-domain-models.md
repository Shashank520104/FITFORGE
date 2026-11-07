# MongoDB domain models

Workout Service owns the `fitforge_workout` database. Collections are created by Mongoose as the corresponding models are used.

## `exercises`

Each exercise document has a required trimmed name, one or more muscle groups, equipment labels, a difficulty enum, a movement-type enum, a description, and optional media URLs. Mongoose timestamps are enabled. Indexes cover `difficulty` and `muscleGroups`.

## `workoutplans`

Each plan document has an external `ownerId` taken from the verified Auth JWT subject, a name, a goal enum, and bounded embedded days. A day embeds planned exercises and their sets; each planned exercise references an `Exercise` ObjectId. No Auth collection or other service's database is referenced.

Limits at request validation: 7 days, 12 planned exercises per day, 10 sets per exercise, 100 repetitions, 500 kg per set, and 3600 rest seconds. The plan index `{ ownerId, updatedAt: -1 }` supports owner-scoped, most-recently-updated lists.

## `workoutsessions`

Each session stores its external owner ID, source plan ID, and snapshots of the selected day, exercise names, and planned set values. Per-set actual reps/load and completion timestamps are recorded independently; session status is `active`, `completed`, or `abandoned`. `{ ownerId, startedAt: -1 }` supports history pagination. A partial unique `{ ownerId, status }` index for `status: "active"` limits each user to one active session. Sessions remain intact if the originating plan changes or is deleted.

## Evolution

Mongoose schema validation applies on document creation and updates. API validation is performed before persistence. Add versioned migration scripts or controlled data backfills before any incompatible document shape change; no automated migration framework for MongoDB is currently present.
