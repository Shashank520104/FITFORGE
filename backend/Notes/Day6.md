# DAY 6 — MongoDB Indexes

## 1. What is an Index?

An index is a data structure that helps MongoDB find and retrieve documents more efficiently.

Indexes improve query performance, especially when working with large collections.

However, indexes also have costs:

* Consume additional storage
* Add overhead to `insert`
* Add overhead to `update`
* Add overhead to `delete`

Because indexes also need to be maintained when data changes.

---

## 2. Creating an Index in Mongoose

Syntax:

```typescript
schema.index({ field: 1 });
```

Example:

```typescript
userSchema.index({ goal: 1 });
```

Here:

* `goal` → field being indexed
* `1` → ascending index order
* `-1` → descending index order

Important:

The `1` or `-1` in an index does **not** automatically sort query results.

Sorting is controlled separately using:

```typescript
.sort()
```

---

## 3. Single-Field Index

A single-field index is an index created on one field.

Example:

```typescript
userSchema.index({ goal: 1 });
```

This can help queries such as:

```text
GET /api/v1/users?goal=muscle_gain
```

MongoDB can use the `goal` index to find matching users more efficiently.

---

## 4. Compound Index

A compound index is an index created using multiple fields.

Example:

```typescript
userSchema.index({ goal: 1, sex: 1 });
```

This index contains:

```text
goal → sex
```

It can be useful for query patterns such as:

```text
GET /api/v1/users?goal=muscle_gain&sex=male
```

---

## 5. Index Field Order

The order of fields in a compound index is important.

For:

```typescript
userSchema.index({ goal: 1, sex: 1 });
```

the order is:

```text
goal → sex
```

This is different from:

```typescript
userSchema.index({ sex: 1, goal: 1 });
```

MongoDB uses the fields of a compound index in their defined order.

---

## 6. Left-Prefix Rule

For a compound index:

```typescript
{ goal: 1, sex: 1 }
```

the leading field is:

```text
goal
```

Therefore, the index can generally be useful for queries starting with:

```text
goal
```

or:

```text
goal + sex
```

But a query using only:

```text
sex
```

generally cannot use this compound index efficiently because `goal` is the leading field.

### Simple rule

For:

```text
{ A, B, C }
```

the index is generally useful for:

```text
A
A + B
A + B + C
```

but not as a direct replacement for:

```text
B
C
B + C
```

---

## 7. IXSCAN

`IXSCAN` means MongoDB is scanning an index to find matching documents.

Example:

```javascript
db.users.find({
  goal: "muscle_gain",
  sex: "male"
}).explain("executionStats")
```

If the execution plan contains:

```text
IXSCAN
```

MongoDB is using an index.

---

## 8. COLLSCAN

`COLLSCAN` means MongoDB is scanning the collection to find matching documents.

Example:

```javascript
db.users.find({
  someField: "someValue"
}).explain("executionStats")
```

If the execution plan contains:

```text
COLLSCAN
```

MongoDB is performing a collection scan instead of using an index.

---

## 9. explain()

MongoDB provides `explain()` to inspect how a query is executed.

Example:

```javascript
db.users.find({
  goal: "muscle_gain"
}).explain("executionStats")
```

It helps us understand whether MongoDB is using:

```text
IXSCAN
```

or:

```text
COLLSCAN
```

`explain()` is mainly a performance analysis and debugging tool.

It does not need to be added permanently to the application code.

---

## 10. Our FITFORGE Indexes

In `user.model.ts`:

```typescript
userSchema.index({ goal: 1 });
userSchema.index({ goal: 1, sex: 1 });
```

The first is a single-field index.

The second is a compound index.

MongoDB Atlas showed:

```text
_id_
goal_1
goal_1_sex_1
```

`_id_` is the default index created by MongoDB.

---

## 11. Practical Verification

We tested the compound index using:

```javascript
db.users.find({
  goal: "muscle_gain",
  sex: "male"
}).explain("executionStats")
```

The result contained:

```text
IXSCAN
```

This confirmed that MongoDB was using an index for this query.

---

# Interview Questions

## Q1. What is an index in MongoDB?

An index is a data structure that helps MongoDB find and retrieve documents more efficiently, improving query performance.

---

## Q2. What are the disadvantages of indexes?

Indexes consume additional storage and add overhead to insert, update, and delete operations because the indexes also need to be maintained.

---

## Q3. What is a single-field index?

An index created on a single field.

Example:

```typescript
userSchema.index({ goal: 1 });
```

---

## Q4. What is a compound index?

An index created using multiple fields.

Example:

```typescript
userSchema.index({ goal: 1, sex: 1 });
```

---

## Q5. Why is the order of fields important in a compound index?

Because MongoDB organizes the compound index according to the field order, and queries generally benefit from the leading fields of the index.

---

## Q6. What is the left-prefix rule?

It means a compound index is most useful when a query starts with the index's leading fields.

For:

```text
{ goal: 1, sex: 1 }
```

queries using `goal` or `goal + sex` can generally use the index effectively, while `sex` alone generally cannot use it efficiently.

---

## Q7. What is IXSCAN?

`IXSCAN` means MongoDB is scanning an index to find matching documents.

---

## Q8. What is COLLSCAN?

`COLLSCAN` means MongoDB is scanning the collection to find matching documents.

---

## Q9. How can you check whether MongoDB is using an index?

Using:

```javascript
.explain("executionStats")
```

and checking the execution plan for `IXSCAN` or `COLLSCAN`.

---

## Q10. Should we create an index on every field?

No.

Indexes should be created based on frequently used query and sorting patterns because they consume storage and add write overhead.

---

# Day 6 Implementation Checklist

* [x] Understand MongoDB indexes
* [x] Understand index advantages and disadvantages
* [x] Create single-field index
* [x] Verify index in MongoDB Atlas
* [x] Understand compound indexes
* [x] Create compound index
* [x] Understand compound index field order
* [x] Understand left-prefix rule
* [x] Understand `IXSCAN`
* [x] Understand `COLLSCAN`
* [x] Use `explain("executionStats")`
* [x] Verify compound index usage
* [x] Prepare interview questions

---

# Day 6 Final Takeaway

Indexes improve read/query performance by allowing MongoDB to find data more efficiently.

But indexes are not free. They consume storage and add write overhead.

Therefore, indexes should be created according to actual query patterns rather than being added to every field.

Key concepts:

```text
Index
   ↓
Better query performance
   ↓
IXSCAN
```

while:

```text
No suitable index
   ↓
Collection scan
   ↓
COLLSCAN
```

For compound indexes, remember:

```text
{ A, B, C }

A
A + B
A + B + C
```

follow the left-prefix principle.
