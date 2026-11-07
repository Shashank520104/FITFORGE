import { randomUUID } from "node:crypto";
import express, {
  ErrorRequestHandler,
  Request,
  RequestHandler,
  Response,
} from "express";
import jwt from "jsonwebtoken";
import swaggerUi from "swagger-ui-express";
import { GatewayConfig } from "./config.js";
import { RateLimitStore } from "./rateLimitStore.js";

const FOOD_ESTIMATE_TIMEOUT_MS = 120000;
const AI_COACH_TIMEOUT_MS = 120000;
const WELLNESS_AI_TIMEOUT_MS = 330000;

function errorResponse(
  res: Response,
  status: number,
  code: string,
  message: string,
): void {
  res.status(status).json({
    success: false,
    error: { code, message },
  });
}

function createRateLimiter(
  config: GatewayConfig,
  store: RateLimitStore,
): RequestHandler {
  return (req, res, next) => {
    const requestTime = Date.now();
    const clientIp = req.ip ?? "unknown";
    void store
      .consume(
        clientIp,
        config.RATE_LIMIT_MAX,
        config.RATE_LIMIT_WINDOW_MS,
        requestTime,
      )
      .then((rateLimitStatus) => {
        res.setHeader("RateLimit-Limit", config.RATE_LIMIT_MAX);
        res.setHeader(
          "RateLimit-Remaining",
          Math.max(0, config.RATE_LIMIT_MAX - rateLimitStatus.count),
        );
        res.setHeader(
          "RateLimit-Reset",
          Math.max(0, Math.ceil((rateLimitStatus.resetAt - Date.now()) / 1000)),
        );
        if (rateLimitStatus.count > config.RATE_LIMIT_MAX) {
          errorResponse(res, 429, "RATE_LIMIT_EXCEEDED", "Too many requests");
          return;
        }

        next();
      })
      .catch((error: unknown) => {
        console.error(
          "API Gateway rate-limit store failed",
          error instanceof Error ? error.name : "UnknownError",
        );
        errorResponse(
          res,
          503,
          "RATE_LIMIT_UNAVAILABLE",
          "Request protection is temporarily unavailable",
        );
      });
  };
}

function authenticate(config: GatewayConfig): RequestHandler {
  return (req, res, next) => {
    const match = req.header("authorization")?.match(/^Bearer ([^\s]+)$/);
    if (!match) {
      errorResponse(
        res,
        401,
        "AUTHENTICATION_REQUIRED",
        "A bearer access token is required",
      );
      return;
    }

    try {
      const payload = jwt.verify(match[1], config.JWT_SECRET, {
        algorithms: ["HS256"],
      });
      if (
        typeof payload === "string" ||
        typeof payload.sub !== "string" ||
        typeof payload.role !== "string"
      ) {
        throw new Error("Invalid access token claims");
      }

      next();
    } catch {
      errorResponse(
        res,
        401,
        "INVALID_ACCESS_TOKEN",
        "Access token is invalid or expired",
      );
    }
  };
}

function proxy(
  baseUrl: string,
  timeoutMs: number,
  requestIds: WeakMap<Request, string>,
  requestTimeoutMs = timeoutMs,
): RequestHandler {
  return async (req, res, next) => {
    const requestId = requestIds.get(req);
    if (!requestId) {
      next(new Error("Request ID middleware was not initialized"));
      return;
    }

    const headers = new Headers();
    for (const name of [
      "accept",
      "content-type",
      "authorization",
      "cookie",
      "x-file-name",
    ]) {
      const value = req.header(name);
      if (value) {
        headers.set(name, value);
      }
    }
    headers.set("x-request-id", requestId);

    const requestBody =
      req.method === "GET" || req.method === "HEAD"
        ? undefined
        : Buffer.isBuffer(req.body)
          ? Uint8Array.from(req.body)
          : undefined;

    try {
      const upstreamResponse = await fetch(new URL(req.originalUrl, baseUrl), {
        method: req.method,
        headers,
        body: requestBody,
        signal: AbortSignal.timeout(requestTimeoutMs),
      });

      res.status(upstreamResponse.status);
      const contentType = upstreamResponse.headers.get("content-type");
      if (contentType) {
        res.setHeader("content-type", contentType);
      }
      for (const cookie of upstreamResponse.headers.getSetCookie()) {
        res.append("set-cookie", cookie);
      }
      res.setHeader("x-request-id", requestId);
      if (contentType?.startsWith("text/event-stream")) {
        res.setHeader("cache-control", "no-cache, no-transform");
        res.setHeader("x-accel-buffering", "no");
        res.flushHeaders();
        if (!upstreamResponse.body) {
          res.end();
          return;
        }

        const reader = upstreamResponse.body.getReader();
        const cancelOnClose = () => {
          if (!res.writableEnded) {
            void reader.cancel().catch((error: unknown) => {
              console.error(
                "Could not cancel downstream stream",
                error instanceof Error ? error.name : "UnknownError",
              );
            });
          }
        };
        res.once("close", cancelOnClose);
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (!res.write(Buffer.from(value))) {
              await new Promise<void>((resolve) => {
                res.once("drain", resolve);
                res.once("close", resolve);
              });
            }
          }
          if (!res.writableEnded && !res.destroyed) res.end();
        } finally {
          res.off("close", cancelOnClose);
        }
        return;
      }
      res.send(Buffer.from(await upstreamResponse.arrayBuffer()));
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "upstream_request_failed",
          requestId,
          error: error instanceof Error ? error.name : "UnknownError",
        }),
      );
      if (res.headersSent) {
        if (!res.destroyed && !res.writableEnded) res.end();
        return;
      }
      if (error instanceof Error && error.name === "TimeoutError") {
        errorResponse(
          res,
          504,
          "UPSTREAM_TIMEOUT",
          "A downstream service timed out",
        );
        return;
      }
      if (error instanceof Error && error.name === "AbortError") {
        errorResponse(
          res,
          504,
          "UPSTREAM_TIMEOUT",
          "A downstream service timed out",
        );
        return;
      }
      errorResponse(
        res,
        503,
        "UPSTREAM_UNAVAILABLE",
        "A downstream service is unavailable",
      );
    }
  };
}

async function checkUpstream(url: string, timeoutMs: number): Promise<boolean> {
  try {
    const response = await fetch(new URL("/ready", url), {
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function createGatewayApp(
  config: GatewayConfig,
  rateLimitStore: RateLimitStore,
  openApiDocument: string,
): express.Express {
  const app = express();
  const requestIds = new WeakMap<Request, string>();
  const requestStartTimes = new WeakMap<Request, number>();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use((req, res, next) => {
    const requestId = randomUUID();
    requestIds.set(req, requestId);
    requestStartTimes.set(req, performance.now());
    res.setHeader("x-request-id", requestId);
    res.once("finish", () => {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          requestId,
          method: req.method,
          path: `${req.baseUrl}${req.path}`,
          status: res.statusCode,
          durationMs: Math.round(
            performance.now() - (requestStartTimes.get(req) ?? 0),
          ),
        }),
      );
    });
    next();
  });

  app.get("/health", (_req, res) => {
    res
      .status(200)
      .json({ success: true, service: "api-gateway", status: "healthy" });
  });

  app.get("/ready", async (_req, res) => {
    const [
      authIsReady,
      workoutIsReady,
      nutritionIsReady,
      progressIsReady,
      profileIsReady,
      personalizationIsReady,
    ] = await Promise.all([
      checkUpstream(config.AUTH_SERVICE_URL, config.UPSTREAM_TIMEOUT_MS),
      checkUpstream(config.WORKOUT_SERVICE_URL, config.UPSTREAM_TIMEOUT_MS),
      checkUpstream(config.NUTRITION_SERVICE_URL, config.UPSTREAM_TIMEOUT_MS),
      checkUpstream(config.PROGRESS_SERVICE_URL, config.UPSTREAM_TIMEOUT_MS),
      checkUpstream(config.PROFILE_SERVICE_URL, config.UPSTREAM_TIMEOUT_MS),
      checkUpstream(
        config.PERSONALIZATION_SERVICE_URL,
        config.UPSTREAM_TIMEOUT_MS,
      ),
    ]);
    const redisIsReady = rateLimitStore.isReady;
    const ready =
      authIsReady &&
      workoutIsReady &&
      nutritionIsReady &&
      progressIsReady &&
      profileIsReady &&
      personalizationIsReady &&
      redisIsReady;
    res.status(ready ? 200 : 503).json({
      success: ready,
      service: "api-gateway",
      status: ready ? "ready" : "not_ready",
      dependencies: {
        redis: redisIsReady ? "ready" : "unavailable",
        auth: authIsReady ? "ready" : "unavailable",
        workout: workoutIsReady ? "ready" : "unavailable",
        nutrition: nutritionIsReady ? "ready" : "unavailable",
        progress: progressIsReady ? "ready" : "unavailable",
        profile: profileIsReady ? "ready" : "unavailable",
        personalization: personalizationIsReady ? "ready" : "unavailable",
      },
    });
  });

  app.get("/openapi.yaml", (_req, res) => {
    res.type("text/yaml").send(openApiDocument);
  });
  app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      swaggerOptions: { url: "/openapi.yaml" },
    }),
  );

  const rateLimit = createRateLimiter(config, rateLimitStore);
  app.use(
    "/api/v1/wellness/reports",
    authenticate(config),
    express.raw({
      type: ["application/pdf", "image/jpeg", "image/png"],
      limit: "8mb",
    }),
  );
  app.use(express.raw({ type: "*/*", limit: "1mb" }));
  app.use((req, res, next) => {
    if (
      req.is("application/json") &&
      Buffer.isBuffer(req.body) &&
      req.body.length > 0
    ) {
      try {
        JSON.parse(req.body.toString("utf8"));
      } catch {
        errorResponse(
          res,
          400,
          "INVALID_JSON",
          "Request body must contain valid JSON",
        );
        return;
      }
    }
    next();
  });
  app.use(
    "/api/v1/auth",
    rateLimit,
    proxy(config.AUTH_SERVICE_URL, config.UPSTREAM_TIMEOUT_MS, requestIds),
  );
  app.use(
    "/api/v1/exercises",
    rateLimit,
    proxy(config.WORKOUT_SERVICE_URL, config.UPSTREAM_TIMEOUT_MS, requestIds),
  );
  app.post(
    "/api/v1/foods/estimate",
    rateLimit,
    authenticate(config),
    proxy(
      config.NUTRITION_SERVICE_URL,
      config.UPSTREAM_TIMEOUT_MS,
      requestIds,
      FOOD_ESTIMATE_TIMEOUT_MS,
    ),
  );
  app.post(
    "/api/v1/coach/chat",
    rateLimit,
    authenticate(config),
    proxy(
      config.NUTRITION_SERVICE_URL,
      config.UPSTREAM_TIMEOUT_MS,
      requestIds,
      AI_COACH_TIMEOUT_MS,
    ),
  );
  app.post(
    "/api/v1/coach/stream",
    rateLimit,
    authenticate(config),
    proxy(
      config.NUTRITION_SERVICE_URL,
      config.UPSTREAM_TIMEOUT_MS,
      requestIds,
      AI_COACH_TIMEOUT_MS,
    ),
  );
  app.use(
    ["/api/v1/foods", "/api/v1/nutrition"],
    rateLimit,
    authenticate(config),
    proxy(config.NUTRITION_SERVICE_URL, config.UPSTREAM_TIMEOUT_MS, requestIds),
  );
  app.use(
    "/api/v1/progress",
    rateLimit,
    authenticate(config),
    proxy(config.PROGRESS_SERVICE_URL, config.UPSTREAM_TIMEOUT_MS, requestIds),
  );
  app.use(
    "/api/v1/activity",
    rateLimit,
    authenticate(config),
    proxy(config.PROGRESS_SERVICE_URL, config.UPSTREAM_TIMEOUT_MS, requestIds),
  );
  app.use(
    "/api/v1/profile",
    rateLimit,
    authenticate(config),
    proxy(config.PROFILE_SERVICE_URL, config.UPSTREAM_TIMEOUT_MS, requestIds),
  );
  app.use(
    "/api/v1/wellness",
    rateLimit,
    authenticate(config),
    proxy(
      config.PERSONALIZATION_SERVICE_URL,
      config.UPSTREAM_TIMEOUT_MS,
      requestIds,
      WELLNESS_AI_TIMEOUT_MS,
    ),
  );
  app.use(
    ["/api/v1/workout-plans", "/api/v1/workouts", "/api/v1/workout-sessions"],
    rateLimit,
    authenticate(config),
    proxy(config.WORKOUT_SERVICE_URL, config.UPSTREAM_TIMEOUT_MS, requestIds),
  );

  app.use((_req, res) => {
    errorResponse(res, 404, "ROUTE_NOT_FOUND", "Route not found");
  });

  const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    if (typeof error === "object" && error !== null && "type" in error) {
      if (error.type === "entity.too.large") {
        errorResponse(
          res,
          413,
          "REQUEST_TOO_LARGE",
          "Request body exceeds the size limit",
        );
        return;
      }
      if (error.type === "entity.parse.failed") {
        errorResponse(
          res,
          400,
          "INVALID_JSON",
          "Request body must contain valid JSON",
        );
        return;
      }
    }
    console.error(
      "API Gateway request failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    errorResponse(
      res,
      500,
      "INTERNAL_SERVER_ERROR",
      "An unexpected error occurred",
    );
  };
  app.use(errorHandler);

  return app;
}
