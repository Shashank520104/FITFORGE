import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { loadNutritionConfig } from "./config.js";

test("loads Nutrition Service configuration", () => {
  const config = loadNutritionConfig({
    DATABASE_URL: "postgres://localhost/fitforge_nutrition",
    JWT_SECRET: randomBytes(32).toString("base64url"),
  });
  assert.equal(config.PORT, 3004);
  assert.equal(config.OLLAMA_BASE_URL, "http://ollama:11434");
  assert.equal(config.OLLAMA_MODEL, "qwen2.5:3b");
});

test("rejects missing configuration", () => {
  assert.throws(
    () => loadNutritionConfig({}),
    /Invalid Nutrition Service configuration/,
  );
});
