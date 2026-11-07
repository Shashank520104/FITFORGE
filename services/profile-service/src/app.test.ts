import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { Server } from "node:http";
import { after, test } from "node:test";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import { createProfileApp } from "./app.js";
import { loadProfileConfig } from "./config.js";

const secret = randomBytes(32).toString("base64url");
const testDatabaseUrl = process.env.PROFILE_TEST_DATABASE_URL;
if (testDatabaseUrl && !/test/i.test(new URL(testDatabaseUrl).pathname)) {
  throw new Error(
    "PROFILE_TEST_DATABASE_URL must target a database whose name contains 'test'",
  );
}
const databaseUrl = testDatabaseUrl ?? "postgres://localhost/fitforge_unused";
const pool = new Pool({ connectionString: databaseUrl });
const app = createProfileApp(
  pool,
  loadProfileConfig({ DATABASE_URL: databaseUrl, JWT_SECRET: secret }),
);
const server: Server = app.listen(0);
const baseUrlReady = new Promise<string>((resolve, reject) => {
  server.once("error", reject);
  server.once("listening", () => {
    const address = server.address();
    if (!address || typeof address === "string") {
      reject(new Error("Profile test server did not bind to a TCP port"));
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

test("health is public and profile endpoints require a bearer token", async () => {
  const baseUrl = await baseUrlReady;
  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200);
  const denied = await fetch(`${baseUrl}/api/v1/profile`);
  assert.equal(denied.status, 401);
  assert.equal((await denied.json()).error.code, "AUTHENTICATION_REQUIRED");
});

test("rejects invalid profile preferences before reaching PostgreSQL", async () => {
  const baseUrl = await baseUrlReady;
  const token = jwt.sign({ role: "user" }, secret, {
    subject: randomUUID(),
    expiresIn: 60,
  });
  const response = await fetch(`${baseUrl}/api/v1/profile`, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ units: "stones", equipment: ["rocket"] }),
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "INVALID_PROFILE");
});

test(
  "stores private profiles and updates only explicitly supplied preferences",
  { skip: !testDatabaseUrl },
  async () => {
    const baseUrl = await baseUrlReady;
    const owner = randomUUID();
    const token = jwt.sign({ role: "user" }, secret, {
      subject: owner,
      expiresIn: 60,
    });
    const headers = {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    };
    try {
      const initial = await fetch(`${baseUrl}/api/v1/profile`, { headers });
      assert.equal(initial.status, 200);
      assert.equal((await initial.json()).data.units, "metric");

      const updated = await fetch(`${baseUrl}/api/v1/profile`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          displayName: "Strength athlete",
          units: "imperial",
          trainingGoal: "general_fitness",
          experienceLevel: "beginner",
          equipment: ["bodyweight", "dumbbell"],
          dietaryPreferences: ["vegetarian"],
        }),
      });
      assert.equal(updated.status, 200);
      const updatedProfile = (await updated.json()).data;
      assert.equal(updatedProfile.display_name, "Strength athlete");
      assert.equal(updatedProfile.units, "imperial");
      assert.deepEqual(updatedProfile.equipment, ["bodyweight", "dumbbell"]);

      const cleared = await fetch(`${baseUrl}/api/v1/profile`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ displayName: null }),
      });
      assert.equal((await cleared.json()).data.display_name, null);
      assert.equal(
        (
          await fetch(`${baseUrl}/api/v1/profile`, { headers }).then(
            (response) => response.json(),
          )
        ).data.units,
        "imperial",
      );
    } finally {
      await pool.query("DELETE FROM user_profiles WHERE owner_id = $1", [
        owner,
      ]);
    }
  },
);
