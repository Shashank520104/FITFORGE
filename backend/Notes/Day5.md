# FITFORGE - Day 5
# Mongoose Projection & Query Handling

## 1. What We Learned Today

Today we implemented:

- Mongoose Projection
- `.select()`
- `fields` query parameter
- Query parameter parsing
- Optional query parameters
- Conditional query building
- Debugging a Mongoose `.sort()` error

---

# 2. Mongoose Projection

Projection means selecting only the fields that we need from a document.

Instead of returning:

{
  "_id": "...",
  "name": "Rahul",
  "age": 22,
  "sex": "male",
  "weight": 70,
  "height": 175,
  "goal": "muscle_gain",
  "createdAt": "...",
  "updatedAt": "..."
}

we can request only:

name
age
weight

---

# 3. `.select()`

Mongoose provides `.select()` for field selection.

Example:

User.find(filter)
  .select("name age weight")

This returns only the selected fields.

---

# 4. API Implementation

We added a `fields` query parameter.

Example:

GET /api/v1/users?fields=name,age,weight

The controller receives:

fields = "name,age,weight"

Then converts it into:

"name age weight"

because Mongoose `.select()` accepts space-separated field names.

Code:

const fieldsValue = typeof fields === "string"
  ? fields.replace(/,/g, " ")
  : "";

---

# 5. Conditional Projection

We should not blindly call `.select()` when no fields are provided.

Instead:

if (fields) {
  query = query.select(fields);
}

This means:

fields provided
    ↓
apply projection

fields not provided
    ↓
return normal document

---

# 6. Query Building

Our service now builds the Mongoose query step by step.

Example:

let query = User.find(filter);

if (fields) {
  query = query.select(fields);
}

if (sort) {
  query = query.sort(sort);
}

query = query
  .skip(skip)
  .limit(limit);

const users = await query;

This approach is useful when many query parameters are optional.

---

# 7. Query Execution

Important concept:

Mongoose queries can be built step by step.

Example:

User.find(filter)
  .select(fields)
  .sort(sort)
  .skip(skip)
  .limit(limit);

The query is executed when it is awaited.

Example:

const users = await query;

---

# 8. Optional Query Parameters

Our API supports optional parameters.

Examples:

GET /api/v1/users

GET /api/v1/users?sort=-weight

GET /api/v1/users?fields=name,age,weight

GET /api/v1/users?page=1&limit=10

If a parameter is not provided, we use a default value or skip that operation.

---

# 9. Debugging Lesson

We initially had:

.sort(sort)

When `sort` was an empty string:

sort = ""

Mongoose produced:

MongooseError: Invalid field "" passed to sort()

The problem was not MongoDB or an empty database.

The problem was passing an empty value to `.sort()`.

We fixed it using:

if (sort) {
  query = query.sort(sort);
}

---

# 10. Important Backend Lesson

Never blindly pass optional query parameters into database queries.

Bad:

query.sort(sort);

Better:

if (sort) {
  query = query.sort(sort);
}

The same pattern can be applied to:

- select
- sort
- filters
- search
- pagination
- other optional query parameters

---

# 11. `_id` and Projection

When using:

.select("name age weight")

MongoDB/Mongoose normally still returns `_id`.

Example:

{
  "_id": "...",
  "name": "Rahul",
  "age": 22,
  "weight": 70
}

If `_id` also needs to be excluded:

.select("name age weight -_id")

---

# 12. FITFORGE Query Flow

Current API query flow:

Client
  ↓
Query Parameters
  ↓
Controller
  ↓
Parse parameters
  ↓
Service
  ↓
Build Mongoose Query
  ↓
MongoDB
  ↓
Results
  ↓
Controller
  ↓
JSON Response

---

# 13. Interview Questions

## Q1. What is projection in MongoDB?

Projection means selecting only specific fields from a document instead of returning the complete document.

---

## Q2. How do you perform projection in Mongoose?

Using `.select()`.

Example:

User.find().select("name age weight");

---

## Q3. Why is projection useful?

It can reduce unnecessary data returned from the database and reduce response size.

---

## Q4. What does `.select("name age weight")` do?

It returns only the selected fields along with `_id` by default.

---

## Q5. How can you exclude `_id`?

Use:

.select("name age weight -_id")

---

## Q6. What is a query parameter?

Query parameters are values provided after `?` in a URL.

Example:

GET /api/v1/users?goal=muscle_gain

Here:

goal = muscle_gain

---

## Q7. How do you read query parameters in Express?

Using:

req.query

Example:

const { goal } = req.query;

---

## Q8. Why do we check the type of query parameters?

Express query parameters can have different possible types, so we verify that the value is a string before using it as a string.

Example:

const sortValue = typeof sort === "string"
  ? sort
  : "";

---

## Q9. Why use conditional query building?

Because query parameters are optional.

We only apply operations when the corresponding parameter exists.

Example:

if (sort) {
  query = query.sort(sort);
}

---

## Q10. Why did `.sort("")` cause an error?

Because an empty string was passed as a sort field.

Mongoose rejected the empty field.

---

## Q11. What is the difference between `.select()` and `.sort()`?

`.select()` controls which fields are returned.

`.sort()` controls the order of documents.

---

## Q12. What is the difference between `.skip()` and `.limit()`?

`.skip()` skips a number of documents.

`.limit()` controls the maximum number of documents returned.

---

## Q13. Can Mongoose queries be chained?

Yes.

Example:

User.find(filter)
  .select(fields)
  .sort(sort)
  .skip(skip)
  .limit(limit);

---

## Q14. When is a Mongoose query executed?

Usually when the query is awaited or executed.

Example:

const users = await query;

---

# 14. Day 5 Implementation

Implemented:

[x] `.select()`
[x] Projection
[x] `fields` query parameter
[x] Query parameter parsing
[x] Conditional projection
[x] Conditional sorting
[x] Query building
[x] Debugged Mongoose sort error
[x] Tested projection API

---

# 15. Example API

Request:

GET /api/v1/users?fields=name,age,weight

Response:

{
  "success": true,
  "count": 2,
  "page": 1,
  "limit": 10,
  "data": [
    {
      "_id": "...",
      "name": "Rahul",
      "age": 22,
      "weight": 70
    },
    {
      "_id": "...",
      "name": "Aman",
      "age": 25,
      "weight": 82
    }
  ]
}

---

# Day 5 Status

[x] Projection
[x] `.select()`
[x] Query parameters
[x] Conditional query building
[x] Mongoose query chaining
[x] Debugging
[x] API testing

# Next

Next major topic:

MongoDB Indexes