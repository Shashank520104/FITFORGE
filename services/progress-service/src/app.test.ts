import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Server } from "node:http";
import { after, test } from "node:test";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import { createProgressApp } from "./app.js";
import { loadProgressConfig } from "./config.js";

const secret = randomBytes(32).toString("base64url");
const testDatabaseUrl = process.env.PROGRESS_TEST_DATABASE_URL;
if (testDatabaseUrl && !/test/i.test(new URL(testDatabaseUrl).pathname)) {
  throw new Error(
    "PROGRESS_TEST_DATABASE_URL must target a database whose name contains 'test'",
  );
}
const pool = new Pool({
  connectionString: testDatabaseUrl ?? "postgres://localhost/fitforge_unused",
});
const app = createProgressApp(
  pool,
  loadProgressConfig({
    DATABASE_URL: testDatabaseUrl ?? "postgres://localhost/fitforge_unused",
    JWT_SECRET: secret,
  }),
);
const server: Server = app.listen(0);

const baseUrlReady = new Promise<string>((resolve, reject) => {
  server.once("error", reject);
  server.once("listening", () => {
    const address = server.address();
    if (!address || typeof address === "string") {
      reject(new Error("Progress test server did not bind to a TCP port"));
      return;
    }
    resolve(`http://127.0.0.1:${address.port}`);
  });
});

after(async () => {
  await Promise.all([
    new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
    pool.end(),
  ]);
});

test("health is public and progress routes require a bearer token", async () => {
  const baseUrl = await baseUrlReady;
  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200);
  const denied = await fetch(`${baseUrl}/api/v1/progress/summary`);
  assert.equal(denied.status, 401);
  assert.equal((await denied.json()).error.code, "AUTHENTICATION_REQUIRED");
  const deniedActivity = await fetch(
    `${baseUrl}/api/v1/activity?date=2025-01-20`,
  );
  assert.equal(deniedActivity.status, 401);
});

test("rejects malformed progress input before reaching the database", async () => {
  const baseUrl = await baseUrlReady;
  const token = jwt.sign({ role: "user" }, secret, {
    subject: "75adfda6-e958-4ded-a81d-471b3a66ee19",
    expiresIn: 60,
  });
  const response = await fetch(`${baseUrl}/api/v1/progress/measurements`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ measuredOn: "not-a-date", weightKg: -1 }),
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "INVALID_MEASUREMENT");

  const invalidActivity = await fetch(`${baseUrl}/api/v1/activity/activities`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      activityDate: "2025-01-20",
      activityTime: "08:30",
      activityType: "flying",
      durationMinutes: 30,
    }),
  });
  assert.equal(invalidActivity.status, 400);
  assert.equal((await invalidActivity.json()).error.code, "INVALID_ACTIVITY");

  const invalidSleep = await fetch(`${baseUrl}/api/v1/activity/sleep`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sleepDate: "2025-01-20",
      bedtime: "22:00",
      wakeTime: "22:00",
    }),
  });
  assert.equal(invalidSleep.status, 400);
  assert.equal((await invalidSleep.json()).error.code, "INVALID_SLEEP");

  const invalidRange = await fetch(
    `${baseUrl}/api/v1/activity/summary?from=2025-02-01&to=2025-01-01`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  assert.equal(invalidRange.status, 400);
  assert.equal((await invalidRange.json()).error.code, "INVALID_DATE_RANGE");
});

test(
  "stores owner-scoped measurements and identifies new strength records",
  { skip: !testDatabaseUrl },
  async () => {
    const baseUrl = await baseUrlReady;
    const owner = "75adfda6-e958-4ded-a81d-471b3a66ee19";
    const token = jwt.sign({ role: "user" }, secret, {
      subject: owner,
      expiresIn: 60,
    });
    const headers = {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    };

    try {
      const measurement = await fetch(
        `${baseUrl}/api/v1/progress/measurements`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            measuredOn: "2025-01-20",
            weightKg: 72.4,
          }),
        },
      );
      assert.equal(measurement.status, 201);

      const firstRecord = await fetch(
        `${baseUrl}/api/v1/progress/strength-records`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            exerciseName: "Bench Press",
            performedAt: "2025-01-20",
            weightKg: 60,
            repetitions: 5,
          }),
        },
      );
      assert.equal(firstRecord.status, 201);
      assert.equal((await firstRecord.json()).isPersonalRecord, true);

      const equalRecord = await fetch(
        `${baseUrl}/api/v1/progress/strength-records`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            exerciseName: "bench press",
            performedAt: "2025-01-21",
            weightKg: 60,
            repetitions: 5,
          }),
        },
      );
      assert.equal(equalRecord.status, 201);
      assert.equal((await equalRecord.json()).isPersonalRecord, false);

      const activity = await fetch(`${baseUrl}/api/v1/activity/activities`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          activityDate: "2025-01-20",
          activityTime: "08:30",
          activityType: "walking",
          durationMinutes: 35,
          distanceKm: 2.4,
        }),
      });
      assert.equal(activity.status, 201);
      const activityData = (await activity.json()).data;

      const sleep = await fetch(`${baseUrl}/api/v1/activity/sleep`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          sleepDate: "2025-01-20",
          bedtime: "23:00",
          wakeTime: "07:00",
        }),
      });
      assert.equal(sleep.status, 201);
      const sleepData = (await sleep.json()).data;
      assert.equal(Number(sleepData.duration_minutes), 480);

      const day = await fetch(`${baseUrl}/api/v1/activity?date=2025-01-20`, {
        headers,
      });
      const dayData = (await day.json()).data;
      assert.equal(dayData.activities.length, 1);
      assert.equal(dayData.activityMinutes, 35);
      assert.equal(dayData.sleepMinutes, 480);

      const summary = await fetch(
        `${baseUrl}/api/v1/activity/summary?from=2025-01-19&to=2025-01-21`,
        { headers },
      );
      const summaryData = (await summary.json()).data;
      assert.equal(summary.status, 200);
      assert.equal(summaryData.length, 3);
      assert.equal(Number(summaryData[0].activity_minutes), 0);
      assert.equal(Number(summaryData[1].activity_minutes), 35);
      assert.equal(Number(summaryData[1].sleep_minutes), 480);
      assert.equal(Number(summaryData[2].sleep_minutes), 0);

      const otherToken = jwt.sign({ role: "user" }, secret, {
        subject: "487c6920-7505-4fa9-8943-5046ecabdf31",
        expiresIn: 60,
      });
      const otherUserMeasurements = await fetch(
        `${baseUrl}/api/v1/progress/measurements`,
        { headers: { authorization: `Bearer ${otherToken}` } },
      );
      assert.deepEqual((await otherUserMeasurements.json()).data, []);

      const deleteActivity = await fetch(
        `${baseUrl}/api/v1/activity/activities/${activityData.id}`,
        { method: "DELETE", headers },
      );
      assert.equal(deleteActivity.status, 204);
      const deleteSleep = await fetch(
        `${baseUrl}/api/v1/activity/sleep/${sleepData.id}`,
        { method: "DELETE", headers },
      );
      assert.equal(deleteSleep.status, 204);
    } finally {
      await pool.query("DELETE FROM body_measurements WHERE owner_id = $1", [
        owner,
      ]);
      await pool.query("DELETE FROM strength_records WHERE owner_id = $1", [
        owner,
      ]);
      await pool.query("DELETE FROM activity_logs WHERE owner_id = $1", [
        owner,
      ]);
      await pool.query("DELETE FROM sleep_logs WHERE owner_id = $1", [owner]);
    }
  },
);
