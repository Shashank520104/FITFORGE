# FITFORGE Backend — Day 9

## Topic: API Request Validation

### Day 9 Goal

Aaj ka main goal tha:

> Client se aane wale registration data ko database/service tak pahunchne se pehle validate karna.

Humne FITFORGE ke `/register` API ke liye validation middleware implement kiya.

---

# 1. Why API Validation?

Client koi bhi data backend ko bhej sakta hai.

Example:

```json
{
  "name": "",
  "email": "abc",
  "password": "12",
  "age": 5,
  "weight": -20,
  "height": 500,
  "sex": "dog",
  "goal": "xyz"
}
```

Agar backend directly database mein data save kare, to invalid/garbage data store ho sakta hai.

Isliye backend ko request receive karne ke baad data validate karna chahiye.

---

# 2. Validation Middleware

File:

```text
src/middlewares/validation.middleware.ts
```

Middleware ka basic purpose:

```text
Request
   ↓
Validation Middleware
   ↓
Valid → next()
Invalid → 400 Response
```

Agar validation fail hoti hai, request controller tak nahi jaati.

---

# 3. Required Field Validation

Registration ke liye required fields:

```text
name
email
password
age
sex
weight
height
goal
```

Implementation:

```typescript
const { name, email, password, age, sex, weight, height, goal } = req.body;

if (!name || !email || !password || !age || !sex || !weight || !height || !goal) {
  res.status(400).json({
    success: false,
    message: "All fields are required"
  });
  return;
}
```

Important:

`return` ka use isliye kiya hai taaki validation fail hone ke baad middleware aage execute na ho.

---

# 4. Age Validation

FITFORGE mein age:

```text
Minimum = 13
Maximum = 100
```

Implementation:

```typescript
if (age < 13 || age > 100) {
  res.status(400).json({
    success: false,
    message: "Age must be between 13 and 100"
  });
  return;
}
```

Examples:

```text
22  → Valid
13  → Valid
100 → Valid
10  → Invalid
101 → Invalid
```

---

# 5. Weight Validation

FITFORGE mein weight:

```text
Minimum = 20 kg
Maximum = 300 kg
```

Implementation:

```typescript
if (weight < 20 || weight > 300) {
  res.status(400).json({
    success: false,
    message: "Weight must be between 20 and 300 kg"
  });
  return;
}
```

---

# 6. Height Validation

Current request validation:

```text
Minimum = 100 cm
Maximum = 250 cm
```

Implementation:

```typescript
if (height < 100 || height > 250) {
  res.status(400).json({
    success: false,
    message: "Height must be between 100 and 250 cm"
  });
  return;
}
```

---

# 7. Enum Validation

Some fields should only accept predefined values.

## Sex

Allowed values:

```text
male
female
other
```

Implementation:

```typescript
if (!["male", "female", "other"].includes(sex)) {
  res.status(400).json({
    success: false,
    message: "Invalid sex value"
  });
  return;
}
```

`.includes()` checks whether the received value exists in the allowed array.

---

# 8. Goal Validation

Allowed FITFORGE goals:

```text
muscle_gain
fat_loss
powerlifting
athletic_performance
general_fitness
```

Implementation:

```typescript
if (
  ![
    "muscle_gain",
    "fat_loss",
    "powerlifting",
    "athletic_performance",
    "general_fitness"
  ].includes(goal)
) {
  res.status(400).json({
    success: false,
    message: "Invalid goal value"
  });
  return;
}
```

---

# 9. Email Validation

Required-field validation only checks whether email exists.

We also added a basic format check:

```typescript
if (!email.includes("@")) {
  res.status(400).json({
    success: false,
    message: "Please enter a valid email"
  });
  return;
}
```

Example:

```text
abc@gmail.com → Valid
abcgmail.com  → Invalid
```

This is a basic validation. More advanced email validation can be introduced later if required.

---

# 10. Password Validation

FITFORGE password minimum length:

```text
6 characters
```

Implementation:

```typescript
if (password.length < 6) {
  res.status(400).json({
    success: false,
    message: "Password must be at least 6 characters"
  });
  return;
}
```

Example:

```text
123456 → Valid
12345  → Invalid
```

---

# 11. Why `next()` Is Important

After all validations pass:

```typescript
next();
```

This tells Express:

> Validation successful, continue to the next middleware/controller.

Flow:

```text
Validation Middleware
        ↓
All checks pass
        ↓
next()
        ↓
Register Controller
```

Without `next()`, the request would stop inside the middleware.

---

# 12. Connecting Middleware to Route

In:

```text
src/routes/auth.routes.ts
```

We use:

```typescript
router.post("/register", validationMiddleware, registerUser);
```

Therefore:

```text
POST /api/v1/auth/register
            ↓
validationMiddleware
            ↓
registerUser
```

---

# 13. Validation vs Business Logic

This is an important backend architecture concept.

## Validation Middleware

Checks whether request input is valid.

Examples:

```text
Age range
Weight range
Required fields
Email format
Allowed enum values
Password length
```

## Service

Handles business logic.

Example:

```typescript
const existingUser = await User.findOne({
  email: data.email
});
```

If email already exists:

```text
Email already registered
```

So:

```text
Middleware
→ Is the input valid?

Service
→ Is the requested operation allowed according to business rules?
```

---

# 14. Mongoose Validation vs API Validation

FITFORGE already has Mongoose validation.

Example:

```typescript
age: {
  type: Number,
  required: true,
  min: 13,
  max: 100
}
```

This protects the model/database layer.

Our new middleware validates the request earlier.

Overall:

```text
Client
   ↓
Request Validation
   ↓
Controller
   ↓
Service
   ↓
Mongoose Validation
   ↓
MongoDB
```

Having validation at the API boundary gives the client a faster and clearer response.

---

# 15. HTTP 400

For invalid client input we use:

```text
400 Bad Request
```

Example:

```json
{
  "success": false,
  "message": "Password must be at least 6 characters"
}
```

Meaning:

> The server received the request, but the input provided by the client is invalid.

---

# 16. Testing Done

We tested invalid password:

```json
{
  "password": "123"
}
```

Response:

```json
{
  "success": false,
  "message": "Password must be at least 6 characters"
}
```

We tested invalid age:

```json
{
  "age": 10
}
```

Response:

```json
{
  "success": false,
  "message": "Age must be between 13 and 100"
}
```

We tested invalid goal:

```json
{
  "goal": "become_superhuman"
}
```

Response:

```json
{
  "success": false,
  "message": "Invalid goal value"
}
```

Finally, we tested a valid registration request.

Result:

```text
Registration successful
User created in MongoDB
Password not returned in response
```

---

# 17. Important Debugging Lesson

During implementation, `/register` was accidentally registered twice:

```typescript
router.post("/register", registerUser);

router.post("/register", validationMiddleware, registerUser);
```

The duplicate route caused the first route to handle the request before our validation middleware.

Correct version:

```typescript
router.post("/register", validationMiddleware, registerUser);
```

This taught an important Express concept:

> Middleware order and route order matter.

---

# 18. Small Model Consistency Issues Found

During testing, we found two small inconsistencies that should be cleaned up later:

### Sex

Middleware:

```text
other
```

Current Mongoose model:

```text
others
```

These should eventually use the same value.

### Height

Middleware:

```text
100–250 cm
```

Current Mongoose model:

```text
100–300 cm
```

These should eventually be aligned.

These were identified but not expanded into today's main topic.

---

# 19. Interview Questions

### Q1. What is API validation?

API validation checks whether incoming request data satisfies the required rules before processing it.

---

### Q2. Why do we validate data before sending it to the database?

To prevent invalid, malformed, or unwanted data from reaching the business/database layer.

---

### Q3. What is middleware in Express?

Middleware is a function that runs during the request-response cycle and can modify the request/response or pass control to the next middleware.

---

### Q4. Why do we use `next()`?

`next()` passes control to the next middleware or route handler.

---

### Q5. What happens if validation fails?

The middleware sends an error response, usually:

```text
400 Bad Request
```

and uses `return` so execution stops.

---

### Q6. What is enum validation?

Enum validation restricts a field to a predefined set of allowed values.

Example:

```text
male
female
other
```

---

### Q7. What is the difference between request validation and Mongoose validation?

Request validation happens at the API boundary before business logic.

Mongoose validation happens at the model/database layer before saving the document.

---

### Q8. Why should duplicate email checking be handled in the service?

Duplicate email checking is a business rule involving database state, so it belongs to the service/business-logic layer rather than simple request-format validation.

---

### Q9. Why is HTTP 400 used for invalid input?

Because the request itself contains invalid client-provided data.

---

### Q10. Why should we not rely only on frontend validation?

Frontend validation improves user experience, but users can bypass the frontend and directly call the API. Backend validation is therefore mandatory.

---

# 20. Day 9 Interview Takeaway

If an interviewer asks:

> "How do you validate registration data in your backend?"

Answer:

> "I use request validation middleware before the controller. It checks required fields, ranges, enum values, email format and password length. Invalid requests return 400 immediately. Valid requests are passed using `next()` to the controller. Business validations such as duplicate email checking remain in the service layer, while Mongoose validation provides another layer of model-level protection."

---

# Day 9 Achievement

```text
✅ Created validation middleware
✅ Required field validation
✅ Age validation
✅ Weight validation
✅ Height validation
✅ Sex enum validation
✅ Goal enum validation
✅ Email validation
✅ Password validation
✅ Connected middleware to register route
✅ Tested invalid requests
✅ Tested successful registration
✅ Understood validation vs business logic
✅ Debugged Express route-order issue
```

## Day 9 Status: COMPLETE ✅
