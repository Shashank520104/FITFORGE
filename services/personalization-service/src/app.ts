import express, { ErrorRequestHandler, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import { PersonalizationConfig } from "./config.js";
import { PersonalizationController } from "./controllers/personalizationController.js";
import { HttpError } from "./errors/httpError.js";
import { extractReportText } from "./extractReportText.js";
import { PersonalizationRepository } from "./repositories/personalizationRepository.js";
import { createPersonalizationRouter } from "./routes/personalizationRoutes.js";
import { AiService } from "./services/aiService.js";
import { PersonalizationService } from "./services/personalizationService.js";

type Dependencies = {
  fetcher?: typeof fetch;
  extractText?: typeof extractReportText;
};

function asyncRoute(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function verifyToken(jwtSecret: string): RequestHandler {
  return (req, res, next) => {
    const token = req.header("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) {
      res.status(401).json({
        success: false,
        error: { code: "AUTHENTICATION_REQUIRED", message: "A bearer access token is required" },
      });
      return;
    }

    try {
      const payload = jwt.verify(token, jwtSecret, { algorithms: ["HS256"] });
      if (typeof payload === "string" || typeof payload.sub !== "string") {
        throw new Error("Invalid token subject");
      }
      res.locals.ownerId = payload.sub;
      next();
    } catch {
      res.status(401).json({
        success: false,
        error: { code: "INVALID_ACCESS_TOKEN", message: "Access token is invalid or expired" },
      });
    }
  };
}

export function createPersonalizationApp(
  pool: Pool,
  config: PersonalizationConfig,
  dependencies: Dependencies = {},
): express.Express {
  const app = express();
  app.disable("x-powered-by");

  // Middleware
  app.use("/api/v1/wellness", verifyToken(config.JWT_SECRET));
  app.use(
    "/api/v1/wellness/reports",
    express.raw({
      type: ["application/pdf", "image/jpeg", "image/png"],
      limit: 8 * 1024 * 1024,
    }),
  );
  app.use(express.json({ limit: "32kb" }));

  // Probes
  app.get("/health", (_req, res) => {
    res.status(200).json({ success: true, service: "personalization-service", status: "healthy" });
  });

  app.get(
    "/ready",
    asyncRoute(async (_req, res) => {
      await pool.query("SELECT 1");
      res.status(200).json({ success: true, service: "personalization-service", status: "ready" });
    }),
  );

  // Dependency Injection: Repository -> AI Service -> Domain Service -> Controller
  const repository = new PersonalizationRepository(pool);
  const aiService = new AiService(config, dependencies.fetcher ?? fetch);
  const service = new PersonalizationService(
    repository,
    aiService,
    config,
    dependencies.extractText ?? extractReportText,
  );
  const controller = new PersonalizationController(service);

  // Mount domain router
  app.use("/api/v1/wellness", createPersonalizationRouter(controller));

  // 404
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

    console.error(
      "Personalization Service unexpected error",
      error instanceof Error ? error.stack : error,
    );
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    });
  };

  app.use(errorHandler);
  return app;
}
