import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { loadGatewayConfig } from "./config.js";

const testSecret = randomBytes(32).toString("base64url");

test("loads valid gateway configuration", () => {
  const config = loadGatewayConfig({
    AUTH_SERVICE_URL: "http://localhost:3002",
    WORKOUT_SERVICE_URL: "http://localhost:3001",
    NUTRITION_SERVICE_URL: "http://localhost:3004",
    PROGRESS_SERVICE_URL: "http://localhost:3005",
    PROFILE_SERVICE_URL: "http://localhost:3006",
    PERSONALIZATION_SERVICE_URL: "http://localhost:3007",
    JWT_SECRET: testSecret,
  });

  assert.equal(config.PORT, 3000);
  assert.equal(config.UPSTREAM_TIMEOUT_MS, 5000);
  assert.equal(config.RATE_LIMIT_MAX, 120);
  assert.equal(config.REDIS_URL, "redis://localhost:6379");
});

test("rejects missing or invalid gateway configuration", () => {
  assert.throws(
    () => loadGatewayConfig({}),
    /Invalid API Gateway configuration/,
  );
  assert.throws(
    () =>
      loadGatewayConfig({
        AUTH_SERVICE_URL: "not-a-url",
        WORKOUT_SERVICE_URL: "http://localhost:3001",
        NUTRITION_SERVICE_URL: "http://localhost:3004",
        PROGRESS_SERVICE_URL: "http://localhost:3005",
        PROFILE_SERVICE_URL: "http://localhost:3006",
        PERSONALIZATION_SERVICE_URL: "http://localhost:3007",
        JWT_SECRET: testSecret,
      }),
    /Invalid API Gateway configuration/,
  );
  assert.throws(
    () =>
      loadGatewayConfig({
        AUTH_SERVICE_URL: "http://localhost:3002",
        WORKOUT_SERVICE_URL: "http://localhost:3001",
        NUTRITION_SERVICE_URL: "http://localhost:3004",
        PROGRESS_SERVICE_URL: "http://localhost:3005",
        PROFILE_SERVICE_URL: "http://localhost:3006",
        PERSONALIZATION_SERVICE_URL: "http://localhost:3007",
        JWT_SECRET: testSecret,
        REDIS_URL: "http://localhost:6379",
      }),
    /Invalid API Gateway configuration/,
  );
});
