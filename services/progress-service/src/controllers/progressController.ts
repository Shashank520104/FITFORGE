import { Request, Response } from "express";
import { z } from "zod";
import { ProgressRepository } from "../repositories/progressRepository.js";

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

function timeInMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

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

export class ProgressController {
  constructor(private readonly repository: ProgressRepository) {}

  logActivity = async (req: Request, res: Response): Promise<void> => {
    const parsed = activitySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: "INVALID_ACTIVITY", message: z.prettifyError(parsed.error) } });
      return;
    }
    const data = await this.repository.logActivity(res.locals.ownerId, parsed.data);
    res.status(201).json({ success: true, data });
  };

  logSleep = async (req: Request, res: Response): Promise<void> => {
    const parsed = sleepSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: "INVALID_SLEEP", message: z.prettifyError(parsed.error) } });
      return;
    }
    const { sleepDate, bedtime, wakeTime, note } = parsed.data;
    const durationMinutes = (timeInMinutes(wakeTime) - timeInMinutes(bedtime) + 1440) % 1440;
    const data = await this.repository.logSleep(res.locals.ownerId, { sleepDate, bedtime, wakeTime, durationMinutes, note });
    res.status(201).json({ success: true, data });
  };

  getActivity = async (req: Request, res: Response): Promise<void> => {
    const date = z.iso.date().safeParse(req.query.date);
    if (!date.success) {
      res.status(400).json({ success: false, error: { code: "INVALID_DATE", message: "A valid YYYY-MM-DD date is required" } });
      return;
    }
    const data = await this.repository.getDailyActivitiesAndSleep(res.locals.ownerId, date.data);
    res.status(200).json({ success: true, data });
  };

  getActivitySummary = async (req: Request, res: Response): Promise<void> => {
    const from = z.iso.date().safeParse(req.query.from);
    const to = z.iso.date().safeParse(req.query.to);
    if (!from.success || !to.success || from.data > to.data) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_DATE_RANGE", message: "Valid from and to dates are required, and from must not be after to" },
      });
      return;
    }
    const rangeDays = (Date.parse(`${to.data}T00:00:00Z`) - Date.parse(`${from.data}T00:00:00Z`)) / 86400000 + 1;
    if (rangeDays > 31) {
      res.status(400).json({ success: false, error: { code: "INVALID_DATE_RANGE", message: "Activity summaries are limited to 31 days" } });
      return;
    }
    const data = await this.repository.getActivitySummary(res.locals.ownerId, from.data, to.data);
    res.status(200).json({ success: true, data });
  };

  deleteActivity = async (req: Request, res: Response): Promise<void> => {
    const deleted = await this.repository.deleteActivity(String(req.params.id), res.locals.ownerId);
    if (!deleted) {
      res.status(404).json({ success: false, error: { code: "ACTIVITY_NOT_FOUND", message: "Activity not found" } });
      return;
    }
    res.status(204).end();
  };

  deleteSleep = async (req: Request, res: Response): Promise<void> => {
    const deleted = await this.repository.deleteSleep(String(req.params.id), res.locals.ownerId);
    if (!deleted) {
      res.status(404).json({ success: false, error: { code: "SLEEP_NOT_FOUND", message: "Sleep record not found" } });
      return;
    }
    res.status(204).end();
  };

  saveMeasurement = async (req: Request, res: Response): Promise<void> => {
    const parsed = measurementSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: "INVALID_MEASUREMENT", message: z.prettifyError(parsed.error) } });
      return;
    }
    const data = await this.repository.saveMeasurement(res.locals.ownerId, parsed.data);
    res.status(201).json({ success: true, data });
  };

  getMeasurements = async (req: Request, res: Response): Promise<void> => {
    const page = positiveInteger(req.query.page, 1, 1000000);
    const limit = positiveInteger(req.query.limit, 100, 366);
    const from = req.query.from === undefined ? undefined : z.iso.date().safeParse(req.query.from);
    const to = req.query.to === undefined ? undefined : z.iso.date().safeParse(req.query.to);
    if (page === null || limit === null || (from && !from.success) || (to && !to.success)) {
      res.status(400).json({ success: false, error: { code: "INVALID_QUERY", message: "Measurement date range or pagination is invalid" } });
      return;
    }
    const data = await this.repository.getMeasurements(
      res.locals.ownerId,
      from?.success ? from.data : null,
      to?.success ? to.data : null,
      limit,
      (page - 1) * limit,
    );
    res.status(200).json({ success: true, data, pagination: { page, limit } });
  };

  saveStrengthRecord = async (req: Request, res: Response): Promise<void> => {
    const parsed = strengthSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: "INVALID_STRENGTH_RECORD", message: z.prettifyError(parsed.error) } });
      return;
    }
    const result = await this.repository.saveStrengthRecord(res.locals.ownerId, parsed.data);
    res.status(201).json({ success: true, data: result.data, isPersonalRecord: result.isPersonalRecord });
  };

  getStrengthRecords = async (req: Request, res: Response): Promise<void> => {
    const name = typeof req.query.exercise === "string" ? req.query.exercise.trim() : "";
    if (req.query.exercise !== undefined && (!name || name.length > 120)) {
      res.status(400).json({ success: false, error: { code: "INVALID_QUERY", message: "Exercise filter must contain 1 to 120 characters" } });
      return;
    }
    const page = positiveInteger(req.query.page, 1, 1000000);
    const limit = positiveInteger(req.query.limit, 100, 366);
    if (page === null || limit === null) {
      res.status(400).json({ success: false, error: { code: "INVALID_QUERY", message: "Pagination parameters are invalid" } });
      return;
    }
    const data = await this.repository.getStrengthRecords(res.locals.ownerId, name, limit, (page - 1) * limit);
    res.status(200).json({ success: true, data, pagination: { page, limit } });
  };

  getProgressSummary = async (_req: Request, res: Response): Promise<void> => {
    const data = await this.repository.getProgressSummary(res.locals.ownerId);
    res.status(200).json({ success: true, data });
  };
}
