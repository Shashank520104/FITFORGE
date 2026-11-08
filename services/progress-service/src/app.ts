import express, { ErrorRequestHandler, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import { ProgressConfig } from "./config.js";
import { ProgressController } from "./controllers/progressController.js";
import { HttpError } from "./errors/httpError.js";
import { ProgressRepository } from "./repositories/progressRepository.js";
import {
  createActivityRouter,
  createProgressRouter,
} from "./routes/progressRoutes.js";

function verifyToken(jwtSecret: string): RequestHandler {
  return (req, res, next) => {
    const token = req.header("authorization")?.match(/^Bearer ([^\s]+)$/)?.[1];
    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          code: "AUTHENTICATION_REQUIRED",
          message: "A bearer access token is required",
        },
      });
      return;
    }
    try {
      const payload = jwt.verify(token, jwtSecret, { algorithms: ["HS256"] });
      if (typeof payload === "string" || typeof payload.sub !== "string") {
        throw new Error("Invalid subject");
      }
      res.locals.ownerId = payload.sub;
      next();
    } catch {
      res.status(401).json({
        success: false,
        error: {
          code: "INVALID_ACCESS_TOKEN",
          message: "Access token is invalid or expired",
        },
      });
    }
  };
}

function asyncRoute(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function createProgressApp(
  pool: Pool,
  config: ProgressConfig,
): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));

  // Probes
  app.get("/health", (_req, res) => {
    res
      .status(200)
      .json({ success: true, service: "progress-service", status: "healthy" });
  });

  app.get(
    "/ready",
    asyncRoute(async (_req, res) => {
      await pool.query("SELECT 1");
      res
        .status(200)
        .json({ success: true, service: "progress-service", status: "ready" });
    }),
  );

  // Layer assembly: Repository -> Controller -> Routers
  const repository = new ProgressRepository(pool);
  const controller = new ProgressController(repository);

  app.use(
    "/api/v1/progress",
    verifyToken(config.JWT_SECRET),
    createProgressRouter(controller),
  );
  app.use(
    "/api/v1/activity",
    verifyToken(config.JWT_SECRET),
    createActivityRouter(controller),
  );

  // 404
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: "ROUTE_NOT_FOUND", message: "Route not found" },
    });
  });

  // Centralized Error Handling
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
    if (
      typeof error === "object" &&
      error !== null &&
      "type" in error &&
      error.type === "entity.too.large"
    ) {
      res.status(413).json({
        success: false,
        error: {
          code: "REQUEST_TOO_LARGE",
          message: "Request body exceeds the size limit",
        },
      });
      return;
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "type" in error &&
      error.type === "entity.parse.failed"
    ) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_JSON",
          message: "Request body must contain valid JSON",
        },
      });
      return;
    }
    console.error(
      "Progress Service request failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    res.status(503).json({
      success: false,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Progress service is unavailable",
      },
    });
  };

  app.use(errorHandler);
  return app;
}
