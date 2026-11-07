import { Request, Response } from "express";
import Exercise from "../models/exercise.model.js";
import { CacheStore, readCache, writeCache } from "../services/cache.js";

const exerciseCacheTtlSeconds = 5 * 60;

const difficulties = ["beginner", "intermediate", "advanced"];

function readQueryString(value: unknown): string | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}

function readPositiveInteger(
  value: unknown,
  defaultValue: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number | null {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= maximum ? parsed : null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function invalidQuery(res: Response): void {
  res.status(400).json({
    success: false,
    error: {
      code: "INVALID_QUERY",
      message: "Query parameters are invalid",
    },
  });
}

export async function listExercises(
  req: Request,
  res: Response,
  cache?: CacheStore,
): Promise<void> {
  const muscle = readQueryString(req.query.muscle);
  const difficulty = readQueryString(req.query.difficulty);
  const page = readPositiveInteger(req.query.page, 1, 1_000_000);
  const limit = readPositiveInteger(req.query.limit, 20, 100);

  if (
    muscle === null ||
    (muscle !== undefined && muscle.length > 50) ||
    difficulty === null ||
    (difficulty !== undefined && !difficulties.includes(difficulty)) ||
    page === null ||
    limit === null
  ) {
    invalidQuery(res);
    return;
  }

  const filter: Record<string, unknown> = {};
  if (muscle !== undefined) {
    filter.muscleGroups = new RegExp(escapeRegex(muscle), "i");
  }
  if (difficulty !== undefined) {
    filter.difficulty = difficulty;
  }

  const cacheKey = `fitforge:workout:exercises:list:${JSON.stringify({
    muscle: muscle?.toLowerCase(),
    difficulty,
    page,
    limit,
  })}`;
  const cached = await readCache<{
    success: true;
    data: unknown[];
    pagination: { page: number; limit: number };
  }>(cache, cacheKey);
  if (cached) {
    res.status(200).json(cached);
    return;
  }

  const data = await Exercise.find(filter)
    .sort({ name: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const response = {
    success: true,
    data,
    pagination: {
      page,
      limit,
    },
  };
  await writeCache(cache, cacheKey, response, exerciseCacheTtlSeconds);
  res.status(200).json(response);
}

export async function getExercise(
  req: Request,
  res: Response,
  cache?: CacheStore,
): Promise<void> {
  const { id } = req.params;

  if (typeof id !== "string" || !isValidObjectId(id)) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_EXERCISE_ID",
        message: "Exercise ID must be a valid MongoDB ObjectId",
      },
    });
    return;
  }

  const cacheKey = `fitforge:workout:exercises:detail:${id}`;
  const cached = await readCache<{
    success: true;
    data: unknown;
  }>(cache, cacheKey);
  if (cached) {
    res.status(200).json(cached);
    return;
  }

  const exercise = await Exercise.findById(id).lean();
  if (!exercise) {
    res.status(404).json({
      success: false,
      error: {
        code: "EXERCISE_NOT_FOUND",
        message: "Exercise not found",
      },
    });
    return;
  }

  const response = {
    success: true,
    data: exercise,
  };
  await writeCache(cache, cacheKey, response, exerciseCacheTtlSeconds);
  res.status(200).json(response);
}

function isValidObjectId(id: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(id);
}
