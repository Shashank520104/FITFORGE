import express, { ErrorRequestHandler, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import { NutritionConfig } from "./config.js";
import { CoachController } from "./controllers/coachController.js";
import { FoodController } from "./controllers/foodController.js";
import { MealController } from "./controllers/mealController.js";
import { HttpError } from "./errors/httpError.js";
import { FoodRepository } from "./repositories/foodRepository.js";
import { MealRepository } from "./repositories/mealRepository.js";
import {
  createCoachRouter,
  createFoodRouter,
  createMealRouter,
} from "./routes/nutritionRoutes.js";
import { AiNutritionService } from "./services/aiNutritionService.js";

function verifyToken(jwtSecret: string): RequestHandler {
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
      if (typeof payload === "string" || typeof payload.sub !== "string") {
        throw new Error("Invalid token subject");
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

export function createNutritionApp(
  pool: Pool,
  config: NutritionConfig,
): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));

  // Health and readiness endpoints
  app.get("/health", (_req, res) => {
    res.status(200).json({
      success: true,
      service: "nutrition-service",
      status: "healthy",
    });
  });

  app.get("/ready", async (_req, res, next) => {
    try {
      await pool.query("SELECT 1");
      res.status(200).json({
        success: true,
        service: "nutrition-service",
        status: "ready",
      });
    } catch (error) {
      next(error);
    }
  });

  // Repositories and Services
  const foodRepository = new FoodRepository(pool);
  const mealRepository = new MealRepository(pool);
  const aiNutritionService = new AiNutritionService(config);

  // Controllers
  const foodController = new FoodController(foodRepository, aiNutritionService);
  const mealController = new MealController(mealRepository);
  const coachController = new CoachController(aiNutritionService, config);

  // Protected API routes
  const authMiddleware = verifyToken(config.JWT_SECRET);
  app.use("/api/v1/foods", authMiddleware, createFoodRouter(foodController));
  app.use("/api/v1/coach", authMiddleware, createCoachRouter(coachController));
  app.use("/api/v1/nutrition/logs", authMiddleware, createMealRouter(mealController));

  // 404 Route Handler
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: "ROUTE_NOT_FOUND", message: "Route not found" },
    });
  });

  // Centralized Error Handler
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
      "Nutrition Service request failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    res.status(503).json({
      success: false,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Nutrition service is unavailable",
      },
    });
  };
  app.use(errorHandler);

  return app;
}
