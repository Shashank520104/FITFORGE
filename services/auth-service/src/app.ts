import bcrypt from "bcrypt";
import { createHash, randomBytes } from "node:crypto";
import express, { ErrorRequestHandler, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { Pool, PoolClient } from "pg";
import { z } from "zod";
import { AuthConfig } from "./config.js";

type AuthUser = {
  id: string;
  email: string;
};

const registerSchema = z
  .object({
    email: z.email().max(254),
    password: z
      .string()
      .min(12)
      .max(72)
      .refine((value) => Buffer.byteLength(value, "utf8") <= 72),
  })
  .strict();

const loginSchema = z
  .object({
    email: z.email().max(254),
    password: z
      .string()
      .min(1)
      .max(72)
      .refine((value) => Buffer.byteLength(value, "utf8") <= 72),
  })
  .strict();

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function readRefreshCookie(
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

function setRefreshCookie(
  res: express.Response,
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

function issueAccessToken(user: AuthUser, config: AuthConfig): string {
  return jwt.sign({ role: "user" }, config.JWT_SECRET, {
    algorithm: "HS256",
    subject: user.id,
    expiresIn: config.ACCESS_TOKEN_TTL_SECONDS,
  });
}

function issueRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

async function createRefreshSession(
  executor: Pool | PoolClient,
  userId: string,
  token: string,
  config: AuthConfig,
): Promise<void> {
  await executor.query(
    `INSERT INTO refresh_sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + ($3 * interval '1 day'))`,
    [userId, hashRefreshToken(token), config.REFRESH_TOKEN_TTL_DAYS],
  );
}

function asyncRoute(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function createAuthApp(pool: Pool, config: AuthConfig): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));

  app.get("/health", (_req, res) => {
    res
      .status(200)
      .json({ success: true, service: "auth-service", status: "healthy" });
  });

  app.get(
    "/ready",
    asyncRoute(async (_req, res) => {
      await pool.query("SELECT 1");
      res
        .status(200)
        .json({ success: true, service: "auth-service", status: "ready" });
    }),
  );

  app.post(
    "/api/v1/auth/register",
    asyncRoute(async (req, res) => {
      const validatedInput = registerSchema.safeParse(req.body);
      if (!validatedInput.success) {
        throw new HttpError(
          400,
          "INVALID_REQUEST",
          z.prettifyError(validatedInput.error),
        );
      }

      const email = validatedInput.data.email.trim().toLowerCase();
      const passwordHash = await bcrypt.hash(validatedInput.data.password, 12);
      const databaseClient = await pool.connect();

      try {
        await databaseClient.query("BEGIN");
        const insertedUserResult = await databaseClient.query<AuthUser>(
          `INSERT INTO users (email, password_hash)
         VALUES ($1, $2)
         RETURNING id, email`,
          [email, passwordHash],
        );
        const user = insertedUserResult.rows[0];
        if (!user) {
          throw new Error("User insert returned no row");
        }

        const refreshToken = issueRefreshToken();
        await createRefreshSession(
          databaseClient,
          user.id,
          refreshToken,
          config,
        );
        await databaseClient.query("COMMIT");

        setRefreshCookie(res, refreshToken, config);
        res.status(201).json({
          success: true,
          data: {
            user,
            accessToken: issueAccessToken(user, config),
            tokenType: "Bearer",
            expiresIn: config.ACCESS_TOKEN_TTL_SECONDS,
          },
        });
      } catch (error) {
        await databaseClient.query("ROLLBACK");
        if (isUniqueViolation(error)) {
          throw new HttpError(
            409,
            "EMAIL_ALREADY_REGISTERED",
            "Email is already registered",
          );
        }
        throw error;
      } finally {
        databaseClient.release();
      }
    }),
  );

  app.post(
    "/api/v1/auth/login",
    asyncRoute(async (req, res) => {
      const validatedInput = loginSchema.safeParse(req.body);
      if (!validatedInput.success) {
        throw new HttpError(
          400,
          "INVALID_REQUEST",
          z.prettifyError(validatedInput.error),
        );
      }

      const accountResult = await pool.query<
        AuthUser & { password_hash: string }
      >("SELECT id, email, password_hash FROM users WHERE email = $1", [
        validatedInput.data.email.trim().toLowerCase(),
      ]);
      const account = accountResult.rows[0];
      if (
        !account ||
        !(await bcrypt.compare(
          validatedInput.data.password,
          account.password_hash,
        ))
      ) {
        throw new HttpError(
          401,
          "INVALID_CREDENTIALS",
          "Email or password is incorrect",
        );
      }

      const user = { id: account.id, email: account.email };
      const refreshToken = issueRefreshToken();
      await createRefreshSession(pool, user.id, refreshToken, config);

      setRefreshCookie(res, refreshToken, config);
      res.status(200).json({
        success: true,
        data: {
          user,
          accessToken: issueAccessToken(user, config),
          tokenType: "Bearer",
          expiresIn: config.ACCESS_TOKEN_TTL_SECONDS,
        },
      });
    }),
  );

  app.post(
    "/api/v1/auth/refresh",
    asyncRoute(async (req, res) => {
      const presentedToken = readRefreshCookie(req.headers.cookie);
      if (!presentedToken) {
        setRefreshCookie(res, undefined, config);
        res.status(204).end();
        return;
      }

      const databaseClient = await pool.connect();
      try {
        await databaseClient.query("BEGIN");
        const revokedSessionResult = await databaseClient.query<AuthUser>(
          `UPDATE refresh_sessions AS session
         SET revoked_at = now()
         FROM users
         WHERE session.user_id = users.id
           AND session.token_hash = $1
           AND session.revoked_at IS NULL
           AND session.expires_at > now()
         RETURNING users.id, users.email`,
          [hashRefreshToken(presentedToken)],
        );
        const user = revokedSessionResult.rows[0];
        if (!user) {
          setRefreshCookie(res, undefined, config);
          throw new HttpError(
            401,
            "INVALID_REFRESH_TOKEN",
            "Refresh session is missing or expired",
          );
        }

        const nextRefreshToken = issueRefreshToken();
        await createRefreshSession(
          databaseClient,
          user.id,
          nextRefreshToken,
          config,
        );
        await databaseClient.query("COMMIT");

        setRefreshCookie(res, nextRefreshToken, config);
        res.status(200).json({
          success: true,
          data: {
            user,
            accessToken: issueAccessToken(user, config),
            tokenType: "Bearer",
            expiresIn: config.ACCESS_TOKEN_TTL_SECONDS,
          },
        });
      } catch (error) {
        await databaseClient.query("ROLLBACK");
        throw error;
      } finally {
        databaseClient.release();
      }
    }),
  );

  app.post(
    "/api/v1/auth/logout",
    asyncRoute(async (req, res) => {
      const presentedToken = readRefreshCookie(req.headers.cookie);
      if (presentedToken) {
        await pool.query(
          "UPDATE refresh_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL",
          [hashRefreshToken(presentedToken)],
        );
      }

      setRefreshCookie(res, undefined, config);
      res.status(204).end();
    }),
  );

  app.get(
    "/api/v1/auth/me",
    asyncRoute(async (req, res) => {
      const authorization = req.header("authorization");
      const match = authorization?.match(/^Bearer ([^\s]+)$/);
      if (!match) {
        throw new HttpError(
          401,
          "AUTHENTICATION_REQUIRED",
          "A bearer access token is required",
        );
      }

      let subject: string;
      try {
        const payload = jwt.verify(match[1], config.JWT_SECRET, {
          algorithms: ["HS256"],
        });
        if (typeof payload === "string" || typeof payload.sub !== "string") {
          throw new Error("Invalid token subject");
        }
        subject = payload.sub;
      } catch {
        throw new HttpError(
          401,
          "INVALID_ACCESS_TOKEN",
          "Access token is invalid or expired",
        );
      }

      const accountResult = await pool.query<AuthUser>(
        "SELECT id, email FROM users WHERE id = $1",
        [subject],
      );
      const user = accountResult.rows[0];
      if (!user) {
        throw new HttpError(
          401,
          "INVALID_ACCESS_TOKEN",
          "Access token is invalid or expired",
        );
      }

      res.status(200).json({ success: true, data: user });
    }),
  );

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: "ROUTE_NOT_FOUND", message: "Route not found" },
    });
  });

  const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    if (error instanceof HttpError) {
      res.status(error.status).json({
        success: false,
        error: { code: error.code, message: error.message },
      });
      return;
    }

    if (typeof error === "object" && error !== null && "type" in error) {
      if (error.type === "entity.too.large") {
        res.status(413).json({
          success: false,
          error: {
            code: "REQUEST_TOO_LARGE",
            message: "Request body exceeds the size limit",
          },
        });
        return;
      }
      if (error.type === "entity.parse.failed") {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_JSON",
            message: "Request body must contain valid JSON",
          },
        });
        return;
      }
    }

    console.error(
      "Auth Service request failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    res.status(503).json({
      success: false,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Authentication service is unavailable",
      },
    });
  };

  app.use(errorHandler);
  return app;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}
