import express, { ErrorRequestHandler } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { createExerciseRoutes } from "./routes/exercises.routes.js";
import workoutPlanRoutes from "./routes/workoutPlans.routes.js";
import { createWorkoutSessionRoutes } from "./routes/workoutSessions.routes.js";
import { CacheStore } from "./services/cache.js";
import { WorkoutInsightsQueue } from "./jobs/insightsQueue.js";

type WorkoutAppDependencies = {
  cache?: CacheStore;
  insightsQueue?: WorkoutInsightsQueue;
};

function authenticate(jwtSecret: string): express.RequestHandler {
  return (req, res, next) => {
    const match = req.header("authorization")?.match(/^Bearer ([^\s]+)$/);
    if (!match) {
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
      const payload = jwt.verify(match[1], jwtSecret, {
        algorithms: ["HS256"],
      });
      if (
        typeof payload === "string" ||
        typeof payload.sub !== "string" ||
        typeof payload.role !== "string"
      ) {
        throw new Error("Invalid access token claims");
      }
      res.locals.identity = { id: payload.sub };
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

export function createWorkoutApp(
  jwtSecret: string,
  dependencies: WorkoutAppDependencies = {},
): express.Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "128kb" }));

  app.get("/health", (_req, res) => {
    res.status(200).json({
      success: true,
      service: "FITFORGE Workout Service",
      status: "healthy",
    });
  });

  app.get("/ready", (_req, res) => {
    const ready = mongoose.connection.readyState === 1;
    res.status(ready ? 200 : 503).json({
      success: ready,
      service: "FITFORGE Workout Service",
      status: ready ? "ready" : "not_ready",
      dependencies: {
        mongodb: ready ? "connected" : "disconnected",
        redisCache: dependencies.cache?.isReady ? "connected" : "degraded",
      },
    });
  });

  app.use("/api/v1/exercises", createExerciseRoutes(dependencies.cache));
  app.use("/api/v1/workout-plans", authenticate(jwtSecret), workoutPlanRoutes);
  app.use(
    "/api/v1/workout-sessions",
    authenticate(jwtSecret),
    createWorkoutSessionRoutes(dependencies),
  );

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: "ROUTE_NOT_FOUND",
        message: "Route not found",
      },
    });
  });

  const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
    if (res.headersSent) {
      next(error);
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
      `Workout Service request failed: ${req.method} ${req.path}`,
      error instanceof Error ? error.name : "UnknownError",
    );

    const ready = mongoose.connection.readyState === 1;
    res.status(ready ? 500 : 503).json({
      success: false,
      error: {
        code: ready ? "INTERNAL_SERVER_ERROR" : "DEPENDENCY_UNAVAILABLE",
        message: ready
          ? "An unexpected error occurred"
          : "The database is unavailable",
      },
    });
  };

  app.use(errorHandler);

  return app;
}
