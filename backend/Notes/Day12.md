# FITFORGE — Day 12

## Workout Domain Architecture & Implementation

---

## 1. Day 12 Goal

Design and implement the core workout domain of FITFORGE.

The main goal was to understand:

* How a User relates to WorkoutPlan
* When to embed data in MongoDB
* When to use references
* How to design reusable Exercise entities
* How to structure Workout Days
* How to structure planned sets
* Difference between WorkoutPlan and WorkoutSession
* Mongoose references and `populate()`

---

# 2. Core Workout Architecture

```text
User
 │
 │ userId reference
 ▼
WorkoutPlan
 │
 ├── name
 ├── goal
 │
 └── days[]
      │
      ├── day
      ├── name
      │
      └── exercises[]
           │
           ├── exerciseId reference
           │
           └── sets[]
                ├── reps
                ├── weight
                └── restSeconds
```

The central Exercise entity is stored separately:

```text
Exercise
├── name
├── muscleGroups[]
├── equipment[]
├── difficulty
├── movementType
├── description
├── videoUrl
└── imageUrls[]
```

---

# 3. WorkoutPlan vs WorkoutSession

## WorkoutPlan

Represents what the user **intends to do**.

Example:

```text
Push Day
├── Bench Press
│   ├── 60kg × 8
│   ├── 60kg × 8
│   └── 65kg × 6
└── ...
```

## WorkoutSession

Represents what the user **actually performed** on a particular date.

Example:

```text
Push Day - 5 Oct 2026

Bench Press
├── 60kg × 8
├── 60kg × 7
└── 65kg × 5
```

### Why separate them?

A workout plan should remain the intended program, while sessions record actual performance.

This allows FITFORGE to calculate:

* adherence
* performance history
* progressive overload
* PRs
* workout consistency
* transformation progress

### Interview Answer

> “A workout plan represents what the user intends to do, while a workout session represents what the user actually performed. Separating them allows us to track adherence, performance, history and progressive overload without modifying the original plan.”

---

# 4. User → WorkoutPlan Relationship

We decided to keep WorkoutPlan as a separate collection.

```text
User
 │
 └── userId
       ↓
WorkoutPlan
```

## Why not embed WorkoutPlan inside User?

A user can have:

* multiple workout plans
* old plans
* future plans
* different goals
* different training programs

Therefore, keeping WorkoutPlan separate provides:

* independent querying
* independent updates
* better scalability
* easier lifecycle management

### Interview Answer

> “A user can have multiple and potentially large workout plans with different purposes, so I keep WorkoutPlan as a separate collection and reference the user using userId.”

---

# 5. Embedding WorkoutDays

Workout Days are embedded inside WorkoutPlan.

```text
WorkoutPlan
 └── days[]
      ├── Day 1
      ├── Day 2
      └── Day 3
```

Example:

```json
{
  "day": 1,
  "name": "Chest + Triceps",
  "exercises": []
}
```

## Why embed?

WorkoutDays:

* strongly belong to a WorkoutPlan
* are normally accessed with the plan
* are not independently shared between users
* have a bounded/controlled size

### General MongoDB Rule

Use **embedding** when:

* data has a strong ownership relationship
* data is usually accessed together
* data size is reasonably bounded

Use **references** when:

* data is large
* data is independently queried/updated
* data is reusable/shared
* separate lifecycle is required

### Interview Answer

> “I embed WorkoutDays because they have a strong ownership relationship with WorkoutPlan and are usually fetched together. This avoids unnecessary separate queries while keeping the document manageable.”

---

# 6. Exercise as a Separate Collection

Exercise is a reusable entity.

Examples:

```text
Bench Press
Squat
Deadlift
Lat Pulldown
Hammer Curl
```

WorkoutPlan stores:

```json
{
  "exerciseId": "..."
}
```

instead of copying the entire Exercise document.

## Why?

The same exercise can be used in many workout plans.

For example:

```text
Push Day Plan
      │
      └── Bench Press ──┐
                        │
PPL Plan                │
      │                 │
      └── Bench Press ──┤
                        ↓
                  Exercise Collection
                    Bench Press
```

This prevents data duplication.

### Interview Answer

> “Exercises are reusable entities shared across many workout plans, so I store them separately and reference them using exerciseId. This avoids duplication and allows centralized updates.”

---

# 7. Exercise Schema

Current Exercise structure:

```text
Exercise
├── name
├── muscleGroups[]
├── equipment[]
├── difficulty
├── movementType
├── description
├── videoUrl
└── imageUrls[]
```

---

# 8. `name`

Stores the exercise name.

Example:

```json
"name": "Bench Press"
```

Properties:

* String
* required
* trim

---

# 9. `muscleGroups[]`

Stored as an array.

Example:

```json
"muscleGroups": [
  "chest",
  "triceps",
  "shoulders"
]
```

## Why array?

One exercise can target multiple muscle groups.

For example:

Bench Press:

```text
Chest
Triceps
Shoulders
```

A single string would not accurately represent this relationship.

It also makes muscle-based filtering easier.

### Interview Answer

> “I use an array because a single exercise can target multiple muscle groups. It also makes filtering and recommendation based on individual muscle groups easier.”

---

# 10. `equipment[]`

Stored as an array.

Example:

```json
"equipment": [
  "barbell",
  "bench"
]
```

Another example:

```json
"equipment": [
  "cable_machine",
  "handles"
]
```

## Why array?

An exercise can require multiple pieces of equipment.

This is especially useful for FITFORGE because users may specify the equipment available to them.

Example:

```text
User equipment:
Dumbbells + Bench
```

FITFORGE can later recommend compatible exercises.

### Interview Answer

> “I use an array because an exercise can require multiple pieces of equipment. This also allows FITFORGE to filter exercises based on the equipment available to the user.”

---

# 11. `difficulty`

Difficulty is stored as a controlled enum:

```typescript
enum: [
  "beginner",
  "intermediate",
  "advanced"
]
```

Example:

```json
"difficulty": "intermediate"
```

## Why enum?

Without an enum, inconsistent values could appear:

```text
beginner
Beginner
beg
easy
newbie
```

An enum maintains consistent data.

### Interview Answer

> “I use an enum because difficulty has a fixed set of valid values. This prevents inconsistent or invalid data from entering the database.”

---

# 12. `movementType`

Movement type is stored as a single String.

Examples:

```text
Bench Press → push
Lat Pulldown → pull
Squat → squat
Deadlift → hinge
Farmer's Walk → carry
```

Example:

```json
"movementType": "push"
```

Current enum:

```typescript
enum: [
  "push",
  "pull",
  "squat",
  "hinge",
  "carry"
]
```

## Why String instead of Array?

We are storing the **primary movement pattern** of the exercise.

### Interview Answer

> “I use a single movementType because we are interested in the primary movement pattern of the exercise, such as push, pull, squat or hinge.”

---

# 13. `description`

Description is a normal String.

Example:

```json
"description": "A compound upper-body pressing exercise."
```

It stores textual information about the exercise.

Future media should not be placed directly inside description.

Instead, we can use:

```text
videoUrl
imageUrls[]
```

Later these can point to media stored through AWS services such as S3/CloudFront.

### Interview Answer

> “Description remains a String because it represents textual information. Media is kept separately through URLs so the schema remains clean and can support future cloud-storage integration.”

---

# 14. Planned Exercise Structure

Inside WorkoutPlan:

```text
Planned Exercise
├── exerciseId
└── sets[]
```

Example:

```json
{
  "exerciseId": "...",
  "sets": [
    {
      "reps": 8,
      "weight": 60,
      "restSeconds": 150
    }
  ]
}
```

---

# 15. Why is `sets` an Array?

We decided to store each set as an object.

Example:

```json
"sets": [
  {
    "reps": 8,
    "weight": 60,
    "restSeconds": 150
  },
  {
    "reps": 8,
    "weight": 60,
    "restSeconds": 150
  },
  {
    "reps": 6,
    "weight": 65,
    "restSeconds": 180
  }
]
```

## Why not just:

```json
"sets": 3
```

Because different sets can have different:

* reps
* weight
* rest

This allows FITFORGE to represent realistic training programs.

---

# 16. `reps`

Required Number.

Example:

```json
"reps": 8
```

Each planned set can have its own repetition target.

---

# 17. `weight`

Weight is optional.

Example:

```json
"weight": 60
```

For bodyweight exercises:

```json
"weight": null
```

Example:

```text
Beginner Pull-up
→ Bodyweight only

Advanced Pull-up
→ Bodyweight + additional external weight
```

## Why optional?

Not every exercise requires external weight.

### Important

FITFORGE currently uses **kg as the standard weight unit**.

We do not need to store:

```json
"unit": "kg"
```

inside every set.

### Interview Answer

> “Weight is optional because some exercises are performed using bodyweight without external load. FITFORGE currently standardizes weight values in kilograms.”

---

# 18. `restSeconds`

Rest is stored at the **set level**.

Example:

```json
{
  "reps": 8,
  "weight": 60,
  "restSeconds": 150
}
```

## Why?

Rest requirements can differ based on the training prescription.

For example:

```text
Heavy compound movement
→ longer rest

Isolation / hypertrophy work
→ comparatively shorter rest
```

Different sets can therefore have different rest periods.

### Interview Answer

> “I keep rest at the set level because rest requirements can vary depending on the training prescription, load and repetition target. This gives the workout model more flexibility.”

---

# 19. Weight Unit

FITFORGE currently targets Indian users primarily.

Therefore:

```text
Weight = kilograms (kg)
```

No unit field is required for every set.

If FITFORGE expands internationally later, unit conversion can be handled at the application/API layer.

---

# 20. WorkoutPlan Model

Conceptual structure:

```text
WorkoutPlan
├── userId
├── name
├── goal
└── days[]
    ├── day
    ├── name
    └── exercises[]
        ├── exerciseId
        └── sets[]
            ├── reps
            ├── weight
            └── restSeconds
```

---

# 21. Mongoose References

WorkoutPlan references User:

```typescript
userId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  required: true
}
```

Planned exercises reference Exercise:

```typescript
exerciseId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Exercise",
  required: true
}
```

These references prevent duplication.

---

# 22. Mongoose `populate()`

Initially the WorkoutPlan stores:

```json
"exerciseId": "6ac38a5255758c7691632ac9"
```

Using:

```typescript
.populate("days.exercises.exerciseId")
```

Mongoose resolves the reference and returns the actual Exercise document.

Instead of:

```json
"exerciseId": "6ac38a5255758c7691632ac9"
```

we get:

```json
"exerciseId": {
  "_id": "6ac38a5255758c7691632ac9",
  "name": "Bench Press",
  "muscleGroups": [
    "chest",
    "triceps",
    "shoulders"
  ],
  "equipment": [
    "barbell",
    "bench"
  ]
}
```

### Important

`populate()` is a Mongoose feature that resolves references for application-level retrieval.

It does not mean the complete Exercise document is physically embedded inside WorkoutPlan.

---

# 23. Why Reference + Populate?

Without references:

```text
WorkoutPlan
 └── complete Exercise data
```

The same Exercise could be duplicated across hundreds of plans.

With references:

```text
WorkoutPlan
 └── exerciseId
        ↓
Exercise Collection
```

The Exercise document exists once and can be reused.

When detailed information is needed:

```typescript
populate()
```

resolves the reference.

---

# 24. MongoDB Embedding vs Referencing — Quick Revision

## Embed when:

```text
Strong ownership
+
Usually accessed together
+
Bounded size
```

Examples in FITFORGE:

```text
WorkoutPlan → WorkoutDays
WorkoutDay → Planned Exercises
Planned Exercise → Sets
```

## Reference when:

```text
Reusable
+
Independently queried
+
Independently updated
+
Separate lifecycle
```

Examples:

```text
User → WorkoutPlan
WorkoutPlan → Exercise
```

---

# 25. Implementation Completed

## Exercise Model

Created:

```text
backend/src/models/exercise.model.ts
```

Tested successfully with MongoDB.

Example created:

```text
Bench Press
```

with:

```text
muscleGroups[]
equipment[]
difficulty
movementType
description
```

---

## WorkoutPlan Model

Created:

```text
backend/src/models/workoutPlan.model.ts
```

Successfully stored:

```text
User
 ↓
WorkoutPlan
 ↓
WorkoutDay
 ↓
Planned Exercise
 ↓
Sets
```

---

# 26. API Testing

Exercise creation:

```text
POST /api/v1/exercises
```

WorkoutPlan creation:

```text
POST /api/v1/workout-plans
```

WorkoutPlan retrieval:

```text
GET /api/v1/workout-plans/:id
```

`populate()` was successfully tested.

---

# 27. Important Interview Questions

## Q1. Why did you keep WorkoutPlan as a separate collection?

### Answer

> “A user can have multiple and potentially large workout plans, so I keep WorkoutPlan separately and reference the user using userId. This provides independent querying, updating and better scalability.”

---

## Q2. Why did you embed WorkoutDays?

### Answer

> “WorkoutDays have a strong ownership relationship with WorkoutPlan and are normally accessed together, so embedding them reduces unnecessary queries and keeps the relationship simple.”

---

## Q3. Why did you create a separate Exercise collection?

### Answer

> “Exercises are reusable entities that can belong to multiple workout plans. Keeping them separately avoids data duplication and allows centralized updates.”

---

## Q4. What is the difference between embedding and referencing?

### Answer

> “Embedding stores related data inside the same MongoDB document, while referencing stores an ObjectId pointing to another document. I use embedding for tightly owned bounded data and references for reusable or independently managed entities.”

---

## Q5. What does `populate()` do?

### Answer

> “Mongoose populate resolves a referenced ObjectId and retrieves the corresponding document, allowing us to return related data without duplicating it in the original document.”

---

## Q6. Why is `muscleGroups` an array?

### Answer

> “One exercise can target multiple muscle groups, so an array accurately represents that relationship and allows easier muscle-based filtering.”

---

## Q7. Why is `equipment` an array?

### Answer

> “An exercise can require multiple pieces of equipment, so an array allows FITFORGE to represent all required equipment and later filter exercises based on the user's available equipment.”

---

## Q8. Why is `movementType` a string?

### Answer

> “We store the primary movement pattern of an exercise, so a single controlled value such as push, pull, squat or hinge is sufficient.”

---

## Q9. Why use an enum for difficulty?

### Answer

> “Difficulty has a fixed set of valid values, so an enum prevents inconsistent values and maintains data quality.”

---

## Q10. Why isn't weight always required?

### Answer

> “Not every exercise uses external load. Bodyweight exercises such as pull-ups and dips can be performed without additional weight, so weight is optional.”

---

## Q11. Why is rest stored per set?

### Answer

> “Rest requirements can vary depending on load, repetitions and training type, so storing rest at the set level provides greater flexibility.”

---

## Q12. Why don't you store `kg` with every weight?

### Answer

> “FITFORGE currently targets Indian users and standardizes weight values in kilograms, so storing the same unit repeatedly would create unnecessary data duplication.”

---

## Q13. Why separate WorkoutPlan and WorkoutSession?

### Answer

> “WorkoutPlan represents the intended program, while WorkoutSession represents actual execution. This separation allows us to track performance and adherence without modifying the original plan.”

---

## Q14. Why shouldn't WorkoutPlan have a completed/active status?

### Answer

> “WorkoutPlan represents the workout program itself rather than an individual execution. Execution status belongs to WorkoutSession, where we can track whether a specific workout is in progress, completed or skipped.”

---

## Q15. Why use `_id: false` for nested schemas?

### Answer

> “The nested days, planned exercises and sets don't need independent document identity in our current design, so disabling automatic nested ObjectIds keeps the document simpler.”

---

# 28. One-Minute Day 12 Explanation

> “In FITFORGE, I designed WorkoutPlan as a separate collection referenced to the User because users can have multiple workout plans. WorkoutDays are embedded because they belong strongly to the plan and are normally accessed together. Exercises are maintained in a separate collection because they are reusable across multiple plans, and WorkoutPlan stores exerciseId references.
>
> Each planned exercise contains an array of sets, where every set stores repetitions, optional weight in kilograms and rest time. Weight is optional for bodyweight exercises, and rest is stored at the set level for flexibility.
>
> I also separated WorkoutPlan from WorkoutSession. The plan represents what the user intends to do, while the session will represent what the user actually performed. For retrieving Exercise details, I use Mongoose populate to resolve the exercise references.”

---

# 29. Architecture Summary

```text
                         ┌──────────────┐
                         │     User     │
                         └──────┬───────┘
                                │
                              userId
                                │
                                ▼
                     ┌────────────────────┐
                     │    WorkoutPlan     │
                     ├────────────────────┤
                     │ name               │
                     │ goal               │
                     │ days[]             │
                     └─────────┬──────────┘
                               │
                            embedded
                               │
                               ▼
                     ┌────────────────────┐
                     │    WorkoutDay      │
                     ├────────────────────┤
                     │ day                │
                     │ name               │
                     │ exercises[]        │
                     └─────────┬──────────┘
                               │
                            embedded
                               │
                               ▼
                     ┌────────────────────┐
                     │ Planned Exercise   │
                     ├────────────────────┤
                     │ exerciseId ────────┼─────────┐
                     │ sets[]             │         │
                     └─────────┬──────────┘         │
                               │                    │
                            embedded                │
                               │                    │
                               ▼                    ▼
                         ┌───────────┐       ┌──────────────┐
                         │   Sets    │       │   Exercise   │
                         ├───────────┤       ├──────────────┤
                         │ reps      │       │ name         │
                         │ weight    │       │ muscles[]    │
                         │ rest      │       │ equipment[]  │
                         └───────────┘       │ difficulty   │
                                             │ movementType │
                                             │ description  │
                                             └──────────────┘
```

---

# 30. Day 12 Final Takeaways

* Design the domain before writing APIs.
* Don't embed everything blindly.
* Use references for reusable entities.
* Use embedding for tightly owned bounded data.
* Exercise is a reusable master entity.
* WorkoutPlan represents intended training.
* WorkoutSession will represent actual execution.
* Sets are modeled as objects rather than just a count.
* Weight is optional and standardized in kg.
* Rest is stored at set level.
* Enums improve data consistency.
* `populate()` resolves Mongoose references.
* Good database design should support future features such as recommendations, progressive overload and AI.

---

# Day 12 Status

**COMPLETED ✅**

### Implemented

* Exercise Mongoose model
* WorkoutPlan Mongoose model
* Nested WorkoutDay structure
* Nested planned exercises
* Nested sets
* User reference
* Exercise reference
* MongoDB testing
* WorkoutPlan creation API
* WorkoutPlan retrieval API
* Mongoose populate

### Next

**Day 13 — Workout APIs**

Focus:

* Proper WorkoutPlan APIs
* Authentication integration
* User-specific workout plans
* CRUD operations
* Controller/service architecture
* Validation
* Authorization
* API testing
* Interview questions

---
