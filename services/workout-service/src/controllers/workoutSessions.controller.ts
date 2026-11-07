import { Request, Response } from "express";
import { z } from "zod";
import WorkoutSession from "../models/workoutSession.model.js";
import {
  getWorkoutPlan,
  isValidPlanId,
} from "../services/workoutPlans.service.js";
import {
  CacheStore,
  invalidateVersionedCache,
  readCacheGeneration,
  readVersionedCache,
  writeCacheForGeneration,
} from "../services/cache.js";
import { WorkoutInsightsQueue } from "../jobs/insightsQueue.js";
import { buildInsightsForOwner } from "../services/workoutInsightsQuery.js";

const insightsCacheTtlSeconds = 15 * 60;

const startSchema = z
  .object({
    planId: z.string().regex(/^[0-9a-fA-F]{24}$/),
    day: z.number().int().min(1).max(7),
  })
  .strict();

const setSchema = z
  .object({
    exerciseIndex: z.number().int().min(0).max(83),
    setIndex: z.number().int().min(0).max(9),
    reps: z.number().int().min(1).max(100),
    weight: z.number().min(0).max(500),
  })
  .strict();

type Identity = { id: string };

function identityFrom(res: Response): Identity | undefined {
  const identity: unknown = res.locals.identity;
  if (
    typeof identity !== "object" ||
    identity === null ||
    !("id" in identity) ||
    typeof identity.id !== "string"
  ) {
    return undefined;
  }
  return { id: identity.id };
}

function requireIdentity(res: Response): Identity | undefined {
  const identity = identityFrom(res);
  if (!identity) {
    res.status(401).json({
      success: false,
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication is required",
      },
    });
  }
  return identity;
}

function invalidRequest(res: Response, message: string): void {
  res.status(400).json({
    success: false,
    error: { code: "INVALID_REQUEST", message },
  });
}

function validSessionId(value: unknown): value is string {
  return typeof value === "string" && isValidPlanId(value);
}

export async function startWorkoutSession(
  req: Request,
  res: Response,
): Promise<void> {
  const identity = requireIdentity(res);
  if (!identity) return;
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) {
    invalidRequest(res, z.prettifyError(parsed.error));
    return;
  }

  const plan = await getWorkoutPlan(identity.id, parsed.data.planId);
  if (!plan) {
    res.status(404).json({
      success: false,
      error: {
        code: "WORKOUT_PLAN_NOT_FOUND",
        message: "Workout plan not found",
      },
    });
    return;
  }
  const selectedDay = plan.days.find((day) => day.day === parsed.data.day);
  if (!selectedDay) {
    res.status(404).json({
      success: false,
      error: {
        code: "WORKOUT_DAY_NOT_FOUND",
        message: "Workout day not found in this plan",
      },
    });
    return;
  }

  try {
    const session = await WorkoutSession.create({
      ownerId: identity.id,
      planId: plan._id,
      planName: plan.name,
      dayNumber: selectedDay.day,
      dayName: selectedDay.name,
      status: "active",
      exercises: selectedDay.exercises.map((plannedExercise) => {
        const exercise = plannedExercise.exerciseId;
        return {
          exerciseId: exercise._id.toString(),
          exerciseName: exercise.name,
          sets: plannedExercise.sets.map((set) => ({
            plannedReps: set.reps,
            plannedWeight: set.weight ?? null,
            restSeconds: set.restSeconds,
          })),
        };
      }),
    });
    res.status(201).json({ success: true, data: session });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      res.status(409).json({
        success: false,
        error: {
          code: "ACTIVE_WORKOUT_EXISTS",
          message:
            "Finish or abandon your active workout before starting another",
        },
      });
      return;
    }
    throw error;
  }
}

export async function listWorkoutSessions(
  req: Request,
  res: Response,
): Promise<void> {
  const identity = requireIdentity(res);
  if (!identity) return;
  const page = parsePositiveInteger(req.query.page, 1, 1_000_000);
  const limit = parsePositiveInteger(req.query.limit, 20, 100);
  if (page === null || limit === null) {
    invalidRequest(
      res,
      "Page must be a positive integer and limit must be between 1 and 100",
    );
    return;
  }

  const filter = { ownerId: identity.id };
  const [data, total, active] = await Promise.all([
    WorkoutSession.find(filter)
      .sort({ startedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    WorkoutSession.countDocuments(filter),
    WorkoutSession.findOne({ ...filter, status: "active" }).lean(),
  ]);
  res.status(200).json({
    success: true,
    data,
    active,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function getWorkoutInsights(
  _req: Request,
  res: Response,
  cache?: CacheStore,
): Promise<void> {
  const identity = requireIdentity(res);
  if (!identity) return;

  const cacheKey = `fitforge:workout:insights:${identity.id}`;
  const cached = await readVersionedCache<{
    data: Awaited<ReturnType<typeof buildInsightsForOwner>>["data"];
    sessionsAnalyzed: number;
  }>(cache, cacheKey);
  if (cached) {
    res.status(200).json({ success: true, ...cached.value, cached: true });
    return;
  }

  const generation = await readCacheGeneration(cache, cacheKey);
  const insights = await buildInsightsForOwner(identity.id);
  if (generation !== null) {
    await writeCacheForGeneration(
      cache,
      cacheKey,
      generation,
      insights,
      insightsCacheTtlSeconds,
    );
  }
  res.status(200).json({
    success: true,
    ...insights,
    cached: false,
  });
}

export async function getWorkoutInsightsJob(
  req: Request,
  res: Response,
  queue?: WorkoutInsightsQueue,
): Promise<void> {
  const identity = requireIdentity(res);
  if (!identity) return;
  if (!queue) {
    res.status(503).json({
      success: false,
      error: {
        code: "BACKGROUND_JOBS_UNAVAILABLE",
        message: "Workout insight jobs are temporarily unavailable",
      },
    });
    return;
  }

  const { jobId } = req.params;
  if (typeof jobId !== "string" || jobId.length > 128) {
    invalidRequest(res, "Workout insight job ID is invalid");
    return;
  }
  const job = await queue.getJob(jobId);
  if (!job || job.ownerId !== identity.id) {
    res.status(404).json({
      success: false,
      error: {
        code: "WORKOUT_INSIGHTS_JOB_NOT_FOUND",
        message: "Workout insight job not found",
      },
    });
    return;
  }

  const state = await job.getState();
  res.status(200).json({
    success: true,
    data: {
      jobId: job.id,
      status: state,
      result: state === "completed" ? job.getResult() : undefined,
      error:
        state === "failed" ? "Workout insight processing failed" : undefined,
    },
  });
}

export async function logWorkoutSet(
  req: Request,
  res: Response,
): Promise<void> {
  const identity = requireIdentity(res);
  if (!identity) return;
  const id = req.params.id;
  if (!validSessionId(id)) {
    invalidRequest(res, "Workout session ID is invalid");
    return;
  }
  const parsed = setSchema.safeParse(req.body);
  if (!parsed.success) {
    invalidRequest(res, z.prettifyError(parsed.error));
    return;
  }

  const session = await WorkoutSession.findOne({
    _id: id,
    ownerId: identity.id,
  });
  if (!session) {
    res.status(404).json({
      success: false,
      error: {
        code: "WORKOUT_SESSION_NOT_FOUND",
        message: "Workout session not found",
      },
    });
    return;
  }
  if (session.status !== "active") {
    res.status(409).json({
      success: false,
      error: {
        code: "WORKOUT_SESSION_NOT_ACTIVE",
        message: "Sets can only be recorded on an active workout",
      },
    });
    return;
  }
  const exercise = session.exercises[parsed.data.exerciseIndex];
  const set = exercise?.sets[parsed.data.setIndex];
  if (!exercise || !set) {
    res.status(400).json({
      success: false,
      error: {
        code: "WORKOUT_SET_NOT_FOUND",
        message: "The selected exercise or set does not exist",
      },
    });
    return;
  }
  if (set.completedAt) {
    res.status(409).json({
      success: false,
      error: {
        code: "WORKOUT_SET_ALREADY_LOGGED",
        message: "This set has already been recorded",
      },
    });
    return;
  }

  set.actualReps = parsed.data.reps;
  set.actualWeight = parsed.data.weight;
  set.completedAt = new Date();
  await session.save();
  res.status(200).json({ success: true, data: session });
}

export async function finishWorkoutSession(
  req: Request,
  res: Response,
  queue?: WorkoutInsightsQueue,
  cache?: CacheStore,
): Promise<void> {
  await closeWorkoutSession(req, res, "completed", queue, cache);
}

export async function abandonWorkoutSession(
  req: Request,
  res: Response,
): Promise<void> {
  await closeWorkoutSession(req, res, "abandoned");
}

async function closeWorkoutSession(
  req: Request,
  res: Response,
  status: "completed" | "abandoned",
  queue?: WorkoutInsightsQueue,
  cache?: CacheStore,
): Promise<void> {
  const identity = requireIdentity(res);
  if (!identity) return;
  const id = req.params.id;
  if (!validSessionId(id)) {
    invalidRequest(res, "Workout session ID is invalid");
    return;
  }
  const session = await WorkoutSession.findOneAndUpdate(
    { _id: id, ownerId: identity.id, status: "active" },
    { $set: { status, finishedAt: new Date() } },
    { returnDocument: "after", runValidators: true },
  ).lean();
  if (!session) {
    const existing = await WorkoutSession.exists({
      _id: id,
      ownerId: identity.id,
    });
    if (!existing) {
      res.status(404).json({
        success: false,
        error: {
          code: "WORKOUT_SESSION_NOT_FOUND",
          message: "Workout session not found",
        },
      });
      return;
    }
    res.status(409).json({
      success: false,
      error: {
        code: "WORKOUT_SESSION_NOT_ACTIVE",
        message: "This workout session has already been closed",
      },
    });
    return;
  }
  let analytics: {
    status: "not_scheduled" | "queued" | "unavailable";
    jobId?: string;
  } = {
    status: "not_scheduled",
  };
  if (status === "completed") {
    await invalidateVersionedCache(
      cache,
      `fitforge:workout:insights:${identity.id}`,
    );
    if (queue) {
      try {
        analytics = {
          status: "queued",
          jobId: await queue.enqueue({
            ownerId: identity.id,
            sessionId: session._id.toString(),
          }),
        };
      } catch (error) {
        console.error(
          JSON.stringify({
            event: "workout_insights_job_enqueue_failed",
            sessionId: session._id.toString(),
            error: error instanceof Error ? error.name : "UnknownError",
          }),
        );
        analytics = { status: "unavailable" };
      }
    }
  }
  res.status(200).json({ success: true, data: session, analytics });
}

function parsePositiveInteger(
  value: unknown,
  defaultValue: number,
  maxValue: number,
): number | null {
  if (value === undefined) return defaultValue;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= maxValue ? parsed : null;
}
