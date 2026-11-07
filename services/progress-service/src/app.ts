import express, { ErrorRequestHandler, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import { z } from "zod";
import { ProgressConfig } from "./config.js";

const measurementSchema = z
  .object({
    measuredOn: z.iso.date(),
    weightKg: z.number().min(20).max(500),
    bodyFatPercent: z.number().min(1).max(75).optional(),
    note: z.string().max(500).optional(),
  })
  .strict();

const strengthSchema = z
  .object({
    exerciseName: z.string().trim().min(1).max(120),
    exerciseId: z.string().max(64).optional(),
    performedAt: z.iso.date(),
    weightKg: z.number().min(0).max(2000),
    repetitions: z.number().int().min(1).max(100),
    note: z.string().max(500).optional(),
  })
  .strict();

const activitySchema = z
  .object({
    activityDate: z.iso.date(),
    activityTime: z
      .string()
      .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
      .default("12:00"),
    activityType: z.enum([
      "walking",
      "running",
      "cycling",
      "strength",
      "yoga",
      "other",
    ]),
    durationMinutes: z.number().int().min(1).max(1440),
    distanceKm: z.number().min(0).max(1000).optional(),
    note: z.string().max(500).optional(),
  })
  .strict();

const sleepSchema = z
  .object({
    sleepDate: z.iso.date(),
    bedtime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    wakeTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    note: z.string().max(500).optional(),
  })
  .strict()
  .refine(
    ({ bedtime, wakeTime }) =>
      bedtime !== wakeTime &&
      (timeInMinutes(wakeTime) - timeInMinutes(bedtime) + 1440) % 1440 > 0,
    { message: "Bedtime and wake-up time must be different" },
  );

function timeInMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function positiveInteger(
  value: unknown,
  fallback: number,
  max: number,
): number | null {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= max ? parsed : null;
}

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
      if (typeof payload === "string" || typeof payload.sub !== "string")
        throw new Error("Invalid subject");
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

function ownerId(res: express.Response): string {
  const value: unknown = res.locals.ownerId;
  if (typeof value !== "string")
    throw new HttpError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
    );
  return value;
}

function asyncRoute(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function validationError(
  res: express.Response,
  code: string,
  message: string,
): void {
  res.status(400).json({ success: false, error: { code, message } });
}

export function createProgressApp(
  pool: Pool,
  config: ProgressConfig,
): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));
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
  app.use("/api/v1/progress", verifyToken(config.JWT_SECRET));
  app.use("/api/v1/activity", verifyToken(config.JWT_SECRET));

  app.post(
    "/api/v1/activity/activities",
    asyncRoute(async (req, res) => {
      const parsed = activitySchema.safeParse(req.body);
      if (!parsed.success) {
        validationError(res, "INVALID_ACTIVITY", z.prettifyError(parsed.error));
        return;
      }
      const result = await pool.query(
        `INSERT INTO activity_logs
          (owner_id, activity_date, activity_time, activity_type, duration_minutes, distance_km, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id, activity_date, activity_time, activity_type, duration_minutes, distance_km, note, source, created_at`,
        [
          ownerId(res),
          parsed.data.activityDate,
          parsed.data.activityTime,
          parsed.data.activityType,
          parsed.data.durationMinutes,
          parsed.data.distanceKm ?? null,
          parsed.data.note ?? null,
        ],
      );
      res.status(201).json({ success: true, data: result.rows[0] });
    }),
  );

  app.post(
    "/api/v1/activity/sleep",
    asyncRoute(async (req, res) => {
      const parsed = sleepSchema.safeParse(req.body);
      if (!parsed.success) {
        validationError(res, "INVALID_SLEEP", z.prettifyError(parsed.error));
        return;
      }
      const { sleepDate, bedtime, wakeTime, note } = parsed.data;
      const durationMinutes =
        (timeInMinutes(wakeTime) - timeInMinutes(bedtime) + 1440) % 1440;
      const result = await pool.query(
        `INSERT INTO sleep_logs
          (owner_id, sleep_date, bedtime, wake_time, duration_minutes, note)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id, sleep_date, bedtime, wake_time, duration_minutes, note, source, created_at`,
        [
          ownerId(res),
          sleepDate,
          bedtime,
          wakeTime,
          durationMinutes,
          note ?? null,
        ],
      );
      res.status(201).json({ success: true, data: result.rows[0] });
    }),
  );

  app.get(
    "/api/v1/activity",
    asyncRoute(async (req, res) => {
      const date = z.iso.date().safeParse(req.query.date);
      if (!date.success) {
        validationError(
          res,
          "INVALID_DATE",
          "A valid YYYY-MM-DD date is required",
        );
        return;
      }
      const userId = ownerId(res);
      const [activities, sleep] = await Promise.all([
        pool.query(
          `SELECT id, activity_date, activity_time, activity_type, duration_minutes, distance_km, note, source, created_at
           FROM activity_logs WHERE owner_id = $1 AND activity_date = $2
           ORDER BY activity_time, created_at`,
          [userId, date.data],
        ),
        pool.query(
          `SELECT id, sleep_date, bedtime, wake_time, duration_minutes, note, source, created_at
           FROM sleep_logs WHERE owner_id = $1 AND sleep_date = $2
           ORDER BY created_at`,
          [userId, date.data],
        ),
      ]);
      res.status(200).json({
        success: true,
        data: {
          activities: activities.rows,
          sleep: sleep.rows,
          activityMinutes: activities.rows.reduce(
            (total, activity) => total + Number(activity.duration_minutes),
            0,
          ),
          sleepMinutes: sleep.rows.reduce(
            (total, record) => total + Number(record.duration_minutes),
            0,
          ),
        },
      });
    }),
  );

  app.get(
    "/api/v1/activity/summary",
    asyncRoute(async (req, res) => {
      const from = z.iso.date().safeParse(req.query.from);
      const to = z.iso.date().safeParse(req.query.to);
      if (!from.success || !to.success || from.data > to.data) {
        validationError(
          res,
          "INVALID_DATE_RANGE",
          "Valid from and to dates are required, and from must not be after to",
        );
        return;
      }
      const rangeDays =
        (Date.parse(`${to.data}T00:00:00Z`) -
          Date.parse(`${from.data}T00:00:00Z`)) /
          86400000 +
        1;
      if (rangeDays > 31) {
        validationError(
          res,
          "INVALID_DATE_RANGE",
          "Activity summaries are limited to 31 days",
        );
        return;
      }
      const result = await pool.query(
        `WITH days AS (
           SELECT generate_series($2::date, $3::date, interval '1 day')::date AS summary_date
         ),
         activities AS (
           SELECT activity_date, SUM(duration_minutes) AS activity_minutes,
                  SUM(COALESCE(distance_km, 0)) AS distance_km,
                  COUNT(*) AS activity_count
           FROM activity_logs
           WHERE owner_id = $1 AND activity_date BETWEEN $2 AND $3
           GROUP BY activity_date
         ),
         sleep AS (
           SELECT sleep_date, SUM(duration_minutes) AS sleep_minutes,
                  COUNT(*) AS sleep_count
           FROM sleep_logs
           WHERE owner_id = $1 AND sleep_date BETWEEN $2 AND $3
           GROUP BY sleep_date
         )
         SELECT days.summary_date,
                COALESCE(activities.activity_minutes, 0) AS activity_minutes,
                COALESCE(activities.distance_km, 0) AS distance_km,
                COALESCE(activities.activity_count, 0) AS activity_count,
                COALESCE(sleep.sleep_minutes, 0) AS sleep_minutes,
                COALESCE(sleep.sleep_count, 0) AS sleep_count
         FROM days
         LEFT JOIN activities ON activities.activity_date = days.summary_date
         LEFT JOIN sleep ON sleep.sleep_date = days.summary_date
         ORDER BY days.summary_date`,
        [ownerId(res), from.data, to.data],
      );
      res.status(200).json({ success: true, data: result.rows });
    }),
  );

  app.delete(
    "/api/v1/activity/activities/:id",
    asyncRoute(async (req, res) => {
      const result = await pool.query(
        "DELETE FROM activity_logs WHERE id = $1 AND owner_id = $2 RETURNING id",
        [req.params.id, ownerId(res)],
      );
      if (!result.rowCount) {
        res.status(404).json({
          success: false,
          error: { code: "ACTIVITY_NOT_FOUND", message: "Activity not found" },
        });
        return;
      }
      res.status(204).end();
    }),
  );

  app.delete(
    "/api/v1/activity/sleep/:id",
    asyncRoute(async (req, res) => {
      const result = await pool.query(
        "DELETE FROM sleep_logs WHERE id = $1 AND owner_id = $2 RETURNING id",
        [req.params.id, ownerId(res)],
      );
      if (!result.rowCount) {
        res.status(404).json({
          success: false,
          error: { code: "SLEEP_NOT_FOUND", message: "Sleep record not found" },
        });
        return;
      }
      res.status(204).end();
    }),
  );

  app.post(
    "/api/v1/progress/measurements",
    asyncRoute(async (req, res) => {
      const parsed = measurementSchema.safeParse(req.body);
      if (!parsed.success) {
        validationError(
          res,
          "INVALID_MEASUREMENT",
          z.prettifyError(parsed.error),
        );
        return;
      }
      const result = await pool.query(
        `INSERT INTO body_measurements (owner_id, measured_on, weight_kg, body_fat_percent, note)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (owner_id, measured_on) DO UPDATE
         SET weight_kg = EXCLUDED.weight_kg,
             body_fat_percent = EXCLUDED.body_fat_percent,
             note = EXCLUDED.note
       RETURNING id, measured_on, weight_kg, body_fat_percent, note`,
        [
          ownerId(res),
          parsed.data.measuredOn,
          parsed.data.weightKg,
          parsed.data.bodyFatPercent ?? null,
          parsed.data.note ?? null,
        ],
      );
      res.status(201).json({ success: true, data: result.rows[0] });
    }),
  );

  app.get(
    "/api/v1/progress/measurements",
    asyncRoute(async (req, res) => {
      const page = positiveInteger(req.query.page, 1, 1000000);
      const limit = positiveInteger(req.query.limit, 100, 366);
      const from =
        req.query.from === undefined
          ? undefined
          : z.iso.date().safeParse(req.query.from);
      const to =
        req.query.to === undefined
          ? undefined
          : z.iso.date().safeParse(req.query.to);
      if (
        page === null ||
        limit === null ||
        (from && !from.success) ||
        (to && !to.success)
      ) {
        validationError(
          res,
          "INVALID_QUERY",
          "Measurement date range or pagination is invalid",
        );
        return;
      }
      const result = await pool.query(
        `SELECT id, measured_on, weight_kg, body_fat_percent, note
       FROM body_measurements
       WHERE owner_id = $1
         AND ($2::date IS NULL OR measured_on >= $2)
         AND ($3::date IS NULL OR measured_on <= $3)
       ORDER BY measured_on
       LIMIT $4 OFFSET $5`,
        [
          ownerId(res),
          from?.success ? from.data : null,
          to?.success ? to.data : null,
          limit,
          (page - 1) * limit,
        ],
      );
      res.status(200).json({
        success: true,
        data: result.rows,
        pagination: { page, limit },
      });
    }),
  );

  app.post(
    "/api/v1/progress/strength-records",
    asyncRoute(async (req, res) => {
      const parsed = strengthSchema.safeParse(req.body);
      if (!parsed.success) {
        validationError(
          res,
          "INVALID_STRENGTH_RECORD",
          z.prettifyError(parsed.error),
        );
        return;
      }
      const record = parsed.data;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `SELECT pg_advisory_xact_lock(
             hashtextextended($1 || ':' || lower($2), 0)
           )`,
          [ownerId(res), record.exerciseName],
        );
        const previous = await client.query<{ max_weight: string | null }>(
          `SELECT MAX(weight_kg) AS max_weight FROM strength_records
         WHERE owner_id = $1 AND lower(exercise_name) = lower($2)`,
          [ownerId(res), record.exerciseName],
        );
        const previousBest = Number(previous.rows[0]?.max_weight ?? 0);
        const isPersonalRecord = record.weightKg > previousBest;
        const created = await client.query(
          `INSERT INTO strength_records
          (owner_id, exercise_name, exercise_id, performed_at, weight_kg, repetitions, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id, exercise_name, exercise_id, performed_at, weight_kg, repetitions, note`,
          [
            ownerId(res),
            record.exerciseName,
            record.exerciseId ?? null,
            record.performedAt,
            record.weightKg,
            record.repetitions,
            record.note ?? null,
          ],
        );
        await client.query("COMMIT");
        res
          .status(201)
          .json({ success: true, data: created.rows[0], isPersonalRecord });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }),
  );

  app.get(
    "/api/v1/progress/strength-records",
    asyncRoute(async (req, res) => {
      const name =
        typeof req.query.exercise === "string" ? req.query.exercise.trim() : "";
      if (req.query.exercise !== undefined && (!name || name.length > 120)) {
        validationError(
          res,
          "INVALID_QUERY",
          "Exercise filter must contain 1 to 120 characters",
        );
        return;
      }
      const page = positiveInteger(req.query.page, 1, 1000000);
      const limit = positiveInteger(req.query.limit, 100, 366);
      if (page === null || limit === null) {
        validationError(
          res,
          "INVALID_QUERY",
          "Pagination parameters are invalid",
        );
        return;
      }
      const result = await pool.query(
        `SELECT id, exercise_name, exercise_id, performed_at, weight_kg, repetitions, note
       FROM strength_records
       WHERE owner_id = $1 AND ($2 = '' OR lower(exercise_name) = lower($2))
       ORDER BY performed_at DESC, created_at DESC
       LIMIT $3 OFFSET $4`,
        [ownerId(res), name, limit, (page - 1) * limit],
      );
      res.status(200).json({
        success: true,
        data: result.rows,
        pagination: { page, limit },
      });
    }),
  );

  app.get(
    "/api/v1/progress/summary",
    asyncRoute(async (req, res) => {
      const userId = ownerId(res);
      const [measurements, personalRecords] = await Promise.all([
        pool.query(
          `SELECT measured_on, weight_kg, body_fat_percent
         FROM body_measurements WHERE owner_id = $1
          ORDER BY measured_on DESC LIMIT 366`,
          [userId],
        ),
        pool.query(
          `SELECT DISTINCT ON (lower(exercise_name))
           exercise_name, performed_at, weight_kg, repetitions
         FROM strength_records WHERE owner_id = $1
         ORDER BY lower(exercise_name), weight_kg DESC, performed_at DESC`,
          [userId],
        ),
      ]);
      res.status(200).json({
        success: true,
        data: {
          measurements: measurements.rows.reverse(),
          personalRecords: personalRecords.rows,
        },
      });
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
