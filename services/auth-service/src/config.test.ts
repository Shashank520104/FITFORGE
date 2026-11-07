import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { loadAuthConfig } from "./config.js";

const testSecret = randomBytes(32).toString("base64url");

test("loads valid Auth Service configuration with safe defaults", () => {
  const config = loadAuthConfig({
    DATABASE_URL: "postgres://localhost/fitforge",
    JWT_SECRET: testSecret,
  });

  assert.equal(config.PORT, 3002);
  assert.equal(config.ACCESS_TOKEN_TTL_SECONDS, 900);
  assert.equal(config.REFRESH_TOKEN_TTL_DAYS, 30);
  assert.equal(config.COOKIE_SECURE, false);
});

test("defaults refresh cookies to Secure in production", () => {
  const config = loadAuthConfig({
    DATABASE_URL: "postgres://localhost/fitforge",
    JWT_SECRET: testSecret,
    NODE_ENV: "production",
  });
  assert.equal(config.COOKIE_SECURE, true);
});

test("rejects missing and unsafe Auth Service configuration", () => {
  assert.throws(() => loadAuthConfig({}), /Invalid Auth Service configuration/);
  assert.throws(
    () =>
      loadAuthConfig({
        DATABASE_URL: "postgres://localhost/fitforge",
        JWT_SECRET: "short",
      }),
    /Invalid Auth Service configuration/,
  );
});
