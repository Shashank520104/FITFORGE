import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { Server } from "node:http";
import { after, test } from "node:test";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import { createPersonalizationApp } from "./app.js";
import { loadPersonalizationConfig } from "./config.js";

const secret = randomBytes(32).toString("base64url");
const encryptionKey = randomBytes(32).toString("base64url");
const testDatabaseUrl = process.env.PERSONALIZATION_TEST_DATABASE_URL;
if (testDatabaseUrl && !/test/i.test(new URL(testDatabaseUrl).pathname)) {
  throw new Error(
    "PERSONALIZATION_TEST_DATABASE_URL must target a database whose name contains 'test'",
  );
}
const databaseUrl =
  testDatabaseUrl ?? "postgres://localhost/fitforge_personalization_unused";
const pool = new Pool({ connectionString: databaseUrl });
const app = createPersonalizationApp(
  pool,
  loadPersonalizationConfig({
    DATABASE_URL: databaseUrl,
    JWT_SECRET: secret,
    REPORT_ENCRYPTION_KEY: encryptionKey,
  }),
  {
    extractText: async () => "Synthetic report fixture. No real health data.",
    fetcher: async (_input, init) => {
      const request = JSON.parse(String(init?.body)) as {
        messages: Array<{ role: string; content: string }>;
      };
      if (request.messages[0].content.includes("Summarize only information")) {
        return Response.json({
          message: { content: "Synthetic summary for a test fixture." },
        });
      }
      const days = Array.from({ length: 7 }, () => ({
        b: "Synthetic breakfast idea",
        l: "Synthetic lunch idea",
        s: "Synthetic snack idea",
        d: "Synthetic dinner idea",
      }));
      const movement = request.messages[0].content.includes(
        "movement array has exactly seven items",
      )
        ? Array.from({ length: 7 }, (_, index) => ({
            f: index >= 5 ? "Rest" : "Gentle movement",
            a: index >= 5 ? "Rest" : "Comfortable walk",
            m: index >= 5 ? 0 : 15,
            g: index >= 5 ? "Rest" : "Keep a comfortable pace.",
          }))
        : undefined;
      return Response.json({
        message: {
          content: JSON.stringify({
            days,
            ...(movement ? { movement } : {}),
          }),
        },
      });
    },
  },
);
const server: Server = app.listen(0);
const baseUrlReady = new Promise<string>((resolve, reject) => {
  server.once("error", reject);
  server.once("listening", () => {
    const address = server.address();
    if (!address || typeof address === "string") {
      reject(
        new Error("Personalization test server did not bind to a TCP port"),
      );
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

function accessToken(ownerId: string = randomUUID()): string {
  return jwt.sign({ role: "user" }, secret, {
    subject: ownerId,
    expiresIn: 60,
  });
}

test("health is public and wellness routes require a valid account token", async () => {
  const baseUrl = await baseUrlReady;
  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200);
  const denied = await fetch(`${baseUrl}/api/v1/wellness/profile`);
  assert.equal(denied.status, 401);
  assert.equal((await denied.json()).error.code, "AUTHENTICATION_REQUIRED");

  const invalidSubject = await fetch(`${baseUrl}/api/v1/wellness/profile`, {
    headers: { authorization: `Bearer ${accessToken("not-a-uuid")}` },
  });
  assert.equal(invalidSubject.status, 401);
  assert.equal(
    (await invalidSubject.json()).error.code,
    "INVALID_ACCESS_TOKEN",
  );
});

test("validates wellness profile input before database access", async () => {
  const baseUrl = await baseUrlReady;
  const response = await fetch(`${baseUrl}/api/v1/wellness/profile`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${accessToken()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      heightCm: 80,
      weightKg: 500,
      dietPreference: "whatever",
      experienceLevel: "expert",
      exerciseCleared: true,
    }),
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "INVALID_WELLNESS_PROFILE");
});

test("rejects report type spoofing and missing filenames before database access", async () => {
  const baseUrl = await baseUrlReady;
  const token = accessToken();
  const mismatch = await fetch(`${baseUrl}/api/v1/wellness/reports`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/pdf",
      "x-file-name": "report.pdf",
    },
    body: "not a pdf",
  });
  assert.equal(mismatch.status, 400);
  assert.equal((await mismatch.json()).error.code, "REPORT_TYPE_MISMATCH");

  const missingName = await fetch(`${baseUrl}/api/v1/wellness/reports`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/pdf",
    },
    body: "%PDF-1.7 synthetic fixture",
  });
  assert.equal(missingName.status, 400);
  assert.equal((await missingName.json()).error.code, "INVALID_REPORT_NAME");
});

test(
  "saves encrypted reports, returns a non-diagnostic summary, and deletes only the owner's report",
  { skip: !testDatabaseUrl },
  async () => {
    const baseUrl = await baseUrlReady;
    const ownerId = randomUUID();
    const token = accessToken(ownerId);
    const headers = { authorization: `Bearer ${token}` };
    const samplePdf = Buffer.from(
      "%PDF-1.7 synthetic report fixture; no real health data.",
    );
    let reportId = "";
    try {
      const savedProfile = await fetch(`${baseUrl}/api/v1/wellness/profile`, {
        method: "PUT",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({
          heightCm: 170,
          weightKg: 70,
          dietPreference: "vegetarian",
          experienceLevel: "beginner",
          exerciseCleared: true,
        }),
      });
      assert.equal(savedProfile.status, 200);
      const upload = await fetch(`${baseUrl}/api/v1/wellness/reports`, {
        method: "POST",
        headers: {
          ...headers,
          "content-type": "application/pdf",
          "x-file-name": encodeURIComponent("synthetic-report.pdf"),
        },
        body: samplePdf,
      });
      assert.equal(upload.status, 201);
      reportId = (await upload.json()).data.id;
      const revokedProfile = await fetch(`${baseUrl}/api/v1/wellness/profile`, {
        headers,
      });
      assert.equal((await revokedProfile.json()).data.exerciseCleared, false);
      await pool.query(
        `INSERT INTO personalized_plans (owner_id, plan)
         VALUES ($1, $2::jsonb)`,
        [ownerId, JSON.stringify({ dietDays: [], workoutDays: [{ day: 1 }] })],
      );
      const gatedPlan = await fetch(`${baseUrl}/api/v1/wellness/plan`, {
        headers,
      });
      assert.equal((await gatedPlan.json()).data.workoutDays, null);

      const rawRecord = await pool.query(
        "SELECT encrypted_content FROM health_reports WHERE id = $1",
        [reportId],
      );
      assert.notDeepEqual(rawRecord.rows[0].encrypted_content, samplePdf);

      const summary = await fetch(
        `${baseUrl}/api/v1/wellness/reports/${reportId}/summary`,
        { method: "POST", headers },
      );
      assert.equal(summary.status, 200);
      assert.match((await summary.json()).data.note, /does not decide/);

      const deletion = await fetch(
        `${baseUrl}/api/v1/wellness/reports/${reportId}`,
        { method: "DELETE", headers },
      );
      assert.equal(deletion.status, 200);
    } finally {
      if (reportId) {
        await pool.query("DELETE FROM health_reports WHERE id = $1", [
          reportId,
        ]);
      }
      await pool.query("DELETE FROM wellness_profiles WHERE owner_id = $1", [
        ownerId,
      ]);
      await pool.query("DELETE FROM personalized_plans WHERE owner_id = $1", [
        ownerId,
      ]);
    }
  },
);

test(
  "generates seven-day meal ideas and never returns workouts without explicit clearance",
  { skip: !testDatabaseUrl },
  async () => {
    const baseUrl = await baseUrlReady;
    const ownerId = randomUUID();
    const headers = {
      authorization: `Bearer ${accessToken(ownerId)}`,
      "content-type": "application/json",
    };
    try {
      const saved = await fetch(`${baseUrl}/api/v1/wellness/profile`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          heightCm: 175,
          weightKg: 78,
          dietPreference: "vegan",
          experienceLevel: "beginner",
          exerciseCleared: false,
        }),
      });
      assert.equal(saved.status, 200);

      const dietOnly = await fetch(`${baseUrl}/api/v1/wellness/plan/generate`, {
        method: "POST",
        headers,
      });
      assert.equal(dietOnly.status, 200);
      const dietOnlyPlan = (await dietOnly.json()).data;
      assert.equal(dietOnlyPlan.dietDays.length, 7);
      assert.equal(dietOnlyPlan.workoutDays, null);
      assert.match(
        dietOnlyPlan.workoutNotice,
        /clinician has cleared exercise/,
      );

      const hiddenPlan = await fetch(`${baseUrl}/api/v1/wellness/plan`, {
        headers: { authorization: headers.authorization },
      });
      assert.equal((await hiddenPlan.json()).data.workoutDays, null);

      const cleared = await fetch(`${baseUrl}/api/v1/wellness/profile`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          heightCm: 175,
          weightKg: 78,
          dietPreference: "vegan",
          experienceLevel: "beginner",
          exerciseCleared: true,
        }),
      });
      assert.equal((await cleared.json()).data.exerciseCleared, true);
      const invalidatedPlan = await fetch(`${baseUrl}/api/v1/wellness/plan`, {
        headers: { authorization: headers.authorization },
      });
      assert.equal((await invalidatedPlan.json()).data, null);

      const fullPlan = await fetch(`${baseUrl}/api/v1/wellness/plan/generate`, {
        method: "POST",
        headers,
      });
      assert.equal(fullPlan.status, 200);
      const fullPlanData = (await fullPlan.json()).data;
      assert.equal(fullPlanData.workoutDays.length, 7);
      assert.equal(
        fullPlanData.workoutDays.filter(
          (day: { activities: unknown[] }) => day.activities.length === 0,
        ).length,
        2,
      );
    } finally {
      await pool.query("DELETE FROM wellness_profiles WHERE owner_id = $1", [
        ownerId,
      ]);
      await pool.query("DELETE FROM personalized_plans WHERE owner_id = $1", [
        ownerId,
      ]);
      await pool.query("DELETE FROM health_reports WHERE owner_id = $1", [
        ownerId,
      ]);
    }
  },
);
