# FITFORGE — Day 8 Authentication

## Day 8 Goal

Today we implemented authentication in FITFORGE using:

* Authentication vs Authorization
* User registration
* Password hashing with bcrypt
* Password protection using `select: false`
* Login
* Password verification
* JWT generation
* JWT payload
* JWT secret
* JWT expiry
* Bearer token
* Authentication middleware
* JWT verification
* `req.user`
* Protected routes
* HTTP 401
* Basic authentication flow testing

---

# 1. Authentication vs Authorization

## Authentication

Authentication answers:

> "Who are you?"

Example:

A user logs into FITFORGE using:

```text
email
password
```

The backend verifies the credentials.

If correct, the backend knows who the user is.

---

## Authorization

Authorization answers:

> "What are you allowed to do?"

Example:

```text
User → Can access own workout
Trainer → Can manage assigned clients
Admin → Can manage users
```

Authentication comes first.

```text
Authentication
      ↓
Authorization
```

---

# 2. FITFORGE Authentication Flow

Complete flow:

```text
REGISTER

Client
  ↓
POST /api/v1/auth/register
  ↓
Controller
  ↓
Auth Service
  ↓
Check duplicate email
  ↓
Hash password using bcrypt
  ↓
Create User
  ↓
MongoDB
```

Login:

```text
LOGIN

Client
  ↓
POST /api/v1/auth/login
  ↓
Controller
  ↓
Auth Service
  ↓
Find user
  ↓
Get password using select("+password")
  ↓
bcrypt.compare()
  ↓
Password correct?
  ↓
JWT generated
  ↓
Token returned
```

Protected API:

```text
Client
  ↓
Authorization: Bearer <JWT>
  ↓
Authentication Middleware
  ↓
Extract token
  ↓
jwt.verify()
  ↓
req.user = decoded
  ↓
next()
  ↓
Controller
```

---

# 3. User Model Authentication Fields

We added:

```typescript
email: {
  type: String,
  required: true,
  unique: true,
  trim: true,
  lowercase: true
},
password: {
  type: String,
  required: true,
  minlength: 6,
  select: false
}
```

## Email

```typescript
unique: true
```

means duplicate email values are not intended to be allowed.

```typescript
lowercase: true
```

stores email in lowercase.

Example:

```text
TESTAUTH@TEST.COM
```

becomes:

```text
testauth@test.com
```

---

# 4. Why `select: false` for Password?

Password should not normally be returned whenever we fetch a user.

We used:

```typescript
select: false
```

Therefore:

```typescript
User.findOne({ email })
```

does not normally include the password field.

When login requires the password hash, we explicitly request it:

```typescript
User.findOne({ email }).select("+password");
```

This gives us the stored password hash only when required.

---

# 5. Registration

Endpoint:

```text
POST /api/v1/auth/register
```

Registration flow:

```text
Request
  ↓
Check email
  ↓
Check duplicate
  ↓
Hash password
  ↓
Create user
  ↓
Remove password from response
  ↓
Return safe user
```

---

# 6. Duplicate Email Check

Before creating a user:

```typescript
const existingUser = await User.findOne({
  email: data.email
});

if (existingUser) {
  throw new Error("Email already registered");
}
```

This prevents registering another account with the same email.

---

# 7. Password Hashing with bcrypt

We installed:

```text
bcrypt
@types/bcrypt
```

Password hashing:

```typescript
const hashedPassword = await bcrypt.hash(
  data.password,
  10
);
```

The `10` represents the bcrypt cost factor.

We never store the original password.

Instead:

```text
password123
      ↓
bcrypt
      ↓
hashed password
      ↓
MongoDB
```

---

# 8. Why Hash Passwords?

If passwords were stored directly:

```text
password: "password123"
```

anyone who gets database access could directly see the password.

With hashing:

```text
password123
      ↓
bcrypt
      ↓
hash
```

the original password is not directly stored.

---

# 9. Hashing vs Encryption

## Hashing

One-way operation.

```text
password
   ↓
hash
```

Normally we don't decrypt a password hash.

Instead, during login:

```text
entered password
       ↓
bcrypt.compare()
       ↓
stored hash
```

## Encryption

Encryption is generally reversible using a key.

Authentication passwords should generally be stored using a password hashing algorithm rather than reversible encryption.

---

# 10. Removing Password from Registration Response

After creating the user:

```typescript
const userObject = user.toObject();

const { password, ...safeUser } = userObject;

return safeUser;
```

This ensures the password hash is not returned to the client.

---

# 11. Login

Endpoint:

```text
POST /api/v1/auth/login
```

Example:

```json
{
  "email": "testauth@test.com",
  "password": "password123"
}
```

---

# 12. Finding User During Login

Because password has:

```typescript
select: false
```

we explicitly select it:

```typescript
const user = await User.findOne({
  email
}).select("+password");
```

---

# 13. Checking Whether User Exists

```typescript
if (!user) {
  throw new Error("Invalid email or password");
}
```

We use the same generic message for invalid email/password.

This avoids unnecessarily telling the client whether an email exists.

---

# 14. Password Verification

We use:

```typescript
const isPasswordCorrect = await bcrypt.compare(
  password,
  user.password
);
```

Important:

We do NOT decrypt the stored hash.

Instead:

```text
Entered password
       ↓
bcrypt.compare()
       ↓
Stored hash
       ↓
true / false
```

If incorrect:

```typescript
if (!isPasswordCorrect) {
  throw new Error("Invalid email or password");
}
```

---

# 15. JWT

JWT means:

```text
JSON Web Token
```

JWT allows the server to create a signed token representing authenticated information.

After successful login:

```text
email + password
      ↓
verified
      ↓
JWT
```

The client can then send this token with protected API requests.

---

# 16. JWT Structure

JWT generally contains three parts:

```text
Header.Payload.Signature
```

Example:

```text
xxxxx.yyyyy.zzzzz
```

## Header

Contains information such as the signing algorithm.

Example:

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

## Payload

Contains claims.

Our payload contains:

```json
{
  "userId": "..."
}
```

JWT also automatically contains timing information such as:

```text
iat
exp
```

## Signature

The signature is generated using the secret.

It allows the server to verify that the token was signed using the expected secret and has not been altered.

---

# 17. JWT Is Not Encryption

Important interview point:

> JWT payload is encoded, not encrypted by default.

Therefore sensitive information should not be placed inside the JWT payload.

Do NOT put:

```text
password
password hash
credit card information
```

inside the JWT.

---

# 18. JWT Secret

We added:

```env
JWT_SECRET=...
```

to `.env`.

The secret is used to sign and verify tokens.

Example:

```typescript
jwt.sign(
  payload,
  process.env.JWT_SECRET as string,
  options
);
```

The secret should not be committed to GitHub.

Our `.gitignore` contains:

```text
backend/.env
```

---

# 19. Generating JWT

Our implementation:

```typescript
const token = jwt.sign(
  {
    userId: user._id
  },
  process.env.JWT_SECRET as string,
  {
    expiresIn: "1d"
  }
);
```

Payload:

```typescript
{
  userId: user._id
}
```

Secret:

```typescript
process.env.JWT_SECRET
```

Expiration:

```text
1 day
```

---

# 20. Login Response

We return:

```typescript
return {
  user: safeUser,
  token
};
```

Therefore the client receives:

```json
{
  "user": {
    "_id": "...",
    "email": "testauth@test.com",
    "name": "Test User"
  },
  "token": "eyJ..."
}
```

Password is not returned.

---

# 21. Bearer Token

For protected APIs, the client sends:

```text
Authorization: Bearer <JWT>
```

Example:

```text
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

`Bearer` tells the server that the value after it is the authentication token.

---

# 22. Authentication Middleware

File:

```text
src/middlewares/auth.middleware.ts
```

Purpose:

> Verify the JWT before allowing access to a protected route.

---

# 23. Reading Authorization Header

We use:

```typescript
const authHeader = req.headers.authorization;
```

Expected header:

```text
Authorization: Bearer <token>
```

---

# 24. Checking Bearer Token

```typescript
if (
  !authHeader ||
  !authHeader.startsWith("Bearer ")
) {
  res.status(401).json({
    success: false,
    message: "Authentication required"
  });

  return;
}
```

If header is missing:

```text
401
```

If header does not start with:

```text
Bearer
```

also:

```text
401
```

---

# 25. Extracting Token

```typescript
const token = authHeader.split(" ")[1];
```

For:

```text
Bearer eyJhbGci...
```

splitting by space gives:

```text
[
  "Bearer",
  "eyJhbGci..."
]
```

Therefore:

```typescript
[1]
```

gives the actual JWT.

---

# 26. Verifying JWT

We use:

```typescript
const decoded = jwt.verify(
  token,
  process.env.JWT_SECRET as string
) as JwtPayload & {
  userId: string;
};
```

`jwt.verify()` checks whether:

* Token signature is valid
* Token was signed with the expected secret
* Token is not expired

If verification fails, an error is thrown.

---

# 27. Invalid Token Handling

```typescript
catch (error) {
  res.status(401).json({
    success: false,
    message: "Invalid or expired token"
  });

  return;
}
```

Therefore:

```text
Invalid token
      ↓
401
```

---

# 28. `req.user`

After successful verification:

```typescript
req.user = decoded;
```

This stores authenticated user information on the request.

Then:

```typescript
next();
```

passes the request to the next middleware/controller.

Flow:

```text
JWT
 ↓
verify
 ↓
decoded
 ↓
req.user
 ↓
next()
 ↓
controller
```

---

# 29. TypeScript Express Request Extension

Express's default `Request` type does not contain our custom `user` property.

We created:

```text
src/types/express.d.ts
```

with:

```typescript
import { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & {
        userId: string;
      };
    }
  }
}

export {};
```

Now TypeScript understands:

```typescript
req.user
```

---

# 30. Protected Route

We created:

```typescript
router.get(
  "/profile",
  authMiddleware,
  getProfile
);
```

The order matters.

First:

```typescript
authMiddleware
```

Then:

```typescript
getProfile
```

So the controller only runs after authentication succeeds.

---

# 31. Protected Controller

Our test controller:

```typescript
export const getProfile = (
  req: Request,
  res: Response
) => {
  res.status(200).json({
    success: true,
    data: req.user
  });
};
```

This proves that the decoded JWT data reached the controller.

---

# 32. Protected Route Flow

```text
GET /api/v1/auth/profile
            ↓
      authMiddleware
            ↓
    Authorization header?
            ↓
       Extract JWT
            ↓
       jwt.verify()
            ↓
      req.user = decoded
            ↓
          next()
            ↓
       getProfile()
            ↓
        Response
```

---

# 33. 401 vs 403

## 401 Unauthorized

Used when authentication is missing or invalid.

Examples:

```text
No token
Invalid token
Expired token
```

Example:

```json
{
  "success": false,
  "message": "Authentication required"
}
```

---

## 403 Forbidden

Used when the user is authenticated but does not have permission to perform the requested action.

Example:

```text
Logged-in normal user
        ↓
tries admin-only API
        ↓
403 Forbidden
```

Simple difference:

```text
401 → Who are you? Authentication failed.

403 → I know who you are, but you cannot do this.
```

---

# 34. Authentication vs Authorization Flow

```text
Request
   ↓
Authentication
   ↓
Who is this user?
   ↓
Authenticated?
   ↓
Authorization
   ↓
Does this user have permission?
   ↓
Controller
```

---

# 35. Day 8 Testing

## Registration

Tested:

```text
POST /api/v1/auth/register
```

Verified:

* User creation
* Password hashing
* Duplicate email protection
* Password not returned

---

## Login

Tested:

```text
POST /api/v1/auth/login
```

Verified:

* User lookup
* bcrypt password verification
* JWT generation
* Token returned
* Password not returned

---

## Protected API Without Token

Tested:

```text
GET /api/v1/auth/profile
```

Without Authorization header.

Result:

```text
401 Authentication required
```

---

## Protected API With Valid Token

Header:

```text
Authorization: Bearer <JWT>
```

Result:

```text
200
```

and JWT payload reached:

```text
req.user
```

---

# 36. Day 8 Architecture

Current authentication architecture:

```text
Client
  |
  | Register
  ↓
Auth Route
  |
  ↓
Auth Controller
  |
  ↓
Auth Service
  |
  ├── Duplicate email check
  ├── bcrypt.hash()
  └── User.create()
        |
        ↓
      MongoDB


Client
  |
  | Login
  ↓
Auth Route
  |
  ↓
Auth Controller
  |
  ↓
Auth Service
  |
  ├── Find user
  ├── bcrypt.compare()
  └── jwt.sign()
        |
        ↓
      JWT
        |
        ↓
     Client


Client
  |
  | Bearer JWT
  ↓
Protected Route
  |
  ↓
Auth Middleware
  |
  ├── Extract token
  ├── jwt.verify()
  └── req.user
        |
        ↓
      Controller
```

---

# 37. Important Security Practices Learned

## Never store plain-text passwords

Bad:

```text
password: "password123"
```

Good:

```text
password: bcrypt_hash
```

---

## Never return password

Even if it is hashed, avoid returning it to clients.

---

## Never put password in JWT

JWT should contain only necessary claims.

Current payload:

```text
userId
```

---

## Never hardcode JWT secret in source code

Use:

```env
JWT_SECRET=...
```

and keep `.env` out of Git.

---

## Use generic login errors

Instead of:

```text
Email does not exist
```

and:

```text
Wrong password
```

we use:

```text
Invalid email or password
```

This avoids unnecessarily revealing account existence.

---

# 38. Important Code Concepts

## `bcrypt.hash()`

```typescript
bcrypt.hash(password, 10)
```

Used during registration.

---

## `bcrypt.compare()`

```typescript
bcrypt.compare(password, hash)
```

Used during login.

---

## `jwt.sign()`

Creates a JWT.

```typescript
jwt.sign(payload, secret, options)
```

---

## `jwt.verify()`

Validates and decodes a JWT.

```typescript
jwt.verify(token, secret)
```

---

## `next()`

Moves the request to the next middleware/controller.

---

## `req.user`

Stores authenticated user information after JWT verification.

---

# 39. Interview Questions

## Q1. What is authentication?

Authentication is the process of verifying the identity of a user.

Example:

```text
email + password
```

---

## Q2. What is authorization?

Authorization determines what an authenticated user is allowed to access or perform.

---

## Q3. Authentication vs authorization?

```text
Authentication → Who are you?
Authorization → What can you do?
```

---

## Q4. Why do we hash passwords?

Because storing plain-text passwords is insecure.

Hashing stores a non-reversible representation of the password.

---

## Q5. Why bcrypt?

bcrypt is a password hashing algorithm designed to be computationally expensive, making password cracking harder than with fast general-purpose hashes.

---

## Q6. What is the difference between bcrypt.hash and bcrypt.compare?

```text
bcrypt.hash()
→ Creates password hash.

bcrypt.compare()
→ Checks entered password against stored hash.
```

---

## Q7. Why don't we decrypt a bcrypt password?

Because bcrypt is a one-way password hashing algorithm.

We verify by comparison instead of decryption.

---

## Q8. What is JWT?

JWT is a signed token format used to carry claims between parties.

In our application, it represents authenticated user information.

---

## Q9. What are the three parts of JWT?

```text
Header
Payload
Signature
```

---

## Q10. Is JWT encrypted?

Not by default.

JWT payload is encoded and signed, not encrypted.

Therefore sensitive information should not be stored in the payload.

---

## Q11. What is JWT signature used for?

The signature allows the server to verify that the token was signed using the expected secret and has not been modified.

---

## Q12. What is the purpose of JWT_SECRET?

It is used to sign and verify the JWT.

---

## Q13. Why keep JWT_SECRET in `.env`?

Because secrets should not be hardcoded or committed to source control.

---

## Q14. What is `expiresIn`?

It defines how long the JWT remains valid.

Our implementation:

```typescript
expiresIn: "1d"
```

means the token expires after one day.

---

## Q15. What is a Bearer token?

A Bearer token is a token sent through the Authorization header.

Example:

```text
Authorization: Bearer <token>
```

---

## Q16. How does authentication middleware work?

```text
Read Authorization header
        ↓
Extract Bearer token
        ↓
Verify JWT
        ↓
Store decoded user in req.user
        ↓
next()
```

---

## Q17. What happens if JWT is invalid?

`jwt.verify()` throws an error.

We catch it and return:

```text
401 Unauthorized
```

---

## Q18. What happens if Authorization header is missing?

The middleware returns:

```text
401
```

because authentication information was not provided.

---

## Q19. What is `req.user`?

`req.user` is a custom property we added to Express's request object to store authenticated user information after JWT verification.

---

## Q20. Why did we create `express.d.ts`?

Because TypeScript's default Express `Request` interface does not know about our custom `req.user` property.

We extended the interface using declaration merging.

---

## Q21. Why do we use `next()` in middleware?

`next()` passes the request to the next middleware or controller.

Without it, the request would stop at the authentication middleware.

---

## Q22. What is 401?

401 means authentication is missing or invalid.

Examples:

```text
Missing token
Invalid token
Expired token
```

---

## Q23. What is 403?

403 means the user is authenticated but does not have sufficient permission.

Example:

```text
Normal user → Admin API
```

---

## Q24. Why do we use `.select("+password")`?

Because the password field is configured with:

```typescript
select: false
```

Therefore we explicitly select it during login.

---

## Q25. Why use `select: false` for password?

To prevent the password hash from being included in normal user queries and responses unnecessarily.

---

## Q26. Why remove password before returning the user?

Even though the password is hashed, the password hash is sensitive information and should not be exposed to the client.

---

## Q27. What happens during registration?

```text
Request
 ↓
Check duplicate email
 ↓
Hash password
 ↓
Create user
 ↓
Remove password from response
 ↓
Return user
```

---

## Q28. What happens during login?

```text
Request
 ↓
Find user
 ↓
Select password hash
 ↓
bcrypt.compare()
 ↓
Generate JWT
 ↓
Return user + token
```

---

## Q29. What happens during a protected request?

```text
Request
 ↓
Authorization header
 ↓
Bearer token
 ↓
jwt.verify()
 ↓
req.user
 ↓
next()
 ↓
Controller
```

---

## Q30. Why shouldn't sensitive information be stored in JWT payload?

Because normal JWT payloads are readable after decoding.

The signature protects integrity, not confidentiality.

---

# 40. Placement-Level Questions

## Q31. Is JWT stateful or stateless?

JWT-based authentication is generally considered stateless because the server can validate the token without maintaining a server-side session for each request.

However, real systems can introduce state for features such as token revocation, refresh-token management, or session tracking.

---

## Q32. What happens if a JWT is stolen?

Anyone possessing a valid bearer token may be able to use it until it expires or is otherwise invalidated.

Therefore:

* Use HTTPS
* Keep token lifetime appropriate
* Protect token storage
* Use refresh-token strategies where appropriate
* Consider revocation mechanisms for higher-security applications

---

## Q33. Why use short-lived access tokens?

If an access token is compromised, a shorter lifetime limits how long it can remain usable.

---

## Q34. What is refresh token?

A refresh token can be used to obtain a new access token without requiring the user to log in again.

Typical architecture:

```text
Login
 ↓
Access Token + Refresh Token
 ↓
Access Token expires
 ↓
Refresh Token
 ↓
New Access Token
```

Refresh-token architecture can be added to FITFORGE later.

---

## Q35. What is the difference between session authentication and JWT authentication?

Session-based authentication typically stores session state on the server.

JWT authentication can allow the server to validate the signed token without storing a traditional session for every request.

---

## Q36. Why is JWT useful for APIs?

It can provide a compact, signed authentication credential that clients send with API requests.

It also works well across separate frontend and backend applications.

---

## Q37. Why do we use middleware for authentication?

Because authentication is a cross-cutting concern.

Instead of writing JWT verification inside every controller:

```text
Controller 1 → verify JWT
Controller 2 → verify JWT
Controller 3 → verify JWT
```

we centralize it:

```text
authMiddleware
      ↓
Protected Controllers
```

This improves reusability and separation of concerns.

---

## Q38. Where should authorization be implemented?

After authentication.

Example:

```text
JWT verification
      ↓
Identify user
      ↓
Check role/permission
      ↓
Allow or reject request
```

---

## Q39. What is RBAC?

RBAC means:

```text
Role-Based Access Control
```

Permissions are based on user roles.

Example:

```text
user
trainer
admin
```

Actual RBAC implementation is planned for the authorization stage of FITFORGE.

---

## Q40. How would you protect an admin API?

Conceptually:

```text
Authentication middleware
        ↓
Authorization/RBAC middleware
        ↓
Admin controller
```

Authentication checks identity.

Authorization checks role/permission.

---

# 41. Day 8 Final Revision

Remember these 10 points:

```text
1. Authentication = Who are you?

2. Authorization = What can you do?

3. Passwords → bcrypt hash

4. Password field → select: false

5. Login → bcrypt.compare()

6. JWT → signed authentication token

7. Bearer token → Authorization header

8. Middleware → jwt.verify()

9. req.user → authenticated user information

10. 401 = authentication problem
    403 = permission problem
```

---

# 42. FITFORGE Day 8 Achievement

By the end of Day 8, FITFORGE has:

* User registration
* Duplicate email protection
* bcrypt password hashing
* Password verification
* Password protection from normal queries
* JWT login
* JWT expiry
* Authentication middleware
* Bearer token handling
* JWT verification
* `req.user`
* Protected `/profile` route
* 401 handling
* Basic authentication testing

Authentication foundation is now ready for the next authorization/security layers.

# END OF DAY 8
