import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { Server } from "node:http";
import { after, before, test } from "node:test";
import { Pool } from "pg";
import { createNutritionApp } from "./app.js";
import { loadNutritionConfig } from "./config.js";

const databaseUrl = process.env.NUTRITION_TEST_DATABASE_URL;
const config = loadNutritionConfig({
  DATABASE_URL: databaseUrl ?? "postgres://localhost/fitforge_nutrition_test",
  JWT_SECRET: randomBytes(32).toString("base64url"),
});
const pool = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 1000,
});
let server: Server;
let baseUrl: string;

before(async () => {
  server = createNutritionApp(pool, config).listen(0);
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
  await pool.end();
});

test("liveness works without PostgreSQL", async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
});

test("protects food and nutrition endpoints", async () => {
  const response = await fetch(`${baseUrl}/api/v1/foods`);
  assert.equal(response.status, 401);
  const estimateResponse = await fetch(`${baseUrl}/api/v1/foods/estimate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Rice", servingUnit: "g" }),
  });
  assert.equal(estimateResponse.status, 401);
  const availabilityResponse = await fetch(`${baseUrl}/api/v1/foods/estimate`);
  assert.equal(availabilityResponse.status, 401);
  const coachResponse = await fetch(`${baseUrl}/api/v1/coach/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: "Can you help me get started?" }),
  });
  assert.equal(coachResponse.status, 401);
});

test("validates coach questions before calling the local model", async () => {
  const token = await import("jsonwebtoken").then(({ default: jwt }) =>
    jwt.sign({}, config.JWT_SECRET, {
      subject: randomUUID(),
      algorithm: "HS256",
    }),
  );
  const response = await fetch(`${baseUrl}/api/v1/coach/chat`, {
    method: "POST",
    headers: {
      authorization: ["Bearer", token].join(" "),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      question: " ",
      history: Array.from({ length: 9 }, () => ({
        role: "user",
        content: "Hello",
      })),
    }),
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "INVALID_COACH_MESSAGE");
});

test("answers coach questions through the configured local model", async () => {
  const token = await import("jsonwebtoken").then(({ default: jwt }) =>
    jwt.sign({}, config.JWT_SECRET, {
      subject: randomUUID(),
      algorithm: "HS256",
    }),
  );
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), `${config.OLLAMA_BASE_URL}/api/chat`);
    const requestBody = JSON.parse(String(init?.body));
    assert.equal(requestBody.model, config.OLLAMA_MODEL);
    assert.equal(requestBody.stream, false);
    assert.match(requestBody.messages[0].content, /Do not diagnose/);
    assert.equal(requestBody.messages[1].content, "I am new to exercise.");
    assert.equal(requestBody.messages[2].content, "What is a gentle start?");
    return Response.json({
      message: { content: "Try a comfortable 10-minute walk." },
    });
  };

  try {
    const response = await originalFetch(`${baseUrl}/api/v1/coach/chat`, {
      method: "POST",
      headers: {
        authorization: ["Bearer", token].join(" "),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        question: "What is a gentle start?",
        history: [{ role: "user", content: "I am new to exercise." }],
      }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data, {
      reply: "Try a comfortable 10-minute walk.",
      provider: "Ollama (local)",
      model: config.OLLAMA_MODEL,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("streams coach answers from the configured local model", async () => {
  const token = await import("jsonwebtoken").then(({ default: jwt }) =>
    jwt.sign({}, config.JWT_SECRET, {
      subject: randomUUID(),
      algorithm: "HS256",
    }),
  );
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), `${config.OLLAMA_BASE_URL}/api/chat`);
    const requestBody = JSON.parse(String(init?.body));
    assert.equal(requestBody.model, config.OLLAMA_MODEL);
    assert.equal(requestBody.stream, true);
    assert.match(requestBody.messages[0].content, /Do not diagnose/);
    return new Response(
      [
        JSON.stringify({ message: { content: "Try a " }, done: false }),
        JSON.stringify({ message: { content: "short walk." }, done: false }),
        JSON.stringify({ message: { content: "" }, done: true }),
      ].join("\n") + "\n",
      { headers: { "content-type": "application/x-ndjson" } },
    );
  };

  try {
    const response = await originalFetch(`${baseUrl}/api/v1/coach/stream`, {
      method: "POST",
      headers: {
        authorization: ["Bearer", token].join(" "),
        "content-type": "application/json",
      },
      body: JSON.stringify({ question: "How do I start?" }),
    });
    assert.equal(response.status, 200);
    assert.match(
      response.headers.get("content-type") ?? "",
      /text\/event-stream/,
    );
    const events = (await response.text())
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data: "))
      .map((line) => JSON.parse(line.slice(6)));
    assert.deepEqual(events, [
      { type: "token", token: "Try a " },
      { type: "token", token: "short walk." },
      {
        type: "done",
        provider: "Ollama (local)",
        model: config.OLLAMA_MODEL,
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reports whether the configured local model is available", async () => {
  const token = await import("jsonwebtoken").then(({ default: jwt }) =>
    jwt.sign({}, config.JWT_SECRET, {
      subject: randomUUID(),
      algorithm: "HS256",
    }),
  );
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    if (String(input) === `${config.OLLAMA_BASE_URL}/api/tags`) {
      return Response.json({ models: [{ name: config.OLLAMA_MODEL }] });
    }
    return originalFetch(input);
  };
  try {
    const response = await originalFetch(`${baseUrl}/api/v1/foods/estimate`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data, { available: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects invalid tokens and malformed input before database operations", async () => {
  const unauthorized = await fetch(`${baseUrl}/api/v1/foods`, {
    headers: { authorization: "Bearer invalid" },
  });
  assert.equal(unauthorized.status, 401);

  const missingDate = await fetch(`${baseUrl}/api/v1/nutrition/logs`, {
    headers: { authorization: "Bearer invalid" },
  });
  assert.equal(missingDate.status, 401);
});

test("estimates nutrients through the configured local Ollama model", async () => {
  const token = await import("jsonwebtoken").then(({ default: jwt }) =>
    jwt.sign({}, config.JWT_SECRET, {
      subject: randomUUID(),
      algorithm: "HS256",
    }),
  );
  const originalFetch = globalThis.fetch;
  const values = {
    caloriesPer100: 130,
    proteinPer100: 2.7,
    carbohydratesPer100: 28,
    fatPer100: 0.3,
    fiberPer100: 0.4,
    sodiumMgPer100: 1,
    calciumMgPer100: 10,
    ironMgPer100: 0.2,
    potassiumMgPer100: 35,
    magnesiumMgPer100: 12,
  };
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), `${config.OLLAMA_BASE_URL}/api/chat`);
    const requestBody = JSON.parse(String(init?.body));
    assert.equal(requestBody.model, config.OLLAMA_MODEL);
    assert.deepEqual(requestBody.format.required, Object.keys(values));
    assert.match(requestBody.messages[1].content, /Rice/);
    return Response.json({ message: { content: JSON.stringify(values) } });
  };

  try {
    const response = await originalFetch(`${baseUrl}/api/v1/foods/estimate`, {
      method: "POST",
      headers: {
        authorization: ["Bearer", token].join(" "),
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Rice", servingUnit: "g" }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.provider, "Ollama (local)");
    assert.equal(body.data.model, config.OLLAMA_MODEL);
    assert.equal(body.data.proteinPer100, values.proteinPer100);
    assert.equal(body.data.calciumMgPer100, values.calciumMgPer100);
    assert.match(body.data.sourceLabel, /local Ollama/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reports when the local Ollama model is missing", async () => {
  const token = await import("jsonwebtoken").then(({ default: jwt }) =>
    jwt.sign({}, config.JWT_SECRET, {
      subject: randomUUID(),
      algorithm: "HS256",
    }),
  );
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 404 });

  try {
    const response = await originalFetch(`${baseUrl}/api/v1/foods/estimate`, {
      method: "POST",
      headers: {
        authorization: ["Bearer", token].join(" "),
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Rice", servingUnit: "g" }),
    });
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.error.code, "AI_MODEL_NOT_FOUND");
    assert.match(body.error.message, /docker compose exec ollama ollama pull/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reports when the local Ollama service is unavailable", async () => {
  const token = await import("jsonwebtoken").then(({ default: jwt }) =>
    jwt.sign({}, config.JWT_SECRET, {
      subject: randomUUID(),
      algorithm: "HS256",
    }),
  );
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError("fetch failed");
  };

  try {
    const response = await originalFetch(`${baseUrl}/api/v1/foods/estimate`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Rice", servingUnit: "g" }),
    });
    assert.equal(response.status, 502);
    const body = await response.json();
    assert.equal(body.error.code, "AI_PROVIDER_UNAVAILABLE");
    assert.match(body.error.message, /Ollama is running/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test(
  "creates owner-scoped foods and immutable meal nutrient snapshots",
  { skip: !databaseUrl },
  async () => {
    if (!databaseUrl) {
      throw new Error(
        "NUTRITION_TEST_DATABASE_URL is required for integration tests",
      );
    }
    const databaseName = decodeURIComponent(
      new URL(databaseUrl).pathname.slice(1),
    );
    assert.match(databaseName, /(^|[-_])test($|[-_])/i);

    await pool.query("SELECT 1");
    const userId = randomUUID();
    const otherUserId = randomUUID();
    const token = await import("jsonwebtoken").then(({ default: jwt }) =>
      jwt.sign({}, config.JWT_SECRET, { subject: userId, algorithm: "HS256" }),
    );
    const otherToken = await import("jsonwebtoken").then(({ default: jwt }) =>
      jwt.sign({}, config.JWT_SECRET, {
        subject: otherUserId,
        algorithm: "HS256",
      }),
    );
    const foodResponse = await fetch(`${baseUrl}/api/v1/foods`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Test food",
        servingUnit: "g",
        caloriesPer100: 200,
        proteinPer100: 10,
        carbohydratesPer100: 20,
        fatPer100: 5,
        fiberPer100: 3,
        sodiumMgPer100: 50,
        calciumMgPer100: 20,
        ironMgPer100: 1,
        potassiumMgPer100: 80,
        magnesiumMgPer100: 10,
        sourceLabel: "User-entered test data",
      }),
    });
    assert.equal(foodResponse.status, 201);
    const food = (await foodResponse.json()).data;

    try {
      const otherFoods = await fetch(`${baseUrl}/api/v1/foods`, {
        headers: { authorization: `Bearer ${otherToken}` },
      });
      assert.equal((await otherFoods.json()).data.length, 0);

      const mealResponse = await fetch(`${baseUrl}/api/v1/nutrition/logs`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          date: "2026-10-26",
          mealType: "lunch",
          items: [{ foodId: food.id, servingAmount: 150 }],
        }),
      });
      assert.equal(mealResponse.status, 201);
      const meal = (await mealResponse.json()).data;

      await fetch(`${baseUrl}/api/v1/foods/${food.id}`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ caloriesPer100: 400 }),
      });

      const logs = await fetch(
        `${baseUrl}/api/v1/nutrition/logs?date=2026-10-26`,
        {
          headers: { authorization: `Bearer ${token}` },
        },
      );
      const logBody = await logs.json();
      assert.equal(logBody.data.length, 1);
      assert.equal(Number(logBody.data[0].items[0].calories), 300);
      assert.equal(logBody.total.calories, 300);
      assert.equal(Number(logBody.total.calciumMg), 30);
      assert.equal(Number(logBody.total.ironMg), 1.5);

      const forbidden = await fetch(
        `${baseUrl}/api/v1/nutrition/logs?date=2026-10-26`,
        {
          headers: { authorization: `Bearer ${otherToken}` },
        },
      );
      assert.equal((await forbidden.json()).data.length, 0);

      const deleteLog = await fetch(
        `${baseUrl}/api/v1/nutrition/logs/${meal.id}`,
        {
          method: "DELETE",
          headers: { authorization: `Bearer ${token}` },
        },
      );
      assert.equal(deleteLog.status, 204);
    } finally {
      await pool.query(
        "DELETE FROM meal_logs WHERE owner_id = ANY($1::uuid[])",
        [[userId, otherUserId]],
      );
      await pool.query("DELETE FROM foods WHERE id = $1 AND owner_id = $2", [
        food.id,
        userId,
      ]);
    }
  },
);
