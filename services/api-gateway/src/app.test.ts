import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Server } from "node:http";
import { after, before, test } from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import { createGatewayApp } from "./app.js";
import { loadGatewayConfig } from "./config.js";
import { InMemoryRateLimitStore } from "./rateLimitStore.js";

const secret = randomBytes(32).toString("base64url");
const openApiDocument =
  "openapi: 3.1.0\ninfo:\n  title: FITFORGE API\n  version: 1.0.0\n";
const createTestGateway = (config: ReturnType<typeof loadGatewayConfig>) =>
  createGatewayApp(config, new InMemoryRateLimitStore(), openApiDocument);
const upstreamApp = express();
upstreamApp.use(express.raw({ type: "*/*", limit: "9mb" }));
upstreamApp.use((req, res, next) => {
  if (req.path === "/ready" && req.method === "GET") {
    res.status(200).json({ status: "ready" });
    return;
  }
  if (req.path === "/api/v1/auth/slow") {
    setTimeout(() => res.status(200).end(), 1000);
    return;
  }
  if (req.path === "/api/v1/foods/estimate" && req.method === "POST") {
    setTimeout(() => res.status(200).end(), 250);
    return;
  }
  if (req.path === "/api/v1/coach/stream" && req.method === "POST") {
    res.setHeader("content-type", "text/event-stream; charset=utf-8");
    res.write('data: {"type":"token","token":"Hello"}\n\n');
    setTimeout(() => {
      res.write('data: {"type":"done"}\n\n');
      res.end();
    }, 25);
    return;
  }
  if (req.path.startsWith("/api/v1/")) {
    res.status(200).json({
      path: req.originalUrl,
      requestId: req.header("x-request-id"),
      authorization: req.header("authorization"),
      cookie: req.header("cookie"),
      filename: req.header("x-file-name"),
      bodySize: Buffer.isBuffer(req.body) ? req.body.length : null,
    });
    return;
  }
  next();
});

let upstream: Server;
let gateway: Server;
let baseUrl: string;

before(async () => {
  upstream = upstreamApp.listen(0);
  await new Promise<void>((resolve, reject) => {
    upstream.once("error", reject);
    upstream.once("listening", resolve);
  });
  const upstreamAddress = upstream.address();
  assert.ok(upstreamAddress && typeof upstreamAddress !== "string");
  const serviceUrl = `http://127.0.0.1:${upstreamAddress.port}`;

  const app = createTestGateway(
    loadGatewayConfig({
      AUTH_SERVICE_URL: serviceUrl,
      WORKOUT_SERVICE_URL: serviceUrl,
      NUTRITION_SERVICE_URL: serviceUrl,
      PROGRESS_SERVICE_URL: serviceUrl,
      PROFILE_SERVICE_URL: serviceUrl,
      PERSONALIZATION_SERVICE_URL: serviceUrl,
      JWT_SECRET: secret,
      RATE_LIMIT_MAX: "30",
    }),
  );
  gateway = app.listen(0);
  await new Promise<void>((resolve, reject) => {
    gateway.once("error", reject);
    gateway.once("listening", resolve);
  });
  const gatewayAddress = gateway.address();
  assert.ok(gatewayAddress && typeof gatewayAddress !== "string");
  baseUrl = `http://127.0.0.1:${gatewayAddress.port}`;
});

after(async () => {
  await Promise.all(
    [upstream, gateway].map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
});

test("liveness and readiness distinguish gateway from dependencies", async () => {
  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200);
  const ready = await fetch(`${baseUrl}/ready`);
  assert.equal(ready.status, 200);
});

test("serves the OpenAPI document and interactive documentation", async () => {
  const document = await fetch(`${baseUrl}/openapi.yaml`);
  assert.equal(document.status, 200);
  assert.match(await document.text(), /openapi: 3\.1\.0/);

  const docs = await fetch(`${baseUrl}/docs/`);
  assert.equal(docs.status, 200);
  assert.match(await docs.text(), /swagger-ui/);
});

test("proxies auth requests and preserves cookie headers", async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/login?source=test`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: "fitforge_refresh=opaque",
    },
    body: JSON.stringify({ email: "test@example.com" }),
  });

  assert.equal(response.status, 200);
  assert.ok(response.headers.get("x-request-id"));
  const data = await response.json();
  assert.equal(data.path, "/api/v1/auth/login?source=test");
  assert.equal(data.cookie, "fitforge_refresh=opaque");
  assert.ok(data.requestId);
});

test("maps malformed JSON and upstream timeouts to clear errors", async () => {
  const malformedJson = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
  assert.equal(malformedJson.status, 400);
  assert.equal((await malformedJson.json()).error.code, "INVALID_JSON");

  const config = loadGatewayConfig({
    AUTH_SERVICE_URL: "http://127.0.0.1",
    WORKOUT_SERVICE_URL: "http://127.0.0.1",
    NUTRITION_SERVICE_URL: "http://127.0.0.1",
    PROGRESS_SERVICE_URL: "http://127.0.0.1",
    PROFILE_SERVICE_URL: "http://127.0.0.1",
    PERSONALIZATION_SERVICE_URL: "http://127.0.0.1",
    JWT_SECRET: secret,
    UPSTREAM_TIMEOUT_MS: "100",
  });
  const address = upstream.address();
  assert.ok(address && typeof address !== "string");
  const timedUpstreamUrl = `http://127.0.0.1:${address.port}`;
  config.AUTH_SERVICE_URL = timedUpstreamUrl;
  config.NUTRITION_SERVICE_URL = timedUpstreamUrl;
  const timedGateway = createTestGateway(config).listen(0);
  await new Promise<void>((resolve, reject) => {
    timedGateway.once("error", reject);
    timedGateway.once("listening", resolve);
  });
  const timedAddress = timedGateway.address();
  assert.ok(timedAddress && typeof timedAddress !== "string");

  try {
    const timeout = await fetch(
      `http://127.0.0.1:${timedAddress.port}/api/v1/auth/slow`,
    );
    assert.equal(timeout.status, 504);
    assert.equal((await timeout.json()).error.code, "UPSTREAM_TIMEOUT");

    const token = jwt.sign({ role: "user" }, secret, {
      subject: "user-123",
      expiresIn: 60,
    });
    const estimate = await fetch(
      `http://127.0.0.1:${timedAddress.port}/api/v1/foods/estimate`,
      {
        method: "POST",
        headers: {
          authorization: ["Bearer", token].join(" "),
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "Rice", servingUnit: "g" }),
      },
    );
    assert.equal(estimate.status, 200);
  } finally {
    await new Promise<void>((resolve, reject) => {
      timedGateway.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("requires a valid access token for workout-plan routes", async () => {
  const denied = await fetch(`${baseUrl}/api/v1/workout-plans`);
  assert.equal(denied.status, 401);
  const deniedSession = await fetch(`${baseUrl}/api/v1/workout-sessions`);
  assert.equal(deniedSession.status, 401);
  const deniedProfile = await fetch(`${baseUrl}/api/v1/profile`);
  assert.equal(deniedProfile.status, 401);
  const deniedCoach = await fetch(`${baseUrl}/api/v1/coach/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: "Can you help me get started?" }),
  });
  assert.equal(deniedCoach.status, 401);
  const deniedReport = await fetch(`${baseUrl}/api/v1/wellness/reports`, {
    method: "POST",
    headers: { "content-type": "application/pdf" },
    body: "%PDF-1.7",
  });
  assert.equal(deniedReport.status, 401);

  const token = jwt.sign({ role: "user" }, secret, {
    subject: "user-123",
    expiresIn: 60,
  });
  const allowed = await fetch(`${baseUrl}/api/v1/workout-plans?page=1`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(allowed.status, 200);
  assert.equal((await allowed.json()).authorization, `Bearer ${token}`);

  const allowedProfile = await fetch(`${baseUrl}/api/v1/profile`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(allowedProfile.status, 200);
  assert.equal((await allowedProfile.json()).path, "/api/v1/profile");

  const allowedActivity = await fetch(
    `${baseUrl}/api/v1/activity?date=2025-01-20`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  assert.equal(allowedActivity.status, 200);
  assert.equal(
    (await allowedActivity.json()).path,
    "/api/v1/activity?date=2025-01-20",
  );

  const allowedCoach = await fetch(`${baseUrl}/api/v1/coach/chat`, {
    method: "POST",
    headers: {
      authorization: ["Bearer", token].join(" "),
      "content-type": "application/json",
    },
    body: JSON.stringify({ question: "Can you help me get started?" }),
  });
  assert.equal(allowedCoach.status, 200);
  assert.equal((await allowedCoach.json()).path, "/api/v1/coach/chat");

  const allowedCoachStream = await fetch(`${baseUrl}/api/v1/coach/stream`, {
    method: "POST",
    headers: {
      authorization: ["Bearer", token].join(" "),
      "content-type": "application/json",
    },
    body: JSON.stringify({ question: "Can you help me get started?" }),
  });
  assert.equal(allowedCoachStream.status, 200);
  assert.match(
    allowedCoachStream.headers.get("content-type") ?? "",
    /text\/event-stream/,
  );
  assert.match(await allowedCoachStream.text(), /"token":"Hello"/);

  const largeReport = await fetch(`${baseUrl}/api/v1/wellness/reports`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/pdf",
      "x-file-name": encodeURIComponent("sample-report.pdf"),
    },
    body: Buffer.alloc(1_200_000, 65),
  });
  assert.equal(largeReport.status, 200);
  const reportProxy = await largeReport.json();
  assert.equal(reportProxy.filename, "sample-report.pdf");
  assert.equal(reportProxy.bodySize, 1_200_000);
});

test("rejects invalid tokens and unknown routes", async () => {
  const denied = await fetch(`${baseUrl}/api/v1/workouts`, {
    headers: { authorization: "Bearer invalid" },
  });
  assert.equal(denied.status, 401);

  const missing = await fetch(`${baseUrl}/api/v1/unknown`);
  assert.equal(missing.status, 404);
});

test("applies a rate limit to API routes", async () => {
  const config = loadGatewayConfig({
    AUTH_SERVICE_URL: "http://127.0.0.1:1",
    WORKOUT_SERVICE_URL: "http://127.0.0.1:1",
    NUTRITION_SERVICE_URL: "http://127.0.0.1:1",
    PROGRESS_SERVICE_URL: "http://127.0.0.1:1",
    PROFILE_SERVICE_URL: "http://127.0.0.1:1",
    PERSONALIZATION_SERVICE_URL: "http://127.0.0.1:1",
    JWT_SECRET: secret,
    RATE_LIMIT_MAX: "1",
  });
  const app = createTestGateway(config);
  const server = app.listen(0);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.once("listening", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/api/v1/exercises`;

  try {
    const first = await fetch(url);
    assert.equal(first.status, 503);
    const resetInSeconds = Number(first.headers.get("ratelimit-reset"));
    assert.ok(resetInSeconds >= 0 && resetInSeconds <= 60);
    const limited = await fetch(url);
    assert.equal(limited.status, 429);
    assert.equal((await limited.json()).error.code, "RATE_LIMIT_EXCEEDED");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("fails closed when the shared rate-limit store is unavailable", async () => {
  const config = loadGatewayConfig({
    AUTH_SERVICE_URL: "http://127.0.0.1:1",
    WORKOUT_SERVICE_URL: "http://127.0.0.1:1",
    NUTRITION_SERVICE_URL: "http://127.0.0.1:1",
    PROGRESS_SERVICE_URL: "http://127.0.0.1:1",
    PROFILE_SERVICE_URL: "http://127.0.0.1:1",
    PERSONALIZATION_SERVICE_URL: "http://127.0.0.1:1",
    JWT_SECRET: secret,
  });
  const app = createGatewayApp(
    config,
    {
      isReady: false,
      async consume() {
        throw new Error("Redis unavailable");
      },
    },
    openApiDocument,
  );
  const server = app.listen(0);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.once("listening", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/exercises`,
    );
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "RATE_LIMIT_UNAVAILABLE");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
