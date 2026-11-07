import express, { ErrorRequestHandler, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import { z } from "zod";
import { ProfileConfig } from "./config.js";

const profilePatchSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80).nullable().optional(),
    units: z.enum(["metric", "imperial"]).optional(),
    trainingGoal: z
      .enum([
        "muscle_gain",
        "fat_loss",
        "powerlifting",
        "athletic_performance",
        "general_fitness",
      ])
      .nullable()
      .optional(),
    experienceLevel: z
      .enum(["beginner", "intermediate", "advanced"])
      .nullable()
      .optional(),
    equipment: z
      .array(z.enum(["bodyweight", "dumbbell", "barbell", "machine", "band"]))
      .max(5)
      .refine((values) => new Set(values).size === values.length)
      .optional(),
    dietaryPreferences: z
      .array(
        z.enum([
          "vegetarian",
          "vegan",
          "pescatarian",
          "halal",
          "kosher",
          "gluten_free",
          "dairy_free",
        ]),
      )
      .max(7)
      .refine((values) => new Set(values).size === values.length)
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one profile field is required",
  });

function verifyToken(jwtSecret: string): RequestHandler {
  return (req, res, next) => {
    const token = req.header("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
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

export function createProfileApp(
  pool: Pool,
  config: ProfileConfig,
): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));
  app.get("/health", (_req, res) => {
    res
      .status(200)
      .json({ success: true, service: "profile-service", status: "healthy" });
  });
  app.get(
    "/ready",
    asyncRoute(async (_req, res) => {
      await pool.query("SELECT 1");
      res
        .status(200)
        .json({ success: true, service: "profile-service", status: "ready" });
    }),
  );

  app.use("/api/v1/profile", verifyToken(config.JWT_SECRET));
  app.get(
    "/api/v1/profile",
    asyncRoute(async (_req, res) => {
      const result = await pool.query(
        `INSERT INTO user_profiles (owner_id)
         VALUES ($1)
         ON CONFLICT (owner_id) DO UPDATE SET updated_at = user_profiles.updated_at
         RETURNING display_name, units, training_goal, experience_level,
                   equipment, dietary_preferences, created_at, updated_at`,
        [res.locals.ownerId],
      );
      res.status(200).json({ success: true, data: result.rows[0] });
    }),
  );
  app.patch(
    "/api/v1/profile",
    asyncRoute(async (req, res) => {
      const parsed = profilePatchSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_PROFILE",
            message: z.prettifyError(parsed.error),
          },
        });
        return;
      }
      const patch = parsed.data;
      const result = await pool.query(
        `INSERT INTO user_profiles
           (owner_id, display_name, units, training_goal, experience_level,
            equipment, dietary_preferences)
         VALUES ($1, $2, COALESCE($3, 'metric'), $4, $5,
                 COALESCE($6, ARRAY[]::TEXT[]), COALESCE($7, ARRAY[]::TEXT[]))
         ON CONFLICT (owner_id) DO UPDATE SET
           display_name = CASE WHEN $8 THEN $2 ELSE user_profiles.display_name END,
           units = CASE WHEN $9 THEN $3 ELSE user_profiles.units END,
           training_goal = CASE WHEN $10 THEN $4 ELSE user_profiles.training_goal END,
           experience_level = CASE WHEN $11 THEN $5 ELSE user_profiles.experience_level END,
           equipment = CASE WHEN $12 THEN $6 ELSE user_profiles.equipment END,
           dietary_preferences = CASE WHEN $13 THEN $7 ELSE user_profiles.dietary_preferences END,
           updated_at = now()
         RETURNING display_name, units, training_goal, experience_level,
                   equipment, dietary_preferences, created_at, updated_at`,
        [
          res.locals.ownerId,
          patch.displayName ?? null,
          patch.units ?? null,
          patch.trainingGoal ?? null,
          patch.experienceLevel ?? null,
          patch.equipment ?? null,
          patch.dietaryPreferences ?? null,
          patch.displayName !== undefined,
          patch.units !== undefined,
          patch.trainingGoal !== undefined,
          patch.experienceLevel !== undefined,
          patch.equipment !== undefined,
          patch.dietaryPreferences !== undefined,
        ],
      );
      res.status(200).json({ success: true, data: result.rows[0] });
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
      "Profile Service request failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    res.status(503).json({
      success: false,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Profile service is unavailable",
      },
    });
  };
  app.use(errorHandler);
  return app;
}
