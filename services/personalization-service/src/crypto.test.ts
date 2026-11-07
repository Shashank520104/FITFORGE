import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { decryptReport, encryptReport } from "./crypto.js";

test("encrypts reports at rest and detects modified ciphertext", () => {
  const key = randomBytes(32).toString("base64url");
  const original = Buffer.from("%PDF-1.7 synthetic report fixture");
  const encrypted = encryptReport(original, key);

  assert.notDeepEqual(encrypted.ciphertext, original);
  assert.deepEqual(decryptReport(encrypted, key), original);

  const modified = {
    ...encrypted,
    ciphertext: Buffer.from(encrypted.ciphertext),
  };
  modified.ciphertext[0] ^= 1;
  assert.throws(() => decryptReport(modified, key));
});
