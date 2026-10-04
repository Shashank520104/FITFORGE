# Day 11 — API Security & Error Handling

## 1. Day 11 Goal

Learn how production-level backends handle errors safely and consistently.

Topics covered:

* Custom application errors
* Centralized error handling
* HTTP status codes
* Error leakage prevention
* Async error handling
* Express 5 async behavior
* Consistent API error responses
* Placement-level error handling concepts

---

# 2. Why Error Handling Matters

A backend should not:

* crash because of a normal request error
* return `500` for every problem
* expose database or server details to clients
* duplicate error-handling logic in every controller

Instead, errors should be:

1. Detected
2. Classified
3. Passed to centralized error handling
4. Converted into the correct HTTP response
5. Logged safely on the server

---

# 3. Normal Error vs AppError

A normal JavaScript error:

```typescript
throw new Error("Something went wrong");
```

mainly contains an error message.

The problem is that the error does not tell our API which HTTP status code should be returned.

For example:

* Duplicate email → `409`
* Invalid authentication → `401`
* Permission denied → `403`

To solve this, FITFORGE uses a custom `AppError`.

---

# 4. AppError

File:

```text
src/utils/AppError.ts
```

Implementation:

```typescript
class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;

    this.name = "AppError";
  }
}

export default AppError;
```

Usage:

```typescript
throw new AppError("Email already registered", 409);
```

Another example:

```typescript
throw new AppError("Invalid email or password", 401);
```

## Why AppError?

It allows us to carry:

```text
message + HTTP status code
```

inside the error object.

The centralized error middleware can then decide how to respond.

---

# 5. Centralized Error Middleware

File:

```text
src/middlewares/error.middleware.ts
```

Current implementation:

```typescript
import { Request, Response, NextFunction } from "express";
import AppError from "../utils/AppError.js";

const errorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(err);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message
    });
    return;
  }

  if (err.name === "ValidationError") {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: Object.values(err.errors).map(
        (error: any) => error.message
      )
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: "Internal Server Error"
  });
};

export default errorMiddleware;
```

---

# 6. Error Handling Order

The middleware handles errors in this order:

```text
AppError
   ↓
Mongoose ValidationError
   ↓
Unknown Error
   ↓
500 Internal Server Error
```

This allows known errors to receive appropriate responses.

Unknown errors fall back to `500`.

---

# 7. HTTP Status Codes

## 400 — Bad Request

Used when the request contains invalid input.

Examples:

```text
Invalid age
Invalid goal
Password too short
Missing required field
```

Example:

```json
{
  "success": false,
  "message": "Password must be at least 6 characters"
}
```

---

## 401 — Unauthorized

Used when authentication is missing or invalid.

Examples:

```text
Missing token
Invalid token
Expired token
Wrong login credentials
```

Example:

```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

Important:

`401` means the server cannot authenticate the request.

---

## 403 — Forbidden

Used when the user is authenticated but does not have permission.

Example:

```text
Normal user accessing admin route
```

Response:

```json
{
  "success": false,
  "message": "Access denied"
}
```

---

## 409 — Conflict

Used when the request conflicts with an existing resource/state.

Example:

```text
Email already registered
```

Response:

```json
{
  "success": false,
  "message": "Email already registered"
}
```

---

## 500 — Internal Server Error

Used for unexpected server-side failures.

Example:

```text
Unexpected database error
Unexpected programming error
Unknown server failure
```

Client receives:

```json
{
  "success": false,
  "message": "Internal Server Error"
}
```

---

# 8. Status Code Quick Revision

| Status | Meaning               | FITFORGE Example               |
| ------ | --------------------- | ------------------------------ |
| 400    | Bad Request           | Invalid input                  |
| 401    | Unauthorized          | Invalid/missing authentication |
| 403    | Forbidden             | User accessing admin route     |
| 409    | Conflict              | Duplicate email                |
| 500    | Internal Server Error | Unexpected server failure      |

---

# 9. Duplicate Email Error

Before AppError:

```typescript
throw new Error("Email already registered");
```

This could eventually become a `500` response because the error did not contain a status code.

After AppError:

```typescript
throw new AppError("Email already registered", 409);
```

Now:

```text
Service
   ↓
AppError
   ↓
Error Middleware
   ↓
409 Conflict
```

This correctly represents the problem.

---

# 10. Invalid Login Error

For invalid credentials:

```typescript
throw new AppError("Invalid email or password", 401);
```

Both cases use the same message:

```text
Invalid email or password
```

Whether:

```text
Email doesn't exist
```

or:

```text
Password is incorrect
```

the client receives the same message.

---

# 11. Security — Preventing User Enumeration

Do NOT return:

```text
Email does not exist
```

because an attacker could test different emails and discover which accounts exist.

Instead return:

```text
Invalid email or password
```

This prevents unnecessary information leakage.

---

# 12. Error Leakage

Never expose internal server details to clients.

Bad:

```json
{
  "success": false,
  "message": "MongoServerError: E11000 duplicate key..."
}
```

This could expose:

* database details
* collection information
* implementation details
* stack traces
* internal infrastructure information

Instead:

```json
{
  "success": false,
  "message": "Internal Server Error"
}
```

---

# 13. Server Logging vs Client Response

The server can log the detailed error:

```typescript
console.error(err);
```

But the client receives a controlled response.

Architecture:

```text
Actual Error
     |
     +------> Server Logs
     |
     +------> Error Middleware
                  |
                  ↓
             Safe Response
                  |
                  ↓
                Client
```

Interview answer:

> We log detailed errors on the server for debugging and monitoring, but return controlled responses to clients to avoid leaking sensitive internal information.

---

# 14. Consistent API Error Response

FITFORGE follows a consistent basic error structure:

```json
{
  "success": false,
  "message": "Error message"
}
```

For validation errors, additional details may be returned:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    "Age must be between 13 and 100"
  ]
}
```

## Why consistency matters?

Frontend developers can handle errors predictably.

Instead of checking many different response structures, the frontend can rely on:

```text
success
message
```

---

# 15. Async Error Handling

FITFORGE controllers are asynchronous:

```typescript
export const registerUser = async (req: Request, res: Response) => {
  const user = await registerUserService(req.body);

  res.status(200).json({
    success: true,
    message: "Register controller working",
    data: user
  });
};
```

The service may throw an error:

```typescript
throw new AppError("Email already registered", 409);
```

The error needs to reach the centralized error middleware.

---

# 16. Express 5 Async Error Handling

FITFORGE uses:

```text
Express 5.2.1
```

Express 5 automatically forwards rejected Promises from async route handlers/middleware to the error-handling middleware.

Therefore FITFORGE does not currently need an `asyncHandler` wrapper for every controller.

Flow:

```text
Async Controller
      ↓
await Service
      ↓
Promise rejection
      ↓
Express 5
      ↓
Error Middleware
      ↓
Response
```

---

# 17. Older Express Versions

Older Express versions commonly required an async wrapper.

Concept:

```typescript
const asyncHandler = (fn: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
```

The wrapper forwards rejected Promises to:

```typescript
next(error)
```

Then the centralized error middleware handles them.

Important interview point:

> Don't blindly use an async wrapper without understanding the Express version. Express 5 already handles rejected Promises from async route handlers.

---

# 18. Complete Error Flow in FITFORGE

```text
Client Request
      ↓
Validation Middleware
      ↓
Authentication Middleware
      ↓
Authorization Middleware
      ↓
Controller
      ↓
Service
      ↓
Database
      ↓
Error
      ↓
AppError / Mongoose Error / Unknown Error
      ↓
Centralized Error Middleware
      ↓
Correct HTTP Status
      ↓
Consistent JSON Response
```

---

# 19. Example — Duplicate Email

Request:

```text
POST /api/v1/auth/register
```

Service:

```typescript
if (existingUser) {
  throw new AppError("Email already registered", 409);
}
```

Error middleware:

```text
AppError
    ↓
statusCode = 409
    ↓
res.status(409)
```

Response:

```json
{
  "success": false,
  "message": "Email already registered"
}
```

---

# 20. Example — Wrong Password

Service:

```typescript
if (!isPasswordCorrect) {
  throw new AppError("Invalid email or password", 401);
}
```

Response:

```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

HTTP status:

```text
401 Unauthorized
```

---

# 21. Authentication vs Authorization

Authentication:

> Who are you?

Authorization:

> What are you allowed to do?

Example:

```text
Login
↓
Authentication

Admin route access
↓
Authorization
```

---

# 22. 401 vs 403

### 401

User is not properly authenticated.

Examples:

```text
No JWT
Invalid JWT
Expired JWT
Wrong credentials
```

### 403

User is authenticated but does not have permission.

Example:

```text
Logged-in user → /admin-test
Role = user
Required role = admin
```

Response:

```text
403 Forbidden
```

---

# 23. Important Architecture Principle

Business logic should not be tightly coupled with response formatting.

Bad approach:

```typescript
service → res.status(...)
```

Better:

```text
Service
  ↓
throw AppError
  ↓
Error Middleware
  ↓
HTTP Response
```

This keeps responsibilities separated.

---

# 24. Separation of Responsibilities

### Middleware

Handles:

```text
Validation
Authentication
Authorization
Request-level checks
```

### Controller

Handles:

```text
HTTP request
Calling service
HTTP success response
```

### Service

Handles:

```text
Business logic
Database operations
Business errors
```

### Error Middleware

Handles:

```text
Error classification
Status code
Safe error response
```

---

# 25. Placement Interview Questions

## Q1. Why do you need centralized error handling?

**Answer:**

> Centralized error handling prevents duplicate error-response logic across controllers and provides a consistent API response format.

---

## Q2. Why create AppError?

**Answer:**

> A normal Error mainly contains a message. AppError also contains an HTTP status code, allowing the centralized error middleware to return the appropriate HTTP response.

---

## Q3. Why is duplicate email a 409 instead of 500?

**Answer:**

> Because duplicate email is a known conflict with an existing resource. It is an expected client/request-level condition, not an unexpected server failure.

---

## Q4. Difference between 400 and 409?

**Answer:**

> 400 means the request itself is invalid. 409 means the request can be valid but conflicts with the current state of the resource.

---

## Q5. Difference between 401 and 403?

**Answer:**

> 401 means authentication is missing or invalid. 403 means the user is authenticated but does not have sufficient permission.

---

## Q6. Why shouldn't you expose `err.message` for every error?

**Answer:**

> Internal errors may contain database details, stack traces, or implementation information. These details can create security risks, so unexpected errors should return a controlled response.

---

## Q7. Where should detailed errors be logged?

**Answer:**

> Detailed errors should be logged on the server for debugging and monitoring, while the client should receive a safe and controlled response.

---

## Q8. Why use the same login error message for invalid email and invalid password?

**Answer:**

> It prevents user/account enumeration because attackers cannot determine whether a specific email is registered.

---

## Q9. How does Express 5 handle async errors?

**Answer:**

> Express 5 automatically forwards rejected Promises from async route handlers and middleware to the error-handling middleware.

---

## Q10. What would you do with older Express versions?

**Answer:**

> I would use an async wrapper that catches Promise rejections and forwards them using `next(error)`.

---

## Q11. Why should services not directly send HTTP responses?

**Answer:**

> Services should focus on business logic. Keeping HTTP response handling in controllers and centralized error middleware improves separation of concerns and testability.

---

## Q12. What happens when an unknown error reaches your error middleware?

**Answer:**

> It falls back to HTTP 500 and returns a generic `Internal Server Error` response while the detailed error is logged on the server.

---

# 26. One-Minute Interview Explanation

> FITFORGE uses centralized error handling with a custom AppError class. AppError stores both the error message and HTTP status code. Services throw appropriate application errors, and the centralized error middleware converts them into consistent HTTP responses. I use status codes based on the nature of the failure, such as 400 for invalid input, 401 for authentication failures, 403 for authorization failures, 409 for resource conflicts, and 500 for unexpected server errors. Detailed errors are logged on the server, while sensitive internal information is not exposed to clients. Since FITFORGE uses Express 5, rejected Promises from async controllers are automatically forwarded to the error middleware.

---

# 27. Day 11 Final Revision

Remember these five things:

```text
1. AppError
   ↓
   message + statusCode

2. Centralized error middleware
   ↓
   one place for error responses

3. Correct status codes
   ↓
   400 / 401 / 403 / 409 / 500

4. Don't leak internal errors
   ↓
   detailed logs → server
   safe response → client

5. Express 5
   ↓
   async rejected Promises → error middleware
```

---

# 28. Day 11 Completion Checklist

* [x] Understood error handling architecture
* [x] Created AppError
* [x] Added status codes to application errors
* [x] Created centralized error handling
* [x] Converted duplicate email to 409
* [x] Converted invalid login to 401
* [x] Tested duplicate email
* [x] Tested invalid login
* [x] Understood 400 / 401 / 403 / 409 / 500
* [x] Understood error leakage prevention
* [x] Understood account enumeration prevention
* [x] Understood async error handling
* [x] Verified Express 5.2.1 behavior
* [x] Understood consistent API error responses
* [x] Prepared placement interview answers

# Day 11 Complete
