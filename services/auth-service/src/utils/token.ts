import { createHash, randomBytes } from "node:crypto";
import type { Response } from "express";
import jwt from "jsonwebtoken";
import { AuthConfig } from "../config.js";
import { AuthUser } from "../types/index.js";

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function readRefreshCookie(
  cookieHeader: string | undefined,
): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  const value = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("fitforge_refresh="))
    ?.slice("fitforge_refresh=".length);

  if (!value) {
    return undefined;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

export function setRefreshCookie(
  res: Response,
  token: string | undefined,
  config: AuthConfig,
): void {
  const attributes = [
    "HttpOnly",
    "SameSite=Strict",
    "Path=/api/v1/auth",
    config.COOKIE_SECURE ? "Secure" : "",
    token
      ? `Max-Age=${config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60}`
      : "Max-Age=0",
  ].filter(Boolean);

  res.append(
    "Set-Cookie",
    `fitforge_refresh=${token ? encodeURIComponent(token) : ""}; ${attributes.join("; ")}`,
  );
}

export function issueAccessToken(user: AuthUser, config: AuthConfig): string {
  return jwt.sign({ role: "user" }, config.JWT_SECRET, {
    algorithm: "HS256",
    subject: user.id,
    expiresIn: config.ACCESS_TOKEN_TTL_SECONDS,
  });
}

export function issueRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}
