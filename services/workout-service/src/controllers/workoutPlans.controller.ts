import { Request, Response } from "express";
import { z } from "zod";
import {
  createWorkoutPlan as saveWorkoutPlan,
  deleteWorkoutPlan as removeWorkoutPlan,
  exercisesExist,
  getWorkoutPlan as findWorkoutPlanById,
  isValidPlanId,
  listWorkoutPlans as findWorkoutPlans,
  updateWorkoutPlan as saveWorkoutPlanChanges,
} from "../services/workoutPlans.service.js";

const workoutPlanFields = {
  name: z.string().trim().min(1).max(80),
  goal: z.enum([
    "muscle_gain",
    "fat_loss",
    "powerlifting",
    "athletic_performance",
    "general_fitness",
  ]),
  days: z
    .array(
      z
        .object({
          day: z.number().int().min(1).max(7),
          name: z.string().trim().min(1).max(60),
          exercises: z
            .array(
              z
                .object({
                  exerciseId: z.string().regex(/^[0-9a-fA-F]{24}$/),
                  sets: z
                    .array(
                      z
                        .object({
                          reps: z.number().int().min(1).max(100),
                          weight: z
                            .number()
                            .min(0)
                            .max(500)
                            .nullable()
                            .optional(),
                          restSeconds: z.number().int().min(0).max(3600),
                        })
                        .strict(),
                    )
                    .min(1)
                    .max(10),
                })
                .strict(),
            )
            .min(1)
            .max(12),
        })
        .strict(),
    )
    .min(1)
    .max(7),
};

function validateUniqueDays(
  plan: { days?: Array<{ day: number }> },
  context: z.RefinementCtx,
): void {
  if (!plan.days) {
    return;
  }
  const days = plan.days.map((workoutDay) => workoutDay.day);
  if (new Set(days).size !== days.length) {
    context.addIssue({
      code: "custom",
      path: ["days"],
      message: "Workout day numbers must be unique",
    });
  }
}

const workoutPlanSchema = z
  .object(workoutPlanFields)
  .strict()
  .superRefine(validateUniqueDays);

const workoutPlanPatchSchema = z
  .object({
    name: workoutPlanFields.name.optional(),
    goal: workoutPlanFields.goal.optional(),
    days: workoutPlanFields.days.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one plan field must be provided",
  })
  .superRefine(validateUniqueDays);

type UserIdentity = { id: string };

function getUserIdentity(res: Response): UserIdentity | undefined {
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

function validationError(res: Response, message: string): void {
  res.status(400).json({
    success: false,
    error: { code: "INVALID_REQUEST", message },
  });
}

export async function createWorkoutPlan(
  req: Request,
  res: Response,
): Promise<void> {
  const userIdentity = getUserIdentity(res);
  if (!userIdentity) {
    res.status(401).json({
      success: false,
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication is required",
      },
    });
    return;
  }

  const validatedPlan = workoutPlanSchema.safeParse(req.body);
  if (!validatedPlan.success) {
    validationError(res, z.prettifyError(validatedPlan.error));
    return;
  }
  if (!(await exercisesExist(validatedPlan.data.days))) {
    res.status(422).json({
      success: false,
      error: {
        code: "UNKNOWN_EXERCISE",
        message: "One or more exercises do not exist",
      },
    });
    return;
  }

  const savedPlan = await saveWorkoutPlan(userIdentity.id, validatedPlan.data);
  res.status(201).json({ success: true, data: savedPlan });
}

export async function listWorkoutPlans(
  req: Request,
  res: Response,
): Promise<void> {
  const userIdentity = getUserIdentity(res);
  if (!userIdentity) {
    res.status(401).json({
      success: false,
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication is required",
      },
    });
    return;
  }

  const page = parsePositiveInteger(req.query.page, 1, 1_000_000);
  const limit = parsePositiveInteger(req.query.limit, 20, 100);
  if (page === null || limit === null) {
    validationError(
      res,
      "Page must be a positive integer and limit must be between 1 and 100",
    );
    return;
  }

  const planPage = await findWorkoutPlans(userIdentity.id, page, limit);
  res.status(200).json({
    success: true,
    data: planPage.data,
    pagination: {
      page,
      limit,
      total: planPage.total,
      pages: Math.ceil(planPage.total / limit),
    },
  });
}

export async function getWorkoutPlan(
  req: Request,
  res: Response,
): Promise<void> {
  const userIdentity = getUserIdentity(res);
  const planId = req.params.id;
  if (!userIdentity) {
    res.status(401).json({
      success: false,
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication is required",
      },
    });
    return;
  }
  if (typeof planId !== "string" || !isValidPlanId(planId)) {
    res.status(400).json({
      success: false,
      error: { code: "INVALID_PLAN_ID", message: "Workout plan ID is invalid" },
    });
    return;
  }

  const workoutPlan = await findWorkoutPlanById(userIdentity.id, planId);
  if (!workoutPlan) {
    res.status(404).json({
      success: false,
      error: {
        code: "WORKOUT_PLAN_NOT_FOUND",
        message: "Workout plan not found",
      },
    });
    return;
  }
  res.status(200).json({ success: true, data: workoutPlan });
}

export async function updateWorkoutPlan(
  req: Request,
  res: Response,
): Promise<void> {
  const userIdentity = getUserIdentity(res);
  const planId = req.params.id;
  if (!userIdentity) {
    res.status(401).json({
      success: false,
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication is required",
      },
    });
    return;
  }
  if (typeof planId !== "string" || !isValidPlanId(planId)) {
    res.status(400).json({
      success: false,
      error: { code: "INVALID_PLAN_ID", message: "Workout plan ID is invalid" },
    });
    return;
  }

  const validatedUpdates = workoutPlanPatchSchema.safeParse(req.body);
  if (!validatedUpdates.success) {
    validationError(res, z.prettifyError(validatedUpdates.error));
    return;
  }
  if (
    validatedUpdates.data.days &&
    !(await exercisesExist(validatedUpdates.data.days))
  ) {
    res.status(422).json({
      success: false,
      error: {
        code: "UNKNOWN_EXERCISE",
        message: "One or more exercises do not exist",
      },
    });
    return;
  }

  const updatedPlan = await saveWorkoutPlanChanges(
    userIdentity.id,
    planId,
    validatedUpdates.data,
  );
  if (!updatedPlan) {
    res.status(404).json({
      success: false,
      error: {
        code: "WORKOUT_PLAN_NOT_FOUND",
        message: "Workout plan not found",
      },
    });
    return;
  }
  res.status(200).json({ success: true, data: updatedPlan });
}

export async function deleteWorkoutPlan(
  req: Request,
  res: Response,
): Promise<void> {
  const userIdentity = getUserIdentity(res);
  const planId = req.params.id;
  if (!userIdentity) {
    res.status(401).json({
      success: false,
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication is required",
      },
    });
    return;
  }
  if (typeof planId !== "string" || !isValidPlanId(planId)) {
    res.status(400).json({
      success: false,
      error: { code: "INVALID_PLAN_ID", message: "Workout plan ID is invalid" },
    });
    return;
  }

  const deletedPlan = await removeWorkoutPlan(userIdentity.id, planId);
  if (!deletedPlan) {
    res.status(404).json({
      success: false,
      error: {
        code: "WORKOUT_PLAN_NOT_FOUND",
        message: "Workout plan not found",
      },
    });
    return;
  }
  res.status(204).end();
}

function parsePositiveInteger(
  value: unknown,
  defaultValue: number,
  maxValue: number,
): number | null {
  if (value === undefined) {
    return defaultValue;
  }
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= maxValue ? parsed : null;
}
