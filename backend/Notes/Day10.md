# FITFORGE Backend — Day 10

## Topic: RBAC & Authorization

---

# 1. Day 10 Goal

Day 8 mein humne Authentication implement kiya tha.

Authentication answers:

> **Who are you?**

Day 10 mein humne Authorization implement kiya.

Authorization answers:

> **What are you allowed to do?**

FITFORGE mein humne Role-Based Access Control (RBAC) implement kiya.

---

# 2. Authentication vs Authorization

## Authentication

Authentication verifies the identity of the user.

Example:

```text
JWT valid hai?
        ↓
YES
        ↓
User authenticated
```

Example:

```text
POST /login
```

User email/password deta hai.

Agar credentials correct hain, server JWT issue karta hai.

---

## Authorization

Authorization checks whether an authenticated user has permission to access a resource.

Example:

```text
User authenticated hai
        ↓
Role = user
        ↓
Admin route access kar raha hai
        ↓
Permission nahi hai
        ↓
403 Forbidden
```

### Simple Difference

```text
Authentication → Who are you?

Authorization → What can you access?
```

---

# 3. What is RBAC?

RBAC means:

> Role-Based Access Control

Access permissions are based on the user's role.

FITFORGE roles:

```text
user
trainer
admin
```

Example:

```text
user
→ Own profile
→ Workout logging
→ Nutrition logging
→ Progress tracking

trainer
→ Client-related operations
→ Workout plan management

admin
→ System-level management
→ User management
```

---

# 4. Adding Role to User Model

File:

```text
src/models/user.model.ts
```

We added:

```typescript
role: {
  type: String,
  enum: ["user", "trainer", "admin"],
  default: "user"
}
```

### Meaning

`enum` restricts the role to:

```text
user
trainer
admin
```

`default: "user"` means a newly created user becomes a normal user unless the backend explicitly assigns another role.

---

# 5. Why Default Role is `user`

Normal registration should not allow a client to make itself an admin.

For example, a malicious client could try:

```json
{
  "name": "Hacker",
  "email": "hacker@test.com",
  "password": "password123",
  "role": "admin"
}
```

Our registration service does not take `role` from the client.

The service creates the user using controlled fields:

```typescript
const user = await User.create({
  name: data.name,
  email: data.email,
  password: hashedPassword,
  age: data.age,
  sex: data.sex,
  weight: data.weight,
  height: data.height,
  goal: data.goal
});
```

Therefore Mongoose applies:

```text
default role = user
```

This prevents normal registration from directly assigning privileged roles.

---

# 6. Adding Role to JWT

Earlier JWT payload:

```typescript
{
  userId: user._id
}
```

Day 10:

```typescript
{
  userId: user._id,
  role: user.role
}
```

The JWT is created during login:

```typescript
const token = jwt.sign(
  {
    userId: user._id,
    role: user.role
  },
  process.env.JWT_SECRET as string,
  {
    expiresIn: "1d"
  }
);
```

Now the authenticated request can know the user's role from the verified JWT payload.

Example payload:

```json
{
  "userId": "123456",
  "role": "admin"
}
```

JWT also contains standard fields such as:

```text
iat → issued at
exp → expiration
```

---

# 7. Authorization Middleware

File:

```text
src/middlewares/role.middleware.ts
```

Code:

```typescript
import { Request, Response, NextFunction } from "express";

const roleMiddleware = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {

    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required"
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role as string)) {
      res.status(403).json({
        success: false,
        message: "Access denied"
      });
      return;
    }

    next();
  };
};

export default roleMiddleware;
```

---

# 8. How `roleMiddleware()` Works

The middleware accepts an array of allowed roles.

Example:

```typescript
roleMiddleware(["admin"])
```

Means:

> Only admin users are allowed.

Another example:

```typescript
roleMiddleware(["admin", "trainer"])
```

Means:

> Both admin and trainer users are allowed.

---

# 9. Why `allowedRoles` is an Array

Using an array makes the middleware reusable.

Instead of creating separate middleware for every role, we can use:

```typescript
roleMiddleware(["admin"])
```

or:

```typescript
roleMiddleware(["trainer"])
```

or:

```typescript
roleMiddleware(["admin", "trainer"])
```

Same middleware, different permissions.

---

# 10. `req.user` Check

The authorization middleware first checks:

```typescript
if (!req.user)
```

If there is no authenticated user:

```text
401 Authentication required
```

This normally means the authentication middleware did not successfully authenticate the request.

---

# 11. Role Check

After authentication:

```typescript
if (!allowedRoles.includes(req.user.role as string))
```

checks whether the user's role exists in the allowed roles.

Example:

```text
allowedRoles = ["admin"]

req.user.role = "user"
```

Result:

```text
"user" exists in ["admin"]?
        ↓
No
        ↓
403 Forbidden
```

---

# 12. `next()`

If the role is allowed:

```typescript
next();
```

is called.

Flow:

```text
Authentication
      ↓
Authorization
      ↓
Role allowed
      ↓
next()
      ↓
Controller
```

---

# 13. Applying Authorization to a Route

In:

```text
src/routes/auth.routes.ts
```

we imported:

```typescript
import roleMiddleware from "../middlewares/role.middleware.js";
```

Admin-only route:

```typescript
router.get(
  "/admin-test",
  authMiddleware,
  roleMiddleware(["admin"]),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: "Welcome Admin"
    });
  }
);
```

---

# 14. Middleware Order

The order is important:

```text
authMiddleware
        ↓
roleMiddleware
        ↓
Controller
```

Correct:

```typescript
authMiddleware,
roleMiddleware(["admin"]),
controller
```

Why?

Authorization needs to know:

```text
Who is the user?
What is the user's role?
```

Authentication creates/populates `req.user` first.

Then authorization checks that information.

---

# 15. Complete Request Flow

For an admin-only API:

```text
Client
  ↓
Request
  ↓
authMiddleware
  ↓
JWT verification
  ↓
req.user
  ↓
roleMiddleware(["admin"])
  ↓
Role check
  ↓
Controller
  ↓
Response
```

---

# 16. 401 vs 403

This is a very important interview topic.

## 401 Unauthorized

Used when authentication is missing or invalid.

Examples:

```text
No JWT
Invalid JWT
Expired JWT
```

Meaning:

> User is not successfully authenticated.

---

## 403 Forbidden

Used when authentication is successful but the user does not have permission.

Example:

```text
JWT valid
role = user
required role = admin
```

Result:

```text
403 Forbidden
```

### Easy way to remember

```text
401 → Authentication problem

403 → Authorization/permission problem
```

---

# 17. Day 10 Testing

## Test 1 — Normal User

User role:

```text
user
```

Request:

```text
GET /api/v1/auth/admin-test
```

JWT:

```text
Valid
```

But required role:

```text
admin
```

Result:

```json
{
  "success": false,
  "message": "Access denied"
}
```

Status:

```text
403 Forbidden
```

---

## Test 2 — Admin

We changed the test user's database role:

```text
user → admin
```

Then logged in again to generate a new JWT.

New JWT contained:

```text
role = admin
```

Admin route:

```text
GET /api/v1/auth/admin-test
```

Result:

```json
{
  "success": true,
  "message": "Welcome Admin"
}
```

Therefore RBAC was successfully tested.

---

# 18. Why We Needed a New JWT After Changing Role

JWT contains the role at login time.

For example:

```text
Old JWT
role = user
```

Database changes:

```text
user → admin
```

But old JWT still contains:

```text
role = user
```

Therefore we logged in again.

New JWT:

```text
role = admin
```

Now authorization succeeds.

---

# 19. Security Principle

Never trust the role sent directly by the client.

Bad approach:

```json
{
  "role": "admin"
}
```

from client → automatically make user admin.

Instead:

```text
Server-controlled role
        ↓
Database
        ↓
JWT
        ↓
Authorization middleware
```

Privileged roles should be assigned through trusted backend/admin processes.

---

# 20. Authentication + Authorization Architecture

FITFORGE now has:

```text
Client
  ↓
Authentication
  ↓
JWT verification
  ↓
Authorization
  ↓
Role check
  ↓
Controller
  ↓
Service
  ↓
Database
```

Example:

```text
GET /admin/users
        ↓
authMiddleware
        ↓
roleMiddleware(["admin"])
        ↓
Admin Controller
        ↓
Admin Service
        ↓
MongoDB
```

---

# 21. Placement Interview Questions

## Q1. What is the difference between authentication and authorization?

**Answer:**

Authentication verifies the identity of the user, while authorization determines whether that authenticated user has permission to access a resource.

---

## Q2. What is RBAC?

**Answer:**

RBAC stands for Role-Based Access Control. It controls access to resources based on predefined user roles such as user, trainer, and admin.

---

## Q3. Why do we use middleware for authorization?

**Answer:**

Authorization is a cross-cutting concern. Middleware allows us to check permissions before the request reaches the controller, so the same authorization logic can be reused across multiple routes.

---

## Q4. Why do we check authentication before authorization?

**Answer:**

Authorization needs to know who the user is and what role they have. Therefore the JWT must first be verified and `req.user` populated before checking the user's role.

---

## Q5. What is the difference between 401 and 403?

**Answer:**

401 means the request is not successfully authenticated, while 403 means the user is authenticated but does not have permission to access the resource.

---

## Q6. Why is `role` included in the JWT?

**Answer:**

After verifying the JWT, the backend can access the user's role from the trusted signed token and use it for authorization checks.

---

## Q7. Why shouldn't the client be allowed to choose its role during registration?

**Answer:**

Otherwise a malicious client could send `"role": "admin"` and obtain privileges it should not have. Privileged roles must be controlled by the backend.

---

## Q8. Why do we use `allowedRoles` as an array?

**Answer:**

It makes the middleware reusable. The same middleware can allow one role or multiple roles, for example `["admin"]` or `["admin", "trainer"]`.

---

## Q9. What happens when the role does not match?

**Answer:**

The authorization middleware returns `403 Forbidden` and stops the request from reaching the controller.

---

## Q10. Why do we need a new JWT after changing a user's role?

**Answer:**

Because the JWT contains the role that existed when the token was issued. Changing the database role does not automatically modify an already-issued JWT.

---

## Q11. What does `next()` do in authorization middleware?

**Answer:**

If the user has the required permission, `next()` passes control to the next middleware or controller.

---

## Q12. Can RBAC work without JWT?

**Answer:**

Yes. RBAC is an authorization concept and can work with sessions or other authentication mechanisms. JWT is just the authentication mechanism we are currently using in FITFORGE.

---

# 22. One-Minute Interview Explanation

If the interviewer asks:

> "Explain how you implemented authorization in FITFORGE."

Answer:

> "I implemented role-based access control using Express middleware. Users have roles such as user, trainer, and admin. During login, the user's role is included in the signed JWT. The authentication middleware verifies the JWT and populates `req.user`. Then the authorization middleware receives an array of allowed roles and checks whether the authenticated user's role is permitted. If authentication fails, it returns 401, and if the user lacks permission, it returns 403. This middleware can be reused across different protected routes."

---

# Day 10 Final Takeaways

```text
Authentication
→ Who are you?

Authorization
→ What are you allowed to do?

RBAC
→ Permissions based on roles

Roles
→ user / trainer / admin

401
→ Authentication failure

403
→ Permission failure

authMiddleware
→ Verifies JWT

roleMiddleware
→ Checks role

next()
→ Allows request to continue
```

---

# Day 10 Achievement

```text
✅ Added role to User model
✅ Added user/trainer/admin roles
✅ Added default user role
✅ Added role to JWT
✅ Created authorization middleware
✅ Created reusable allowedRoles system
✅ Protected admin route
✅ Tested normal user → 403
✅ Tested admin → 200
✅ Understood 401 vs 403
✅ Understood authentication vs authorization
✅ Understood RBAC architecture
✅ Prepared placement interview questions
```

## Day 10 Status: COMPLETE ✅
