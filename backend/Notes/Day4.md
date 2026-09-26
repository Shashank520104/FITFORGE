# FITFORGE - Day 4
# MongoDB + Mongoose

## 1. MongoDB

MongoDB is a NoSQL document database.

Instead of tables and rows, MongoDB uses:

Database
  ↓
Collection
  ↓
Document

Example document:

{
  "name": "Rahul",
  "age": 22,
  "weight": 70
}

---

## 2. MongoDB Atlas

MongoDB Atlas is the cloud platform where our FITFORGE database is hosted.

Database:
FITFORGE

---

## 3. Mongoose

Mongoose is an ODM (Object Data Modeling) library for MongoDB and Node.js.

It helps us define:

- Schema
- Models
- Validation
- Queries
- Database operations

---

## 4. Database Connection

File:

src/config/database.ts

Mongoose connects our Express backend with MongoDB Atlas.

Environment variable:

MONGODB_URI

We keep database credentials inside .env.

---

## 5. Schema

A schema defines the structure and validation rules of documents.

Example:

name:
- String
- required
- trim
- minlength
- maxlength

age:
- Number
- required
- min
- max

goal:
- String
- required
- enum

---

## 6. Model

A Mongoose model is created from a schema.

Example:

const User = mongoose.model("User", userSchema);

The User model is used to interact with the users collection.

---

# CRUD

## 7. CREATE

Create a document:

User.create(userData)

API:

POST /api/v1/users

Flow:

Controller
    ↓
Service
    ↓
User.create()
    ↓
MongoDB

---

## 8. READ

Find one user:

User.findById(userId)

Find all users:

User.find()

---

## 9. UPDATE

Update a user:

User.findByIdAndUpdate()

Important options:

new: true

Returns the updated document.

runValidators: true

Runs schema validation during update.

---

## 10. DELETE

Delete a user:

User.findByIdAndDelete(userId)

---

# Validation

## 11. Schema Validation

Mongoose can validate data before saving/updating.

Examples:

required
min
max
minlength
maxlength
enum

Invalid data produces a ValidationError.

---

## 12. Centralized Error Handling

Instead of handling every database error separately, we use:

error.middleware.ts

Flow:

Controller
    ↓
Service
    ↓
Error
    ↓
next(error)
    ↓
Error Middleware
    ↓
Response

---

# Query Features

## 13. Filtering

Example:

GET /api/v1/users?goal=muscle_gain

Code concept:

User.find({
  goal: "muscle_gain"
})

---

## 14. Multiple Filters

Example:

GET /api/v1/users?goal=muscle_gain&sex=male

Multiple query parameters can be used together.

---

## 15. Sorting

Example:

GET /api/v1/users?sort=weight

Ascending:

sort=weight

Descending:

sort=-weight

Mongoose:

User.find(filter).sort(sort)

---

# Pagination

## 16. Why Pagination?

Returning thousands of documents at once is inefficient.

Pagination allows us to fetch data in smaller chunks.

Example:

?page=1&limit=10

Means:

Page 1
10 documents

---

## 17. Pagination Formula

skip = (page - 1) * limit

Example:

page = 2
limit = 10

skip = (2 - 1) * 10
skip = 10

So MongoDB skips the first 10 documents and returns the next 10.

---

## 18. Mongoose Pagination

Example:

User.find(filter)
  .sort(sort)
  .skip(skip)
  .limit(limit)

---

# FITFORGE Architecture

Current flow:

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
Mongoose Model
  ↓
MongoDB
  ↓
Service
  ↓
Controller
  ↓
Response

---

# Important Interview Questions

## What is MongoDB?

MongoDB is a NoSQL document-oriented database that stores data in BSON documents.

## What is Mongoose?

Mongoose is an ODM library for MongoDB and Node.js that provides schemas, models, validation and query functionality.

## What is a Schema?

A schema defines the structure and validation rules of MongoDB documents.

## What is a Model?

A model is created from a schema and provides an interface to interact with a MongoDB collection.

## Difference between findById and find?

findById() finds one document using its _id.

find() can return multiple documents based on a filter.

## Why use runValidators: true?

Because update operations do not automatically run all schema validators.

runValidators: true ensures validation rules are applied during updates.

## What is pagination?

Pagination divides a large dataset into smaller pages to improve performance and response size.

## What are skip() and limit()?

skip() skips a number of documents.

limit() restricts the number of documents returned.

---

# Day 4 Completed

[x] MongoDB
[x] MongoDB Atlas
[x] Mongoose
[x] Database connection
[x] Schema
[x] Model
[x] CREATE
[x] READ
[x] UPDATE
[x] DELETE
[x] ObjectId validation
[x] Schema validation
[x] Error middleware
[x] Filtering
[x] Multiple filters
[x] Sorting
[x] Pagination
[x] Pagination testing

# Moved to Next Day

- Projection / field selection
- Combined filtering + sorting + pagination + projection
- Advanced MongoDB/Mongoose concepts
- Final query optimization concepts