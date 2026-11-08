import express, { ErrorRequestHandler, RequestHandler } from "express";
import { Pool } from "pg";
import { AuthConfig } from "./config.js";
import { AuthController } from "./controllers/authController.js";
import { HttpError } from "./errors/httpError.js";
import { AuthRepository } from "./repositories/authRepository.js";
import { createAuthRouter } from "./routes/authRoutes.js";
import { AuthService } from "./services/authService.js";

function asyncRoute(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function createAuthApp(pool: Pool, config: AuthConfig): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));

  // Dependency Injection: Repository -> Service -> Controller
  const repository = new AuthRepository(pool);
  const authService = new AuthService(repository, config);
  const authController = new AuthController(authService, config);

  // Health and readiness probes
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

  // Domain routes
  app.use("/api/v1/auth", createAuthRouter(authController));

  // 404 Handler
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: "ROUTE_NOT_FOUND", message: "Route not found" },
    });
  });

  // Centralized Error Handling Middleware
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
