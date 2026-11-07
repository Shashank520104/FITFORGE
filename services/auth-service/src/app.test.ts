import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { Server } from "node:http";
import { after, before, test } from "node:test";
import { Pool } from "pg";
import { createAuthApp } from "./app.js";
import { loadAuthConfig } from "./config.js";

const testDatabaseUrl = process.env.AUTH_TEST_DATABASE_URL;
const testSecret = randomBytes(32).toString("base64url");
const config = loadAuthConfig({
  DATABASE_URL: testDatabaseUrl ?? "postgres://localhost/fitforge_test",
  JWT_SECRET: testSecret,
  COOKIE_SECURE: "false",
});
const pool = new Pool({
  connectionString: testDatabaseUrl,
  connectionTimeoutMillis: 1000,
});
const app = createAuthApp(pool, config);
let server: Server;
let baseUrl: string;

before(async () => {
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
  await pool.end();
});

test("liveness does not require PostgreSQL", async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
});

test("rejects invalid registration before accessing PostgreSQL", async () => {
  for (const body of [
    { email: "invalid", password: "short" },
    { email: "user@example.test", password: "🍎".repeat(20) },
  ]) {
    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "INVALID_REQUEST");
  }
});

test("rejects malformed JSON consistently", async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "INVALID_JSON");
});

test("clears an absent refresh cookie without treating a signed-out visit as an error", async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
    method: "POST",
  });
  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
  assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/);
});

test("requires an access token to read the current account", async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/me`);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, "AUTHENTICATION_REQUIRED");
});

test(
  "registers, logs in, rotates refresh tokens, and revokes sessions",
  { skip: !testDatabaseUrl },
  async () => {
    if (!testDatabaseUrl) {
      throw new Error(
        "AUTH_TEST_DATABASE_URL is required for integration tests",
      );
    }

    const parsedUrl = new URL(testDatabaseUrl);
    assert.match(
      decodeURIComponent(parsedUrl.pathname.slice(1)),
      /(^|[-_])test($|[-_])/i,
      "AUTH_TEST_DATABASE_URL must target a database whose name contains 'test'",
    );

    await pool.query("SELECT 1");
    const email = `auth-${randomUUID()}@example.test`;
    let userId: string | undefined;

    try {
      const registration = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: "A-correct-horse-42!" }),
      });
      assert.equal(registration.status, 201);
      const registrationBody = await registration.json();
      userId = registrationBody.data.user.id;
      const registrationCookie = registration.headers.get("set-cookie");
      assert.ok(registrationCookie);
      assert.match(registrationCookie, /HttpOnly/);
      assert.equal(registrationBody.data.user.email, email);

      const profile = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: {
          authorization: `Bearer ${registrationBody.data.accessToken}`,
        },
      });
      assert.equal(profile.status, 200);

      const duplicate = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: "A-correct-horse-42!" }),
      });
      assert.equal(duplicate.status, 409);

      const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: "A-correct-horse-42!" }),
      });
      assert.equal(login.status, 200);
      const loginCookie = login.headers.get("set-cookie");
      assert.ok(loginCookie);

      const refresh = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { cookie: loginCookie.split(";")[0] },
      });
      assert.equal(refresh.status, 200);
      const rotatedCookie = refresh.headers.get("set-cookie");
      assert.ok(rotatedCookie);
      assert.notEqual(rotatedCookie.split(";")[0], loginCookie.split(";")[0]);

      const reuse = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { cookie: loginCookie.split(";")[0] },
      });
      assert.equal(reuse.status, 401);

      const logout = await fetch(`${baseUrl}/api/v1/auth/logout`, {
        method: "POST",
        headers: { cookie: rotatedCookie.split(";")[0] },
      });
      assert.equal(logout.status, 204);
      assert.match(logout.headers.get("set-cookie") ?? "", /Max-Age=0/);
    } finally {
      if (userId) {
        await pool.query("DELETE FROM users WHERE id = $1", [userId]);
      }
    }
  },
);
