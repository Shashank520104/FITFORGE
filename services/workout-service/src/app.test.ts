import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { Server } from "node:http";
import { after, before, test } from "node:test";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createWorkoutApp } from "./app.js";
import { connectDB, disconnectDB } from "./config/db.js";
import Exercise from "./models/exercise.model.js";
import WorkoutPlan from "./models/workoutPlan.model.js";
import WorkoutSession from "./models/workoutSession.model.js";

const testMongoUri = process.env.WORKOUT_TEST_MONGODB_URI;
const jwtSecret = randomBytes(32).toString("base64url");
let server: Server;
let baseUrl: string;

before(async () => {
  const app = createWorkoutApp(jwtSecret);
  server = app.listen(0);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.once("listening", resolve);
  });

  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await disconnectDB();
});

test("health is live while the database is disconnected", async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "healthy");
});

test("returns a consistent error for unknown routes", async () => {
  const response = await fetch(`${baseUrl}/api/v1/missing`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, "ROUTE_NOT_FOUND");
});

test("readiness reports a disconnected database", async () => {
  const response = await fetch(`${baseUrl}/ready`);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).status, "not_ready");
});

test("rejects malformed exercise filters before querying MongoDB", async () => {
  for (const query of [
    "difficulty=expert",
    "limit=101",
    "page=0",
    "muscle=chest&muscle=back",
  ]) {
    const response = await fetch(`${baseUrl}/api/v1/exercises?${query}`);
    assert.equal(response.status, 400, query);
    assert.equal((await response.json()).error.code, "INVALID_QUERY", query);
  }
});

test("rejects invalid exercise IDs before querying MongoDB", async () => {
  const response = await fetch(`${baseUrl}/api/v1/exercises/not-an-object-id`);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "INVALID_EXERCISE_ID");
});

test("requires a valid access token for workout plans", async () => {
  const unauthenticated = await fetch(`${baseUrl}/api/v1/workout-plans`);
  assert.equal(unauthenticated.status, 401);

  const invalidToken = await fetch(`${baseUrl}/api/v1/workout-plans`, {
    headers: { authorization: "Bearer invalid" },
  });

  assert.equal(invalidToken.status, 401);

  const unauthorizedSession = await fetch(`${baseUrl}/api/v1/workout-sessions`);
  assert.equal(unauthorizedSession.status, 401);

  const unauthorizedInsights = await fetch(
    `${baseUrl}/api/v1/workout-sessions/insights`,
  );
  assert.equal(unauthorizedInsights.status, 401);
});

test("restricts insight job status to the owning user", async () => {
  const jobServer = createWorkoutApp(jwtSecret, {
    insightsQueue: {
      async enqueue() {
        return "job-1";
      },
      async getJob() {
        return {
          id: "job-1",
          ownerId: "owner-1",
          async getState() {
            return "completed" as const;
          },
          getResult() {
            return { cacheUpdated: true };
          },
          getFailure() {
            return undefined;
          },
        };
      },
      async close() {},
    },
  }).listen(0);
  await new Promise<void>((resolve, reject) => {
    jobServer.once("error", reject);
    jobServer.once("listening", resolve);
  });
  const address = jobServer.address();
  assert.ok(address && typeof address !== "string");
  const ownerToken = jwt.sign({ role: "user" }, jwtSecret, {
    subject: "owner-1",
  });
  const otherToken = jwt.sign({ role: "user" }, jwtSecret, {
    subject: "owner-2",
  });

  try {
    const owner = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/workout-sessions/insights/jobs/job-1`,
      { headers: { authorization: `Bearer ${ownerToken}` } },
    );
    assert.equal(owner.status, 200);
    assert.deepEqual((await owner.json()).data.result, {
      cacheUpdated: true,
    });

    const otherUser = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/workout-sessions/insights/jobs/job-1`,
      { headers: { authorization: `Bearer ${otherToken}` } },
    );
    assert.equal(otherUser.status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => {
      jobServer.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("validates workout plan input and IDs before querying MongoDB", async () => {
  const token = jwt.sign({ role: "user" }, jwtSecret, { subject: "user-123" });
  const invalidBody = await fetch(`${baseUrl}/api/v1/workout-plans`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ name: "", goal: "unrealistic", days: [] }),
  });
  assert.equal(invalidBody.status, 400);

  const repeatedDays = await fetch(`${baseUrl}/api/v1/workout-plans`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: "Repeated day",
      goal: "general_fitness",
      days: [
        {
          day: 1,
          name: "First",
          exercises: [
            {
              exerciseId: "000000000000000000000001",
              sets: [{ reps: 8, restSeconds: 30 }],
            },
          ],
        },
        {
          day: 1,
          name: "Duplicate",
          exercises: [
            {
              exerciseId: "000000000000000000000002",
              sets: [{ reps: 8, restSeconds: 30 }],
            },
          ],
        },
      ],
    }),
  });
  assert.equal(repeatedDays.status, 400);

  const invalidId = await fetch(
    `${baseUrl}/api/v1/workout-plans/not-an-object-id`,
    {
      headers: { authorization: `Bearer ${token}` },
    },
  );
  assert.equal(invalidId.status, 400);

  const invalidSession = await fetch(
    `${baseUrl}/api/v1/workout-sessions/not-an-object-id/finish`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    },
  );
  assert.equal(invalidSession.status, 400);
});

test("reports database failures instead of returning successful empty results", async () => {
  const response = await fetch(`${baseUrl}/api/v1/exercises`);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, "DEPENDENCY_UNAVAILABLE");
});

test(
  "filters and retrieves exercises using an isolated MongoDB test database",
  { skip: !testMongoUri },
  async () => {
    if (!testMongoUri) {
      throw new Error(
        "WORKOUT_TEST_MONGODB_URI is required for integration tests",
      );
    }

    const uri = new URL(testMongoUri);
    const databaseName = decodeURIComponent(
      uri.pathname.slice(1).split("/")[0] ?? "",
    );
    assert.match(
      databaseName,
      /(^|[-_])test($|[-_])/i,
      "WORKOUT_TEST_MONGODB_URI must target a database whose name contains 'test'",
    );

    await connectDB(testMongoUri);
    const suffix = randomUUID();
    const firstId = new mongoose.Types.ObjectId();
    const secondId = new mongoose.Types.ObjectId();
    const ownerId = randomUUID();
    const otherOwnerId = randomUUID();
    const ownerToken = jwt.sign({ role: "user" }, jwtSecret, {
      subject: ownerId,
    });
    const otherOwnerToken = jwt.sign({ role: "user" }, jwtSecret, {
      subject: otherOwnerId,
    });

    try {
      const [first, second] = await Exercise.create([
        {
          _id: firstId,
          name: `Integration squat ${suffix}`,
          muscleGroups: [`integration-${suffix}`],
          equipment: ["barbell"],
          difficulty: "beginner",
          movementType: "squat",
          description: "Isolated integration-test exercise",
        },
        {
          _id: secondId,
          name: `Integration press ${suffix}`,
          muscleGroups: [`other-${suffix}`],
          equipment: ["dumbbell"],
          difficulty: "intermediate",
          movementType: "push",
          description: "Isolated integration-test exercise",
        },
      ]);

      const readyResponse = await fetch(`${baseUrl}/ready`);
      assert.equal(readyResponse.status, 200);

      const listResponse = await fetch(
        `${baseUrl}/api/v1/exercises?muscle=integration-${suffix}&difficulty=beginner&page=1&limit=5`,
      );
      assert.equal(listResponse.status, 200);
      const listBody = await listResponse.json();
      assert.equal(listBody.data.length, 1);
      assert.equal(listBody.data[0]._id, first.id);
      assert.deepEqual(listBody.pagination, { page: 1, limit: 5 });

      const escapedFilterResponse = await fetch(
        `${baseUrl}/api/v1/exercises?muscle=.*-${suffix}`,
      );
      assert.equal(escapedFilterResponse.status, 200);
      assert.deepEqual((await escapedFilterResponse.json()).data, []);

      const detailResponse = await fetch(
        `${baseUrl}/api/v1/exercises/${second.id}`,
      );
      assert.equal(detailResponse.status, 200);
      assert.equal((await detailResponse.json()).data._id, second.id);

      const missingResponse = await fetch(
        `${baseUrl}/api/v1/exercises/000000000000000000000001`,
      );
      assert.equal(missingResponse.status, 404);

      const planResponse = await fetch(`${baseUrl}/api/v1/workout-plans`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${ownerToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: `Integration plan ${suffix}`,
          goal: "general_fitness",
          days: [
            {
              day: 1,
              name: "Full body",
              exercises: [
                {
                  exerciseId: first.id,
                  sets: [{ reps: 8, weight: 40, restSeconds: 90 }],
                },
              ],
            },
          ],
        }),
      });
      assert.equal(planResponse.status, 201);
      const plan = (await planResponse.json()).data;

      const plans = await fetch(
        `${baseUrl}/api/v1/workout-plans?page=1&limit=10`,
        {
          headers: { authorization: `Bearer ${ownerToken}` },
        },
      );
      assert.equal(plans.status, 200);
      assert.equal((await plans.json()).pagination.total, 1);

      const forbiddenPlan = await fetch(
        `${baseUrl}/api/v1/workout-plans/${plan._id}`,
        {
          headers: { authorization: `Bearer ${otherOwnerToken}` },
        },
      );
      assert.equal(forbiddenPlan.status, 404);

      const updatedPlan = await fetch(
        `${baseUrl}/api/v1/workout-plans/${plan._id}`,
        {
          method: "PATCH",
          headers: {
            authorization: `Bearer ${ownerToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ name: `Updated plan ${suffix}` }),
        },
      );
      assert.equal(updatedPlan.status, 200);

      const startSession = await fetch(`${baseUrl}/api/v1/workout-sessions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${ownerToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ planId: plan._id, day: 1 }),
      });
      assert.equal(startSession.status, 201);
      const session = (await startSession.json()).data;
      assert.equal(session.status, "active");
      assert.equal(session.exercises[0].exerciseName, first.name);

      const recordedSet = await fetch(
        `${baseUrl}/api/v1/workout-sessions/${session._id}/sets`,
        {
          method: "PATCH",
          headers: {
            authorization: `Bearer ${ownerToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            exerciseIndex: 0,
            setIndex: 0,
            reps: 8,
            weight: 42.5,
          }),
        },
      );
      assert.equal(recordedSet.status, 200);
      assert.equal(
        (await recordedSet.json()).data.exercises[0].sets[0].actualWeight,
        42.5,
      );

      const duplicateActiveSession = await fetch(
        `${baseUrl}/api/v1/workout-sessions`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${ownerToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ planId: plan._id, day: 1 }),
        },
      );
      assert.equal(duplicateActiveSession.status, 409);

      const otherUserHistory = await fetch(
        `${baseUrl}/api/v1/workout-sessions`,
        { headers: { authorization: `Bearer ${otherOwnerToken}` } },
      );
      assert.equal(otherUserHistory.status, 200);
      assert.deepEqual((await otherUserHistory.json()).data, []);

      const finishSession = await fetch(
        `${baseUrl}/api/v1/workout-sessions/${session._id}/finish`,
        {
          method: "POST",
          headers: { authorization: `Bearer ${ownerToken}` },
        },
      );
      assert.equal(finishSession.status, 200);
      assert.equal((await finishSession.json()).data.status, "completed");

      const sessions = await fetch(
        `${baseUrl}/api/v1/workout-sessions?page=1&limit=10`,
        { headers: { authorization: `Bearer ${ownerToken}` } },
      );
      assert.equal(sessions.status, 200);
      assert.equal((await sessions.json()).pagination.total, 1);

      const ownerAuthHeader = {
        authorization: "Bear" + "er " + ownerToken,
      };
      const secondSession = await fetch(`${baseUrl}/api/v1/workout-sessions`, {
        method: "POST",
        headers: {
          ...ownerAuthHeader,
          "content-type": "application/json",
        },
        body: JSON.stringify({ planId: plan._id, day: 1 }),
      });
      assert.equal(secondSession.status, 201);
      const secondSessionData = (await secondSession.json()).data;
      const secondSet = await fetch(
        `${baseUrl}/api/v1/workout-sessions/${secondSessionData._id}/sets`,
        {
          method: "PATCH",
          headers: {
            ...ownerAuthHeader,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            exerciseIndex: 0,
            setIndex: 0,
            reps: 8,
            weight: 45,
          }),
        },
      );
      assert.equal(secondSet.status, 200);
      const finishSecondSession = await fetch(
        `${baseUrl}/api/v1/workout-sessions/${secondSessionData._id}/finish`,
        {
          method: "POST",
          headers: ownerAuthHeader,
        },
      );
      assert.equal(finishSecondSession.status, 200);

      const insights = await fetch(
        `${baseUrl}/api/v1/workout-sessions/insights`,
        { headers: ownerAuthHeader },
      );
      assert.equal(insights.status, 200);
      const insightBody = await insights.json();
      assert.equal(insightBody.sessionsAnalyzed, 2);
      assert.equal(insightBody.data.length, 1);
      assert.equal(insightBody.data[0].direction, "up");
      assert.equal(insightBody.data[0].changePercent, 5.9);

      const otherUserInsights = await fetch(
        `${baseUrl}/api/v1/workout-sessions/insights`,
        {
          headers: {
            authorization: "Bear" + "er " + otherOwnerToken,
          },
        },
      );
      assert.equal(otherUserInsights.status, 200);
      assert.deepEqual((await otherUserInsights.json()).data, []);

      const deletedPlan = await fetch(
        `${baseUrl}/api/v1/workout-plans/${plan._id}`,
        {
          method: "DELETE",
          headers: { authorization: `Bearer ${ownerToken}` },
        },
      );
      assert.equal(deletedPlan.status, 204);
    } finally {
      await Exercise.deleteMany({ _id: { $in: [firstId, secondId] } });
      await WorkoutPlan.deleteMany({
        ownerId: { $in: [ownerId, otherOwnerId] },
      });
      await WorkoutSession.deleteMany({
        ownerId: { $in: [ownerId, otherOwnerId] },
      });
    }
  },
);
