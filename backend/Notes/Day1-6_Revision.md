# FITFORGE Backend — Day 1 to Day 6 Placement Revision

## Purpose

This document covers everything learned and implemented in FITFORGE from Day 1 to Day 6.

Revision focus:

* Backend fundamentals
* Node.js
* TypeScript
* HTTP
* Express.js
* REST APIs
* Middleware
* Routing
* Controllers
* Services
* Error handling
* MongoDB
* MongoDB Atlas
* Mongoose
* Schema and Model
* CRUD
* Validation
* Filtering
* Sorting
* Pagination
* Projection
* Query parameters
* Indexing
* Compound indexes
* Left-prefix rule
* `IXSCAN`
* `COLLSCAN`
* `explain("executionStats")`

The goal is not just to remember definitions, but to be able to explain **why, how, and where these concepts were used in FITFORGE**.

---

# DAY 1 — Backend and TypeScript Foundation

---

# 1. What is Backend?

### Interview Question

**Q. What is backend development?**

### Answer

Backend development handles the server-side logic of an application.

It is responsible for:

* Processing requests
* Applying business logic
* Communicating with databases
* Authentication and authorization
* Returning responses to clients

### FITFORGE Example

```text
Frontend
   ↓
Backend API
   ↓
Business Logic
   ↓
MongoDB
```

---

# 2. What is Node.js?

### Interview Question

**Q. What is Node.js?**

### Answer

Node.js is a JavaScript runtime built on Chrome's V8 JavaScript engine that allows JavaScript to run outside the browser.

### Important Point

Node.js is **not a programming language**.

It is a runtime environment for executing JavaScript.

---

# 3. Why use Node.js for Backend?

### Interview Question

**Q. Why did you choose Node.js for your backend?**

### Answer

Node.js provides a fast, event-driven, non-blocking runtime that is well suited for I/O-heavy applications such as APIs and database operations.

For FITFORGE, it allows us to build the backend using JavaScript/TypeScript with Express.

---

# 4. Node.js Request Flow

Basic backend flow:

```text
Client
   ↓
Node.js Server
   ↓
Application Logic
   ↓
Database
   ↓
Response
```

---

# 5. TypeScript

### Interview Question

**Q. Why use TypeScript instead of JavaScript?**

### Answer

TypeScript adds static typing to JavaScript, which helps catch errors during development and improves maintainability, readability, and tooling.

---

# 6. TypeScript Compilation

Our TypeScript code:

```text
src/
   ↓
TypeScript
   ↓
tsc
   ↓
dist/
   ↓
JavaScript
   ↓
Node.js
```

Command used:

```powershell
npx tsc
```

### Interview Question

**Q. Can Node.js directly execute TypeScript?**

### Answer

Normally Node.js executes JavaScript. TypeScript is compiled/transformed into JavaScript before execution in our setup.

---

# 7. `tsconfig.json`

Important settings used:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,
    "types": ["node"],
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### Interview Question

**Q. What is `rootDir`?**

It defines the root directory containing the TypeScript source files.

### Q. What is `outDir`?

It defines where compiled JavaScript files are generated.

### Q. What does `strict: true` do?

It enables strict TypeScript type checking.

---

# 8. npm

### Interview Question

**Q. What is npm?**

### Answer

npm is the package manager commonly used with Node.js for installing and managing dependencies and project scripts.

Example:

```powershell
npm install express
```

---

# 9. `package.json`

It stores project metadata, dependencies, scripts, and configuration.

Example dependencies:

```text
express
mongoose
dotenv
```

---

# DAY 1 PLACEMENT QUESTIONS

### Q1. What is Node.js?

JavaScript runtime built on Chrome's V8 engine.

### Q2. Is Node.js a language?

No. It is a runtime environment.

### Q3. What is TypeScript?

A statically typed superset of JavaScript.

### Q4. Why TypeScript?

Type safety, better tooling, maintainability, and early error detection.

### Q5. How does your TypeScript backend run?

```text
.ts
 ↓
tsc
 ↓
.js
 ↓
Node.js
```

---

# DAY 2 — HTTP and Express.js

---

# 10. What is HTTP?

HTTP stands for HyperText Transfer Protocol.

It is the protocol used for communication between clients and servers.

Basic flow:

```text
Client → HTTP Request → Server
Client ← HTTP Response ← Server
```

---

# 11. HTTP Request

A request can contain:

* HTTP method
* URL
* Headers
* Query parameters
* Path parameters
* Body

Example:

```text
POST /api/v1/users
```

---

# 12. HTTP Methods

Important methods used:

### GET

Used to retrieve data.

```text
GET /api/v1/users
```

### POST

Used to create data.

```text
POST /api/v1/users
```

### PATCH

Used to partially update data.

```text
PATCH /api/v1/users/:id
```

### DELETE

Used to delete data.

```text
DELETE /api/v1/users/:id
```

---

# 13. GET vs POST

### Interview Question

**Q. Difference between GET and POST?**

### Answer

GET is generally used to retrieve resources, while POST is generally used to create a new resource or perform an operation that submits data to the server.

GET parameters are commonly passed through the URL, while POST data is commonly sent in the request body.

---

# 14. HTTP Status Codes

Important status codes:

```text
200 → OK
201 → Created
400 → Bad Request
404 → Not Found
500 → Internal Server Error
```

### FITFORGE

Successful user creation:

```typescript
res.status(201)
```

Successful retrieval:

```typescript
res.status(200)
```

---

# 15. Native Node HTTP Server

Before Express, we understood Node's native HTTP server.

Conceptually:

```text
http.createServer()
      ↓
request
      ↓
response
      ↓
server.listen()
```

This helped understand what Express abstracts.

---

# 16. Express.js

### Interview Question

**Q. What is Express.js?**

### Answer

Express.js is a lightweight web framework for Node.js used to build HTTP servers and APIs.

It provides features such as:

* Routing
* Middleware
* Request/response handling
* API development

---

# 17. Express Application

Basic structure:

```typescript
const app = express();

app.listen(3000);
```

---

# 18. `express.json()`

We used:

```typescript
app.use(express.json());
```

### Interview Question

**Q. Why do we use `express.json()`?**

### Answer

It is middleware that parses incoming JSON request bodies and makes the parsed data available through `req.body`.

---

# 19. Request Body

Example:

```json
{
  "name": "Rahul",
  "age": 22
}
```

Accessed using:

```typescript
req.body
```

---

# 20. Route Parameters

Example:

```text
GET /api/v1/users/123
```

Route:

```typescript
router.get("/:id", getUser);
```

Access:

```typescript
req.params.id
```

---

# 21. Query Parameters

Example:

```text
GET /api/v1/users?goal=muscle_gain
```

Access:

```typescript
req.query.goal
```

Multiple:

```text
GET /api/v1/users?goal=muscle_gain&sex=male
```

---

# 22. Query Parameter vs Route Parameter

### Route Parameter

Used to identify a specific resource.

```text
/users/123
```

```typescript
req.params.id
```

### Query Parameter

Used for filtering, sorting, pagination, searching, etc.

```text
/users?goal=muscle_gain
```

```typescript
req.query.goal
```

---

# DAY 2 PLACEMENT QUESTIONS

### Q1. What is Express?

Node.js web framework used to build APIs and HTTP servers.

### Q2. What is `req.body`?

Data sent by the client in the request body.

### Q3. What is `req.params`?

Values captured from route parameters.

### Q4. What is `req.query`?

Query-string parameters used for filtering, sorting, pagination, etc.

### Q5. Difference between PUT and PATCH?

PUT generally represents replacement of a resource, while PATCH represents partial modification.

### Q6. Why use status code 201?

Because a new resource was successfully created.

### Q7. What does `express.json()` do?

Parses incoming JSON request bodies.

---

# DAY 3 — Backend Architecture

---

# 23. What is Middleware?

### Interview Question

**Q. What is middleware in Express?**

### Answer

Middleware is a function that has access to the request, response, and next middleware function.

It can:

* Modify request/response
* Execute logic
* Validate requests
* Authenticate users
* Log requests
* Handle errors
* Pass control using `next()`

---

# 24. Our Logger Middleware

We implemented:

```typescript
const loggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log(`${req.method} ${req.url}`);
  next();
};
```

### Interview Question

**Q. Why is `next()` important?**

### Answer

`next()` passes control to the next middleware or route handler. Without it, the request can remain stuck in the middleware chain.

---

# 25. Middleware Flow

Our backend follows:

```text
Client
  ↓
Middleware
  ↓
Route
  ↓
Controller
  ↓
Service
  ↓
Model
  ↓
MongoDB
  ↓
Service
  ↓
Controller
  ↓
Response
```

This is one of the most important FITFORGE architecture points.

---

# 26. Routes

Routes define which function should handle a specific HTTP method and path.

Example:

```typescript
router.post("/", createUser);
router.get("/:id", getUser);
router.patch("/:id", updateUser);
router.delete("/:id", deleteUser);
```

Mounted using:

```typescript
app.use("/api/v1/users", userRoutes);
```

Therefore:

```text
POST /api/v1/users
GET /api/v1/users/:id
PATCH /api/v1/users/:id
DELETE /api/v1/users/:id
```

---

# 27. Why Separate Routes?

### Interview Question

**Q. Why did you create separate route files?**

### Answer

To keep routing modular and maintainable.

Instead of keeping all routes in one file, user-related routes are separated from workout-related routes.

---

# 28. Controller

### Interview Question

**Q. What is the responsibility of a controller?**

### Answer

A controller handles the HTTP layer.

It:

* Reads request data
* Calls the appropriate service
* Builds the HTTP response
* Handles HTTP-specific errors/status codes

---

# 29. Service Layer

### Interview Question

**Q. Why did you create a service layer?**

### Answer

The service layer contains business logic and keeps controllers thin.

This improves:

* Separation of concerns
* Reusability
* Testability
* Maintainability

---

# 30. Controller vs Service

### Controller

```text
HTTP-related work
```

### Service

```text
Business/data-related logic
```

Example:

```text
Controller
   ↓
createUserService()
   ↓
User.create()
```

---

# 31. Model

The model represents the database structure and provides database interaction through Mongoose.

Example:

```typescript
const User = mongoose.model("User", userSchema);
```

---

# 32. Centralized Error Handling

We created:

```text
error.middleware.ts
```

It handles errors centrally.

Example:

```typescript
if (err.name === "ValidationError") {
  res.status(400).json({
    success: false,
    message: "Validation failed"
  });
}
```

---

# 33. Why Centralized Error Handling?

### Interview Question

**Q. Why not handle every error separately in every controller?**

### Answer

Centralized error handling avoids duplicated error-response logic and provides consistent API responses.

---

# 34. 404 Handling

If no route matches the request, the server returns a not-found response.

Concept:

```text
Request
   ↓
No matching route
   ↓
404
```

---

# DAY 3 PLACEMENT QUESTIONS

### Q1. What is middleware?

Function executed during the request-response cycle.

### Q2. What is `next()`?

Passes control to the next middleware/handler.

### Q3. What is a controller?

Handles HTTP request and response logic.

### Q4. What is a service?

Contains business/application logic.

### Q5. Why separate controller and service?

Separation of concerns and better maintainability/testability.

### Q6. Explain your backend architecture.

```text
Client
→ Middleware
→ Route
→ Controller
→ Service
→ Model
→ MongoDB
→ Response
```

### Q7. What happens if the database operation fails?

The error is propagated to centralized error handling and an appropriate response is returned.

---

# DAY 4 — MongoDB and Mongoose

---

# 35. What is MongoDB?

### Interview Question

**Q. What is MongoDB?**

### Answer

MongoDB is a NoSQL document-oriented database that stores data in flexible BSON documents.

---

# 36. MongoDB vs SQL

MongoDB:

```text
Database
  ↓
Collection
  ↓
Document
```

SQL:

```text
Database
  ↓
Table
  ↓
Row
```

MongoDB stores documents rather than traditional rows.

---

# 37. Why MongoDB for FITFORGE?

### Interview Question

**Q. Why did you choose MongoDB?**

### Answer

FITFORGE contains user profiles, workout structures, exercise data, logs, nutrition data, and progress information. MongoDB's document model provides flexible schema design and works well with JavaScript/TypeScript backend applications.

Important:

Do not say MongoDB is always better than SQL.

The correct answer depends on the application's data and consistency requirements.

---

# 38. MongoDB Atlas

MongoDB Atlas is the cloud-hosted MongoDB service used for FITFORGE.

We created/reused:

```text
Cluster0
   ↓
FITFORGE database
   ↓
users collection
```

---

# 39. Database Connection

We use Mongoose:

```typescript
await mongoose.connect(process.env.MONGODB_URI as string);
```

Connection string is stored in `.env`.

---

# 40. Why `.env`?

### Interview Question

**Q. Why should database credentials be stored in environment variables?**

### Answer

Sensitive configuration such as database credentials should not be hardcoded into source code or committed to Git.

---

# 41. Mongoose

### Interview Question

**Q. What is Mongoose?**

### Answer

Mongoose is an ODM for MongoDB and Node.js that provides schemas, models, validation, middleware, and convenient database interaction.

---

# 42. Schema

A schema defines the structure and validation rules of documents.

Our User schema includes:

```text
name
age
sex
weight
height
goal
```

---

# 43. Model

A model is created from a schema and is used to interact with a MongoDB collection.

Example:

```typescript
const User = mongoose.model("User", userSchema);
```

---

# 44. Schema vs Model

### Schema

Defines structure and rules.

### Model

Provides an interface for interacting with the collection.

---

# 45. Mongoose Validation

Our User model uses:

```typescript
required
trim
minlength
maxlength
min
max
enum
```

Example:

```typescript
age: {
  type: Number,
  required: true,
  min: 13,
  max: 100
}
```

---

# 46. `enum`

Example:

```typescript
sex: {
  type: String,
  enum: ["male", "female", "other"]
}
```

Only allowed values can be stored.

---

# 47. CRUD

CRUD means:

```text
Create
Read
Update
Delete
```

---

# 48. Create

Implemented using:

```typescript
User.create(userData);
```

API:

```text
POST /api/v1/users
```

---

# 49. Read

Single user:

```typescript
User.findById(userId);
```

All users:

```typescript
User.find(filter);
```

---

# 50. Update

Implemented using:

```typescript
User.findByIdAndUpdate(
  userId,
  updates,
  {
    new: true,
    runValidators: true
  }
);
```

### `new: true`

Returns the updated document.

### `runValidators: true`

Runs schema validation during the update.

---

# 51. Delete

Implemented using:

```typescript
User.findByIdAndDelete(userId);
```

---

# 52. ObjectId Validation

Before querying by ID:

```typescript
mongoose.Types.ObjectId.isValid(userId)
```

This prevents invalid ObjectId values from being sent to MongoDB.

---

# 53. Filtering

Example:

```text
GET /api/v1/users?goal=muscle_gain
```

Backend creates:

```typescript
filter = {
  goal: "muscle_gain"
}
```

Then:

```typescript
User.find(filter);
```

---

# 54. Multiple Filters

Example:

```text
GET /api/v1/users?goal=muscle_gain&sex=male
```

Creates:

```typescript
{
  goal: "muscle_gain",
  sex: "male"
}
```

MongoDB matches documents satisfying both conditions.

---

# 55. Sorting

Example:

```text
GET /api/v1/users?sort=weight
```

Ascending:

```typescript
.sort("weight")
```

Descending:

```text
GET /api/v1/users?sort=-weight
```

---

# 56. Pagination

Pagination prevents returning a huge number of documents at once.

Formula:

```typescript
const skip = (page - 1) * limit;
```

Then:

```typescript
query
  .skip(skip)
  .limit(limit);
```

Example:

```text
page = 2
limit = 10

skip = (2 - 1) * 10
skip = 10
```

---

# 57. Why Pagination?

### Interview Question

**Q. Why is pagination important?**

### Answer

Pagination limits the amount of data returned in one request, reducing response size, memory usage, database work, and network overhead.

---

# DAY 4 PLACEMENT QUESTIONS

### Q1. What is MongoDB?

NoSQL document-oriented database.

### Q2. What is Mongoose?

ODM used to interact with MongoDB from Node.js.

### Q3. Schema vs Model?

Schema defines structure/rules; model provides an interface for database operations.

### Q4. Explain CRUD.

Create, Read, Update, Delete.

### Q5. Why use `runValidators: true`?

To apply schema validation during update operations.

### Q6. Why use `new: true`?

To return the updated document.

### Q7. Why use ObjectId validation?

To verify that the provided ID has a valid MongoDB ObjectId format.

### Q8. Why pagination?

To avoid loading and returning too much data at once.

---

# DAY 5 — Projection and Query Building

---

# 58. What is Projection?

Projection means selecting which fields should be returned from documents.

Example:

```text
GET /api/v1/users?fields=name,age,weight
```

Response contains:

```json
{
  "name": "Rahul",
  "age": 22,
  "weight": 70
}
```

instead of returning every field.

---

# 59. Mongoose `.select()`

We implemented:

```typescript
query = query.select(fields);
```

Example:

```typescript
.select("name age weight")
```

---

# 60. Why Projection?

### Interview Question

**Q. Why would you use projection?**

### Answer

Projection reduces unnecessary data retrieval and response size and ensures that only required fields are returned to the client.

It can improve efficiency and avoid exposing unnecessary fields.

---

# 61. Parsing Fields

Client sends:

```text
fields=name,age,weight
```

We convert:

```text
name,age,weight
```

into:

```text
name age weight
```

using:

```typescript
fields.replace(/,/g, " ")
```

---

# 62. `_id` Behavior

By default, MongoDB includes `_id` in query results even when specific fields are selected.

Example:

```text
_id
name
age
weight
```

If `_id` needs to be excluded, MongoDB projection syntax can explicitly exclude it.

---

# 63. Query Building

Instead of executing everything immediately:

```typescript
let query = User.find(filter);
```

We conditionally modify the query:

```typescript
if (fields) {
  query = query.select(fields);
}

if (sort) {
  query = query.sort(sort);
}

query = query
  .skip(skip)
  .limit(limit);
```

Finally:

```typescript
const users = await query;
```

---

# 64. Why Conditional Query Building?

Not every request contains every query parameter.

For example:

```text
/users
/users?goal=muscle_gain
/users?sort=-weight
/users?fields=name,age
/users?page=2&limit=10
```

Therefore, query operations should be applied only when required.

---

# 65. Mongoose Query Chaining

We used:

```typescript
query
  .select(fields)
  .sort(sort)
  .skip(skip)
  .limit(limit);
```

This allows multiple query operations to be built before execution.

---

# 66. Query Execution

The query is finally executed using:

```typescript
const users = await query;
```

`await` waits for the asynchronous database operation to complete.

---

# 67. Debugging a Query Error

We encountered:

```text
MongooseError: Invalid field "" passed to sort()
```

Cause:

```typescript
.sort("")
```

was being called when no `sort` query parameter existed.

Solution:

```typescript
if (sort) {
  query = query.sort(sort);
}
```

### Interview Question

**Q. Tell me about a backend bug you encountered and how you fixed it.**

### Answer

While implementing dynamic sorting, an empty string was being passed to Mongoose's `sort()` when no sort parameter was provided. Mongoose rejected the empty field. I fixed it by conditionally applying `.sort()` only when a valid sort parameter exists.

This is a good practical debugging example from FITFORGE.

---

# 68. Query Parameters Implemented in FITFORGE

Our users API supports:

### Filtering

```text
?goal=muscle_gain
```

### Multiple filtering

```text
?goal=muscle_gain&sex=male
```

### Sorting

```text
?sort=weight
```

```text
?sort=-weight
```

### Pagination

```text
?page=1&limit=10
```

### Projection

```text
?fields=name,age,weight
```

These can also be combined.

Example:

```text
/api/v1/users?goal=muscle_gain&sex=male&sort=-weight&page=1&limit=10&fields=name,age,weight
```

---

# DAY 5 PLACEMENT QUESTIONS

### Q1. What is projection?

Selecting only required fields from returned documents.

### Q2. How do you implement projection in Mongoose?

Using `.select()`.

### Q3. Why use conditional query building?

Because query parameters are optional and different requests require different query operations.

### Q4. What does `.sort()` do?

Controls ordering of query results.

### Q5. What does `.skip()` do?

Skips a specified number of documents.

### Q6. What does `.limit()` do?

Limits the number of returned documents.

### Q7. When is a Mongoose query executed?

When awaited or otherwise executed.

### Q8. What bug did you face?

Empty string passed to `.sort()`.

### Q9. How did you fix it?

Conditionally call `.sort()` only when `sort` exists.

---

# DAY 6 — MongoDB Indexing

---

# 69. What is an Index?

### Interview Question

**Q. What is an index in MongoDB?**

### Answer

An index is a data structure that helps MongoDB find and retrieve documents more efficiently, improving query performance.

---

# 70. Cost of Indexes

Indexes have trade-offs.

Advantages:

```text
Faster reads/query lookup
```

Costs:

```text
Additional storage
Write overhead
```

When data is inserted, updated, or deleted, the relevant indexes also need to be maintained.

---

# 71. Single-Field Index

We implemented:

```typescript
userSchema.index({ goal: 1 });
```

This creates an index on the `goal` field.

It can help queries such as:

```text
GET /api/v1/users?goal=muscle_gain
```

---

# 72. Meaning of `1` and `-1`

```typescript
{ goal: 1 }
```

means ascending index order.

```typescript
{ goal: -1 }
```

means descending index order.

Important:

Index direction does not automatically sort query results.

Sorting is separately controlled using `.sort()`.

---

# 73. Compound Index

We implemented:

```typescript
userSchema.index({
  goal: 1,
  sex: 1
});
```

This indexes multiple fields.

Useful query pattern:

```text
GET /api/v1/users?goal=muscle_gain&sex=male
```

---

# 74. Why Compound Index?

### Interview Question

**Q. Why use a compound index instead of separate indexes?**

### Answer

A compound index can be designed around a common multi-field query pattern and can efficiently support queries using its leading fields.

The exact choice depends on actual query patterns.

---

# 75. Index Field Order

These are different:

```typescript
{ goal: 1, sex: 1 }
```

and:

```typescript
{ sex: 1, goal: 1 }
```

The field order matters because compound indexes follow their defined order.

---

# 76. Left-Prefix Rule

For:

```text
{ goal: 1, sex: 1 }
```

the leading field is:

```text
goal
```

Therefore, the index can generally support:

```text
goal
goal + sex
```

But:

```text
sex
```

alone generally cannot use this compound index efficiently.

---

# 77. `IXSCAN`

`IXSCAN` means MongoDB is scanning an index.

If `explain()` shows:

```text
IXSCAN
```

the query is using an index.

---

# 78. `COLLSCAN`

`COLLSCAN` means MongoDB is scanning the collection.

If `explain()` shows:

```text
COLLSCAN
```

MongoDB is scanning documents in the collection rather than using a suitable index.

---

# 79. `explain("executionStats")`

We used:

```javascript
db.users.find({
  goal: "muscle_gain",
  sex: "male"
}).explain("executionStats")
```

This lets us inspect the query execution plan and runtime statistics.

We verified:

```text
IXSCAN
```

which confirmed index usage.

---

# 80. Why Not Index Every Field?

### Interview Question

**Q. Why don't you create indexes on every field?**

### Answer

Because indexes consume additional storage and add overhead to write operations. Therefore, indexes should be created according to frequently used query, filtering, and sorting patterns.

---

# DAY 6 PLACEMENT QUESTIONS

### Q1. What is an index?

A data structure that improves efficient data retrieval.

### Q2. What is a single-field index?

An index created on one field.

### Q3. What is a compound index?

An index created using multiple fields.

### Q4. What is the left-prefix rule?

Compound indexes are most useful when queries start with the index's leading fields.

### Q5. What is IXSCAN?

Index scan.

### Q6. What is COLLSCAN?

Collection scan.

### Q7. How do you check index usage?

Using:

```javascript
.explain("executionStats")
```

and inspecting the execution plan.

### Q8. Why not index every field?

Storage and write-performance overhead.

---

# FITFORGE — COMPLETE DAY 1 TO DAY 6 ARCHITECTURE

At this point, the backend flow is:

```text
                    CLIENT
                      |
                      v
                 HTTP Request
                      |
                      v
                 Express App
                      |
                      v
                  Middleware
                      |
                      v
                    Route
                      |
                      v
                 Controller
                      |
                      v
                   Service
                      |
                      v
                  Mongoose
                      |
                      v
                   MongoDB
                      |
             +--------+--------+
             |                 |
          Indexes           Documents
             |                 |
             +--------+--------+
                      |
                      v
                  Response
                      |
                      v
                    CLIENT
```

---

# FITFORGE IMPLEMENTED API CONCEPTS

## User APIs

### Create User

```text
POST /api/v1/users
```

Uses:

* Request body
* Controller
* Service
* Mongoose
* Validation
* 201 response

---

### Get User

```text
GET /api/v1/users/:id
```

Uses:

* Route parameter
* ObjectId validation
* Mongoose `findById`
* 404 handling

---

### Update User

```text
PATCH /api/v1/users/:id
```

Uses:

* Route parameter
* Request body
* `findByIdAndUpdate`
* `new: true`
* `runValidators: true`

---

### Delete User

```text
DELETE /api/v1/users/:id
```

Uses:

* Route parameter
* ObjectId validation
* `findByIdAndDelete`

---

### Get All Users

```text
GET /api/v1/users
```

Supports:

```text
Filtering
Sorting
Pagination
Projection
Multiple query parameters
```

Example:

```text
GET /api/v1/users?goal=muscle_gain&sex=male&sort=-weight&page=1&limit=10&fields=name,age,weight
```

---

# MOST IMPORTANT PROJECT EXPLANATION

If an interviewer says:

## "Explain what you have implemented in your backend so far."

A strong answer:

> "I am building FITFORGE, a fitness tracking backend using Node.js, TypeScript, Express, MongoDB and Mongoose. I structured the backend using routes, controllers, services and models to maintain separation of concerns. I implemented user CRUD APIs with Mongoose validation, centralized error handling, filtering, sorting, pagination and field projection. I also implemented MongoDB single-field and compound indexes and verified their usage using `explain('executionStats')`. The API supports query-based filtering and pagination, and sensitive database configuration is kept in environment variables."

---

# MOST IMPORTANT ARCHITECTURE QUESTION

## "Why did you separate Controller and Service?"

Answer:

> "I separated them to maintain separation of concerns. The controller handles HTTP-specific responsibilities such as reading request data and sending responses, while the service contains business and database-related logic. This keeps controllers thin and makes the business logic easier to reuse and test."

---

# MOST IMPORTANT DATABASE QUESTION

## "How does a request reach MongoDB in your project?"

Answer:

```text
Client
→ Express Middleware
→ Route
→ Controller
→ Service
→ Mongoose Model
→ MongoDB
→ Service
→ Controller
→ HTTP Response
```

---

# MOST IMPORTANT QUERY QUESTION

## "How did you implement filtering, sorting and pagination?"

Answer:

> "I read the optional query parameters from `req.query`, construct a Mongoose query dynamically, apply filtering, projection, sorting, skip and limit only when required, and finally execute the query using await."

Conceptually:

```typescript
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
```

---

# MOST IMPORTANT INDEX QUESTION

## "How did you verify that your index is actually being used?"

Answer:

> "I used MongoDB's `explain('executionStats')` on the query and checked the execution plan. For the compound query on goal and sex, the plan showed `IXSCAN`, confirming that MongoDB was using an index."

---

# COMMON FOLLOW-UP QUESTIONS

An interviewer may continue with:

### "What happens if the index doesn't exist?"

Potentially MongoDB may perform a `COLLSCAN`, depending on the query and available indexes.

### "Does an index always make a query faster?"

Not necessarily. The benefit depends on the query, data distribution, collection size, selectivity, and chosen index. Indexes also have storage and write costs.

### "Does `goal: 1` mean results are sorted by goal?"

No.

`1` specifies index ordering. Query result ordering is controlled using `.sort()` when sorting is requested.

### "Can a compound index support a query on its second field only?"

Generally not efficiently when the first field is omitted because of the left-prefix principle.

### "Why do you need pagination?"

To prevent returning excessive amounts of data in a single request and to reduce resource usage.

### "Why projection?"

To return only required fields, reducing unnecessary data transfer and avoiding unnecessary field exposure.

### "Why centralized error handling?"

For consistent error responses and to avoid duplicated error-handling logic.

### "Why service layer?"

For separation of concerns, reuse, maintainability, and testability.

---

# QUICK REVISION — ONE-LINE DEFINITIONS

```text
Node.js
→ JavaScript runtime for server-side execution.

TypeScript
→ Statically typed superset of JavaScript.

HTTP
→ Protocol for client-server communication.

Express
→ Node.js web framework for APIs and servers.

Middleware
→ Function executed during the request-response cycle.

Route
→ Maps an HTTP method/path to a handler.

Controller
→ Handles HTTP request/response logic.

Service
→ Contains application/business logic.

Model
→ Interface for interacting with database data.

MongoDB
→ NoSQL document-oriented database.

MongoDB Atlas
→ Cloud-hosted MongoDB service.

Mongoose
→ ODM for MongoDB and Node.js.

Schema
→ Defines document structure and validation.

CRUD
→ Create, Read, Update, Delete.

Filtering
→ Retrieving documents matching conditions.

Sorting
→ Ordering query results.

Pagination
→ Returning data in smaller pages.

Projection
→ Selecting only required fields.

Index
→ Data structure that improves data lookup.

Compound Index
→ Index containing multiple fields.

Left-Prefix Rule
→ Compound indexes are most useful starting from leading fields.

IXSCAN
→ Index scan.

COLLSCAN
→ Collection scan.

explain()
→ Tool for analyzing query execution.
```

---

# DAY 1–6 FINAL CHECKLIST

## Day 1

* [x] Node.js
* [x] Backend basics
* [x] npm
* [x] TypeScript
* [x] TypeScript compilation
* [x] `tsconfig.json`
* [x] `src`
* [x] `dist`
* [x] Node execution

## Day 2

* [x] HTTP
* [x] Request
* [x] Response
* [x] HTTP methods
* [x] Status codes
* [x] Native Node HTTP server
* [x] Express
* [x] Express application
* [x] `express.json()`
* [x] Request body
* [x] Route parameters
* [x] Query parameters
* [x] Basic routing
* [x] 404 handling

## Day 3

* [x] Middleware
* [x] `next()`
* [x] Logger middleware
* [x] Route separation
* [x] Controllers
* [x] Services
* [x] Models
* [x] Controller → Service flow
* [x] Centralized error handling
* [x] 404 middleware/handling
* [x] Backend architecture

## Day 4

* [x] MongoDB
* [x] NoSQL
* [x] MongoDB Atlas
* [x] Database
* [x] Collection
* [x] Document
* [x] MongoDB connection
* [x] Environment variables
* [x] Mongoose
* [x] Schema
* [x] Model
* [x] Validation
* [x] `required`
* [x] `trim`
* [x] `min`
* [x] `max`
* [x] `minlength`
* [x] `maxlength`
* [x] `enum`
* [x] CRUD
* [x] ObjectId validation
* [x] Filtering
* [x] Multiple filters
* [x] Sorting
* [x] Pagination

## Day 5

* [x] Projection
* [x] `.select()`
* [x] Fields query parameter
* [x] Query parameter parsing
* [x] Conditional query building
* [x] Query chaining
* [x] Query execution
* [x] `_id` projection behavior
* [x] Optional query parameters
* [x] Debugging empty `.sort()` issue

## Day 6

* [x] Indexes
* [x] Index advantages
* [x] Index disadvantages
* [x] Single-field index
* [x] Compound index
* [x] Index field order
* [x] Left-prefix rule
* [x] `IXSCAN`
* [x] `COLLSCAN`
* [x] `explain("executionStats")`
* [x] Index verification in Atlas
* [x] Compound index verification
* [x] Placement revision

---

# Final Interview Mindset

Do not only memorize definitions.

For every concept, be ready to answer these four things:

```text
1. What is it?
2. Why do we need it?
3. How did you implement it?
4. What trade-off/problem does it have?
```

Example:

```text
Index
 ↓
What?
Data structure for efficient lookup.

Why?
Improve query performance.

How?
userSchema.index({ goal: 1 });

Trade-off?
Storage + write overhead.
```

This approach should be followed for all upcoming FITFORGE concepts.

# Current Status

```text
Day 1 → COMPLETE
Day 2 → COMPLETE
Day 3 → COMPLETE
Day 4 → COMPLETE
Day 5 → COMPLETE
Day 6 → COMPLETE

Current Stage:
MongoDB + Express Backend Fundamentals COMPLETE

Next:
Day 7 — Advanced MongoDB Querying/Search
```
