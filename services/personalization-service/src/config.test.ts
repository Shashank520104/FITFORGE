import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { loadPersonalizationConfig } from "./config.js";

const key = randomBytes(32).toString("base64url");

test("loads Personalization Service configuration", () => {
  const config = loadPersonalizationConfig({
    DATABASE_URL: "postgres://localhost/fitforge_personalization",
    JWT_SECRET: randomBytes(32).toString("base64url"),
    REPORT_ENCRYPTION_KEY: key,
  });
  assert.equal(config.PORT, 3007);
  assert.equal(config.OLLAMA_BASE_URL, "http://ollama:11434");
  assert.equal(config.OLLAMA_MODEL, "qwen2.5:3b");
});

test("requires a 32-byte report encryption key", () => {
  assert.throws(
    () =>
      loadPersonalizationConfig({
        DATABASE_URL: "postgres://localhost/fitforge_personalization",
        JWT_SECRET: randomBytes(32).toString("base64url"),
        REPORT_ENCRYPTION_KEY: randomBytes(16).toString("base64url"),
      }),
    /32-byte key/,
  );
});
