# FITFORGE — Day 3: Backend Architecture

## 1. What I Learned Today

Today I refactored the FITFORGE backend from a single-file Express application into a layered backend architecture.

The main goal was **Separation of Concerns** — each part of the backend should have one clear responsibility.

### Architecture

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
Database / Model
   ↓
Service
   ↓
Controller
   ↓
Response
```

Currently, FITFORGE does not have a database yet, so the flow is:

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
Controller
   ↓
Response
```

---

# 2. Why Do We Need Backend Architecture?

Initially, all API routes and their logic were inside `index.ts`.

Example:

```typescript
app.post("/api/v1/users", (req, res) => {
  // logic
});
```

This works for a small project, but as the application grows, `index.ts` becomes difficult to maintain.

A real backend can have:

* Hundreds of API endpoints
* Authentication
* Validation
* Database operations
* Business logic
* Error handling
* Logging
* External API calls

Keeping everything in one file creates tightly coupled and difficult-to-maintain code.

Therefore, we separate responsibilities.

---

# 3. Middleware

## What is Middleware?

Middleware is a function that executes during the request-response lifecycle.

```typescript
(req, res, next)
```

Example:

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

### What are `req`, `res`, and `next`?

* `req` → incoming request
* `res` → response that will be sent to the client
* `next()` → passes control to the next middleware or route

If `next()` is not called and no response is sent, the request can get stuck.

---

## Logger Middleware

FITFORGE has a separate logger middleware:

```text
src/
└── middlewares/
    └── logger.middleware.ts
```

It logs:

```text
GET /health
POST /api/v1/users
GET /api/v1/workouts
```

This keeps logging logic outside `index.ts`.

---

# 4. Routes

## What is a Route?

A route determines **which controller should handle a particular HTTP request**.

Instead of keeping all user routes inside `index.ts`, FITFORGE uses:

```text
src/
└── routes/
    ├── user.routes.ts
    └── workout.routes.ts
```

Example:

```typescript
router.post("/", createUser);
router.get("/:id", getUser);
router.patch("/:id", updateUser);
```

The main application mounts the router:

```typescript
app.use("/api/v1/users", userRoutes);
```

Therefore:

```text
/api/v1/users + /
        ↓
/api/v1/users
```

and:

```text
/api/v1/users + /:id
        ↓
/api/v1/users/:id
```

### Interview Answer

> A router groups related endpoints and maps HTTP requests to the appropriate controller. This keeps the main application file clean and makes the API easier to maintain.

---

# 5. Controllers

## What is a Controller?

A controller handles the HTTP request and response.

Example:

```typescript
export const createUser = (req: Request, res: Response) => {
  const user = createUserService(req.body);

  res.status(201).json({
    success: true,
    message: "User created successfully",
    data: user
  });
};
```

The controller:

1. Receives the request
2. Extracts required data
3. Calls the service
4. Sends the HTTP response

---

## Thin Controller Principle

Controllers should remain relatively thin.

Bad architecture:

```text
Controller
 ├── validation
 ├── business logic
 ├── database queries
 ├── calculations
 └── response
```

Better:

```text
Controller
   ↓
Service
   ↓
Model / Database
```

### Interview Answer

> Controllers should mainly deal with HTTP concerns such as request parameters, request body, status codes and responses. Business logic should preferably be kept in the service layer.

---

# 6. Service Layer

## What is a Service?

The service layer contains the application's business logic.

FITFORGE currently has:

```text
src/
└── services/
    ├── user.service.ts
    └── workout.service.ts
```

Example:

```typescript
export const createUserService = (userData: object) => {
  return userData;
};
```

Currently the service is intentionally simple because MongoDB has not been introduced yet.

Later the service can handle operations such as:

```text
Create user
Validate business rules
Calculate workout volume
Calculate calories
Apply progressive overload rules
Fetch user progress
Update transformation data
```

---

# 7. Controller vs Service

This is an important interview question.

### Controller

Responsible for:

```text
HTTP request
HTTP response
Status codes
Request parameters
Request body
```

### Service

Responsible for:

```text
Business logic
Application rules
Calculations
Database interaction through models/repositories
```

Simple example:

```text
POST /users
      ↓
Controller
      ↓
createUserService()
      ↓
Business logic
      ↓
Database
```

### Interview Answer

> The controller is responsible for handling HTTP-level concerns, while the service layer contains reusable business logic. This separation improves maintainability, testing and reusability.

---

# 8. Error Handling

FITFORGE uses centralized error handling.

File:

```text
src/middlewares/error.middleware.ts
```

Example:

```typescript
const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(err);

  res.status(500).json({
    success: false,
    message: "Internal Server Error"
  });
};
```

It is registered after the routes:

```typescript
app.use(errorMiddleware);
```

### Why?

Instead of writing error handling repeatedly inside every controller:

```typescript
try {
  // logic
} catch (error) {
  // send response
}
```

we can centralize error handling.

An error can be forwarded using:

```typescript
next(error);
```

Express then passes the error to the error-handling middleware.

---

# 9. Why Does Error Middleware Have 4 Parameters?

Normal middleware:

```typescript
(req, res, next)
```

Error middleware:

```typescript
(err, req, res, next)
```

The first `err` parameter tells Express that this middleware is an error handler.

### Interview Question

**Q: How does Express identify error-handling middleware?**

**Answer:**

> Express identifies error-handling middleware by its four-argument signature: `(err, req, res, next)`.

---

# 10. 404 Handling

FITFORGE also has a fallback middleware:

```typescript
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});
```

If no previous route matches the request, this middleware sends a `404`.

Example:

```text
GET /api/v1/unknown
        ↓
No matching route
        ↓
404 Route Not Found
```

---

# 11. Middleware Order Matters

Express processes middleware in the order in which it is registered.

FITFORGE currently follows:

```text
Logger Middleware
        ↓
JSON Parser
        ↓
Basic Routes
        ↓
User Routes
        ↓
Workout Routes
        ↓
404 Handler
        ↓
Error Handler
```

This order is important.

For example, the error middleware should be registered after the routes so that errors can flow to it.

---

# 12. Current FITFORGE Folder Structure

```text
src/
├── controllers/
│   ├── user.controller.ts
│   └── workout.controller.ts
│
├── services/
│   ├── user.service.ts
│   └── workout.service.ts
│
├── routes/
│   ├── user.routes.ts
│   └── workout.routes.ts
│
├── middlewares/
│   ├── logger.middleware.ts
│   └── error.middleware.ts
│
└── index.ts
```

Future architecture:

```text
src/
├── controllers/
├── services/
├── routes/
├── models/
├── middlewares/
├── utils/
├── validators/
└── index.ts
```

---

# 13. Complete Request Flow

For creating a user:

```text
POST /api/v1/users
        ↓
Logger Middleware
        ↓
User Router
        ↓
createUser Controller
        ↓
createUserService()
        ↓
Database / User Model (future)
        ↓
Service
        ↓
Controller
        ↓
201 Created
```

For fetching a workout:

```text
GET /api/v1/workouts?muscle=back&difficulty=hard
        ↓
Logger Middleware
        ↓
Workout Router
        ↓
getWorkouts Controller
        ↓
getWorkoutsService()
        ↓
Controller
        ↓
JSON Response
```

---

# 14. Why This Architecture Is Better

### Before

```text
index.ts
 ├── routes
 ├── request handling
 ├── business logic
 ├── errors
 └── responses
```

### After

```text
index.ts
   ↓
Routes
   ↓
Controllers
   ↓
Services
   ↓
Models
```

Benefits:

* Separation of concerns
* Easier debugging
* Easier testing
* Easier scaling
* Better code organization
* Reusable business logic
* Cleaner `index.ts`
* Easier team collaboration

---

# 15. Interview Questions From Day 3

### Q1. Why do we separate routes from controllers?

> Routes define endpoint mapping, while controllers handle the request and response. This separation keeps routing and application logic independent.

### Q2. What is middleware?

> Middleware is a function that executes during the request-response lifecycle and can modify the request/response, perform operations, or pass control using `next()`.

### Q3. What happens if `next()` is not called?

> If the middleware doesn't send a response and doesn't call `next()`, the request can remain pending.

### Q4. What is the purpose of a service layer?

> The service layer contains business logic and keeps controllers thin and focused on HTTP concerns.

### Q5. Why centralized error handling?

> It avoids repetitive error-handling code and provides a consistent error response across the application.

### Q6. Why is error middleware placed after routes?

> Express processes middleware sequentially. Errors forwarded using `next(error)` need to reach the error-handling middleware after the relevant routes.

### Q7. What is separation of concerns?

> It means dividing an application into components where each component has a specific responsibility.

### Q8. What is a thin controller?

> A controller that mainly handles HTTP-level operations and delegates business logic to services.

### Q9. What is the role of `index.ts` now?

> It initializes Express, registers global middleware, mounts routers, registers error handling and starts the server.

### Q10. What will change when MongoDB is added?

Current:

```text
Controller → Service → Response
```

Future:

```text
Controller
   ↓
Service
   ↓
Model
   ↓
MongoDB
```

The controller and route structure can remain mostly unchanged while the service/model layer gains database functionality.

---

# 16. Key Takeaway

The main lesson of Day 3:

> **Don't put everything inside `index.ts`.**

A scalable backend separates:

```text
Middleware → Common request processing
Routes     → Endpoint mapping
Controllers → HTTP handling
Services   → Business logic
Models     → Database interaction
```

This makes the backend easier to **understand, test, maintain and scale**.

---

## Day 3 Status

* [x] Middleware
* [x] Logger middleware
* [x] Separate route files
* [x] User routes
* [x] Workout routes
* [x] Controllers
* [x] Services
* [x] Controller → Service flow
* [x] Centralized error handling
* [x] 404 handling
* [x] `index.ts` cleanup
* [x] API testing
* [ ] Git commit and push

**Day 3 implementation is ready for final Git commit after final testing.**
