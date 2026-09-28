# DAY 7 — Advanced MongoDB Queries & Search

## 1. Day 7 Objective

Today we learned how to build advanced MongoDB queries for real backend applications.

Topics covered:

* Comparison operators
* Equality operators
* Logical operators
* Combining multiple conditions
* Array queries
* Regex search
* Case-insensitive search
* Dynamic range filtering
* Dynamic `$in` filtering
* Query building in Controller → Service architecture
* API testing and debugging

---

# 2. Comparison Operators

Comparison operators are used when we want to compare field values.

| Operator | Meaning                            |
| -------- | ---------------------------------- |
| `$gt`    | Greater than                       |
| `$gte`   | Greater than or equal              |
| `$lt`    | Less than                          |
| `$lte`   | Less than or equal                 |
| `$eq`    | Equal                              |
| `$ne`    | Not equal                          |
| `$in`    | Value exists in given list         |
| `$nin`   | Value does not exist in given list |

### Examples

```javascript
db.users.find({
  age: { $gt: 23 }
})
```

Age greater than 23.

```javascript
db.users.find({
  age: { $gte: 23 }
})
```

Age greater than or equal to 23.

```javascript
db.users.find({
  weight: { $lte: 70 }
})
```

Weight less than or equal to 70.

### Range query

```javascript
db.users.find({
  weight: {
    $gte: 70,
    $lte: 80
  }
})
```

Meaning:

```text
70 <= weight <= 80
```

---

# 3. `$eq`

`$eq` means equal to.

```javascript
db.users.find({
  age: { $eq: 22 }
})
```

This is equivalent to:

```javascript
db.users.find({
  age: 22
})
```

---

# 4. `$ne`

`$ne` means not equal.

```javascript
db.users.find({
  goal: { $ne: "fat_loss" }
})
```

This returns users whose goal is not `fat_loss`.

---

# 5. `$in`

`$in` checks whether a field matches any value from a given list.

```javascript
db.users.find({
  goal: {
    $in: ["muscle_gain", "powerlifting"]
  }
})
```

Meaning:

```text
goal = muscle_gain
OR
goal = powerlifting
```

---

# 6. `$nin`

`$nin` means the value should not be present in the given list.

```javascript
db.users.find({
  goal: {
    $nin: ["muscle_gain", "fat_loss"]
  }
})
```

Meaning:

```text
goal should NOT be muscle_gain
AND
goal should NOT be fat_loss
```

### `$in` vs `$nin`

```text
$in  → value should be inside the list
$nin → value should NOT be inside the list
```

---

# 7. Logical Operators

MongoDB provides logical operators for combining conditions.

Main operators:

* `$or`
* `$and`
* `$nor`
* `$not`

---

# 8. `$or`

`$or` means at least one condition must be true.

```javascript
db.users.find({
  $or: [
    { goal: "muscle_gain" },
    { goal: "powerlifting" }
  ]
})
```

Meaning:

```text
goal = muscle_gain
OR
goal = powerlifting
```

If any one condition is true, the document can be selected.

---

# 9. `$and`

`$and` means all conditions must be true.

```javascript
db.users.find({
  $and: [
    { age: { $gte: 18 } },
    { weight: { $gte: 70 } }
  ]
})
```

However, for simple conditions MongoDB allows implicit AND:

```javascript
db.users.find({
  age: { $gte: 18 },
  weight: { $gte: 70 }
})
```

Both conditions must be satisfied.

---

# 10. `$nor`

`$nor` means none of the conditions should be true.

```javascript
db.users.find({
  $nor: [
    { goal: "fat_loss" },
    { sex: "female" }
  ]
})
```

A document is selected only when both conditions are false.

---

# 11. `$not`

`$not` reverses a condition.

Example:

```javascript
db.users.find({
  age: {
    $not: { $gte: 25 }
  }
})
```

Meaning:

```text
NOT(age >= 25)
```

Therefore:

```text
age < 25
```

Examples:

```text
22 → accepted
24 → accepted
25 → rejected
26 → rejected
```

Important reverse relationships:

```text
$gte → <
$gt  → <=
$lte → >
$lt  → >=
```

---

# 12. Combining Operators

Real applications usually combine multiple conditions.

Example:

```javascript
db.users.find({
  age: { $gte: 18 },
  $or: [
    { goal: "muscle_gain" },
    { goal: "powerlifting" }
  ]
})
```

Logic:

```text
age >= 18
AND
(goal = muscle_gain OR goal = powerlifting)
```

Another example:

```javascript
db.users.find({
  age: { $gte: 18 },
  weight: {
    $gte: 70,
    $lte: 80
  },
  $or: [
    { goal: "muscle_gain" },
    { goal: "powerlifting" }
  ]
})
```

Logic:

```text
age >= 18
AND
70 <= weight <= 80
AND
(goal = muscle_gain OR goal = powerlifting)
```

---

# 13. Array Queries

MongoDB supports queries on arrays.

Example document:

```javascript
{
  name: "Rahul",
  equipment: [
    "dumbbell",
    "barbell",
    "cable"
  ]
}
```

To find users having dumbbell:

```javascript
db.users.find({
  equipment: "dumbbell"
})
```

MongoDB can match a value inside an array.

---

# 14. `$all`

`$all` checks whether all specified values exist inside an array.

```javascript
db.users.find({
  equipment: {
    $all: ["dumbbell", "barbell"]
  }
})
```

This requires both:

```text
dumbbell
AND
barbell
```

Example:

```text
["dumbbell", "barbell", "cable"] → match
["dumbbell", "cable"]             → no match
```

### `$in` vs `$all`

```text
$in  → any value from the list
$all → all values from the list
```

---

# 15. `$size`

`$size` checks the exact number of elements in an array.

```javascript
db.users.find({
  equipment: {
    $size: 3
  }
})
```

Only arrays containing exactly 3 elements match.

```text
2 elements → no match
3 elements → match
4 elements → no match
```

Important:

`$size` checks an exact count.

---

# 16. `$elemMatch`

`$elemMatch` is useful when an array contains objects.

Example:

```javascript
{
  exercises: [
    {
      name: "Bench Press",
      weight: 80,
      reps: 8
    },
    {
      name: "Squat",
      weight: 100,
      reps: 5
    }
  ]
}
```

Query:

```javascript
db.workouts.find({
  exercises: {
    $elemMatch: {
      weight: { $gte: 80 },
      reps: { $gte: 8 }
    }
  }
})
```

Meaning:

> Find a single array element where both conditions are satisfied.

Bench Press:

```text
weight = 80 → true
reps = 8     → true
```

Therefore the document matches.

### Main idea

`$elemMatch` ensures multiple conditions apply to the same array element.

---

# 17. Regex Search

Regex is useful for text searching.

Example:

```javascript
db.users.find({
  name: {
    $regex: "rah"
  }
})
```

This searches for the pattern `rah`.

---

# 18. Case-Insensitive Regex

Use the `i` option for case-insensitive matching.

Example using JavaScript RegExp:

```javascript
db.users.find({
  name: new RegExp("rah", "i")
})
```

The `i` means:

```text
ignore case
```

Therefore:

```text
Rahul → match
rahul → match
RAHUL → match
RaHuL → match
```

---

# 19. Regex Anchors

### `^`

Means string starts with the given pattern.

```javascript
{
  name: {
    $regex: "^Rah",
    $options: "i"
  }
}
```

Examples:

```text
Rahul       → match
Rahul Kumar → match
Aman Rahul  → no match
```

### `$`

Means string ends with the given pattern.

```javascript
{
  name: {
    $regex: "Rah$",
    $options: "i"
  }
}
```

Examples:

```text
Rah         → match
Aman Rah    → match
Rahul       → no match
```

---

# 20. FITFORGE — Dynamic Name Search

Implemented API:

```text
GET /api/v1/users?name=rah
```

Controller separates `name` from normal filters:

```typescript
const {
  sort,
  page,
  limit,
  fields,
  name,
  minWeight,
  maxWeight,
  goals,
  ...filter
} = req.query;
```

The service builds a regex filter:

```typescript
if (name) {
  filter = {
    ...filter,
    name: new RegExp(name, "i")
  };
}
```

This allows:

```text
?name=rah
?name=RAH
?name=Rah
```

to match the same user.

---

# 21. FITFORGE — Dynamic Weight Filtering

Implemented APIs:

```text
GET /api/v1/users?minWeight=70
```

```text
GET /api/v1/users?maxWeight=80
```

```text
GET /api/v1/users?minWeight=70&maxWeight=80
```

Controller converts query parameters from strings to numbers:

```typescript
typeof minWeight === "string"
  ? Number(minWeight)
  : undefined
```

Service builds the MongoDB condition dynamically:

```typescript
if (minWeight !== undefined || maxWeight !== undefined) {
  const weightFilter: any = {};

  if (minWeight !== undefined) {
    weightFilter.$gte = minWeight;
  }

  if (maxWeight !== undefined) {
    weightFilter.$lte = maxWeight;
  }

  filter = {
    ...filter,
    weight: weightFilter
  };
}
```

Example:

```text
?minWeight=70&maxWeight=80
```

becomes:

```javascript
{
  weight: {
    $gte: 70,
    $lte: 80
  }
}
```

---

# 22. FITFORGE — Multi-Value Goal Filtering

Implemented API:

```text
GET /api/v1/users?goals=muscle_gain,powerlifting
```

Controller extracts `goals`.

Service converts the comma-separated string into an array:

```typescript
if (goals) {
  const goalList = goals.split(",");

  filter = {
    ...filter,
    goal: {
      $in: goalList
    }
  };
}
```

Example:

```text
goals=muscle_gain,powerlifting
```

becomes:

```javascript
{
  goal: {
    $in: [
      "muscle_gain",
      "powerlifting"
    ]
  }
}
```

Therefore:

```text
muscle_gain  → match
powerlifting → match
fat_loss     → no match
```

---

# 23. Combining Dynamic Filters

FITFORGE can now combine multiple filters.

Example:

```text
GET /api/v1/users?goals=muscle_gain,fat_loss&minWeight=70&maxWeight=80
```

Logic:

```text
goal IN [muscle_gain, fat_loss]
AND
weight >= 70
AND
weight <= 80
```

This demonstrates dynamic query building.

---

# 24. Controller → Service Flow

For advanced filtering:

```text
Client
  ↓
Query Parameters
  ↓
Controller
  ↓
Parse / separate special parameters
  ↓
Service
  ↓
Build MongoDB filter
  ↓
Mongoose
  ↓
MongoDB
  ↓
Results
```

Example:

```text
/api/v1/users?minWeight=70&maxWeight=80
```

Controller:

```text
"70" → 70
"80" → 80
```

Service:

```javascript
{
  weight: {
    $gte: 70,
    $lte: 80
  }
}
```

MongoDB executes the query.

---

# 25. Debugging — Mongoose Regex Error

During implementation, the following approach caused an error:

```typescript
name: {
  $regex: name,
  $options: "i"
}
```

Error:

```text
Can't use $option with String.
```

The issue occurred because of how the current Mongoose filter object was being cast.

The implementation was changed to:

```typescript
name: new RegExp(name, "i")
```

This worked correctly.

Lesson:

> When debugging Mongoose queries, understand how Mongoose casts query values and use a JavaScript RegExp when appropriate.

---

# 26. Important Query Concepts

### Query parameter

Example:

```text
?minWeight=70
```

Query parameters arrive from Express as strings.

Therefore:

```text
"70"
```

needs to be converted to:

```text
70
```

when performing numeric comparisons.

---

# 27. Common Mistakes

### Mistake 1 — Treating query parameters as numbers automatically

Wrong assumption:

```text
req.query.minWeight → number
```

Actually:

```text
req.query.minWeight → string | undefined
```

Convert when required:

```typescript
Number(minWeight)
```

---

### Mistake 2 — `$size` means minimum size

Wrong:

```text
$size: 3 → 3 or more
```

Correct:

```text
$size: 3 → exactly 3
```

---

### Mistake 3 — `$or` requires all conditions

Wrong:

```text
$or → all conditions true
```

Correct:

```text
$or → at least one condition true
```

---

### Mistake 4 — `$and` accepts one true condition

Wrong:

```text
true AND false → true
```

Correct:

```text
true AND false → false
```

---

### Mistake 5 — `$not` with `$gte`

```javascript
{
  age: {
    $not: { $gte: 25 }
  }
}
```

means:

```text
age < 25
```

not:

```text
age <= 25
```

---

# 28. Day 7 Placement Interview Questions

## Basic

### Q1. What are MongoDB comparison operators?

They compare field values using operators such as `$gt`, `$gte`, `$lt`, `$lte`, `$eq`, `$ne`, `$in`, and `$nin`.

### Q2. Difference between `$gt` and `$gte`?

`$gt` means greater than, while `$gte` means greater than or equal to.

### Q3. Difference between `$lt` and `$lte`?

`$lt` means less than, while `$lte` means less than or equal to.

### Q4. Difference between `$in` and `$nin`?

`$in` matches values present in the specified list, while `$nin` matches values not present in the list.

---

# 29. Logical Operator Interview Questions

### Q5. What does `$or` do?

It matches documents where at least one condition is true.

### Q6. What does `$and` do?

It matches documents where all conditions are true.

### Q7. What does `$nor` do?

It matches documents where none of the specified conditions are true.

### Q8. What does `$not` do?

It reverses a condition.

### Q9. Can MongoDB perform AND without explicitly using `$and`?

Yes. Multiple field conditions in the same query object are implicitly ANDed.

Example:

```javascript
{
  age: { $gte: 18 },
  weight: { $gte: 70 }
}
```

---

# 30. Array Interview Questions

### Q10. What is `$all`?

`$all` matches arrays containing all specified values.

### Q11. What is `$size`?

`$size` matches arrays containing exactly the specified number of elements.

### Q12. What is `$elemMatch`?

`$elemMatch` allows multiple conditions to be applied to the same element of an array.

### Q13. Why is `$elemMatch` useful?

It is useful when an array contains objects and multiple conditions must match one array object.

---

# 31. Regex Interview Questions

### Q14. What is `$regex`?

`$regex` performs pattern-based string matching.

### Q15. What does regex option `i` mean?

It makes the regex case-insensitive.

### Q16. What does `^` mean in regex?

It matches the beginning of a string.

### Q17. What does `$` mean in regex?

It matches the end of a string.

### Q18. Can regex queries be expensive?

Yes. Regex queries, especially broad patterns, can become expensive on large collections and should be designed carefully.

---

# 32. Backend Interview Questions

### Q19. How did you implement dynamic filtering in FITFORGE?

I separate special query parameters in the controller and pass them to the service. The service dynamically builds MongoDB filters using operators such as `$gte`, `$lte`, `$in`, and regex.

### Q20. Why convert query parameters from strings to numbers?

HTTP query parameters arrive as strings. Numeric MongoDB comparisons require numeric values, so I explicitly convert them using `Number()`.

### Q21. Why separate query-building logic into the service layer?

It keeps controllers focused on handling HTTP requests and responses while the service layer handles business and database query logic.

### Q22. How would you implement a weight range filter?

```javascript
{
  weight: {
    $gte: 70,
    $lte: 80
  }
}
```

### Q23. How would you fetch users with multiple goals?

```javascript
{
  goal: {
    $in: ["muscle_gain", "powerlifting"]
  }
}
```

### Q24. How would you implement case-insensitive name search?

```javascript
{
  name: new RegExp(searchTerm, "i")
}
```

---

# 33. FITFORGE APIs Implemented on Day 7

### Name Search

```text
GET /api/v1/users?name=rah
```

### Minimum Weight

```text
GET /api/v1/users?minWeight=70
```

### Maximum Weight

```text
GET /api/v1/users?maxWeight=80
```

### Weight Range

```text
GET /api/v1/users?minWeight=70&maxWeight=80
```

### Multiple Goals

```text
GET /api/v1/users?goals=muscle_gain,powerlifting
```

### Combined Query

```text
GET /api/v1/users?goals=muscle_gain,fat_loss&minWeight=70&maxWeight=80
```

---

# 34. Day 7 Final Checklist

* [x] Comparison operators
* [x] `$eq`
* [x] `$ne`
* [x] `$in`
* [x] `$nin`
* [x] `$or`
* [x] `$and`
* [x] `$nor`
* [x] `$not`
* [x] Combining operators
* [x] Array queries
* [x] `$all`
* [x] `$size`
* [x] `$elemMatch`
* [x] Regex
* [x] Case-insensitive search
* [x] Dynamic name search
* [x] Dynamic weight range filtering
* [x] Dynamic `$in` goal filtering
* [x] Multiple filters together
* [x] Query parameter conversion
* [x] Debugging Mongoose query casting
* [x] API testing
* [x] Placement interview preparation

# Day 7 Status

**COMPLETED ✅**

Main takeaway:

> Advanced MongoDB querying allows FITFORGE to support flexible filtering, search, ranges, and multi-value conditions while keeping query-building logic inside the service layer.
