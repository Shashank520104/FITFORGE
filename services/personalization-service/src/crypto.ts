import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedValue = {
  ciphertext: Buffer;
  initializationVector: Buffer;
  authenticationTag: Buffer;
};

function keyFrom(encodedKey: string): Buffer {
  const key = Buffer.from(encodedKey, "base64url");
  if (key.length !== 32) {
    throw new Error("Report encryption key must contain exactly 32 bytes");
  }
  return key;
}

export function encryptReport(
  plaintext: Buffer,
  encodedKey: string,
): EncryptedValue {
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    keyFrom(encodedKey),
    initializationVector,
  );
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    ciphertext,
    initializationVector,
    authenticationTag: cipher.getAuthTag(),
  };
}

export function decryptReport(
  encrypted: EncryptedValue,
  encodedKey: string,
): Buffer {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyFrom(encodedKey),
    encrypted.initializationVector,
  );
  decipher.setAuthTag(encrypted.authenticationTag);
  return Buffer.concat([
    decipher.update(encrypted.ciphertext),
    decipher.final(),
  ]);
}
