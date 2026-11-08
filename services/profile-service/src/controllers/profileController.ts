import { Request, Response } from "express";
import { z } from "zod";
import { ProfileRepository } from "../repositories/profileRepository.js";

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

export class ProfileController {
  constructor(private readonly repository: ProfileRepository) {}

  getProfile = async (_req: Request, res: Response): Promise<void> => {
    const profile = await this.repository.getOrCreateProfile(
      res.locals.ownerId,
    );
    res.status(200).json({ success: true, data: profile });
  };

  patchProfile = async (req: Request, res: Response): Promise<void> => {
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

    const updated = await this.repository.patchProfile(
      res.locals.ownerId,
      parsed.data,
    );
    res.status(200).json({ success: true, data: updated });
  };
}
