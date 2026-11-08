import { Request, Response } from "express";
import { z } from "zod";
import { MealRepository } from "../repositories/mealRepository.js";

const mealInputSchema = z
  .object({
    date: z.iso.date(),
    mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
    items: z
      .array(
        z
          .object({
            foodId: z.uuid(),
            servingAmount: z.number().min(0.1).max(10000),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();

function idFrom(value: unknown): string | null {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value
    : null;
}

export class MealController {
  constructor(private readonly repository: MealRepository) {}

  createMealLog = async (req: Request, res: Response): Promise<void> => {
    const ownerId = res.locals.identity.id;
    const parsed = mealInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_MEAL_LOG", message: z.prettifyError(parsed.error) },
      });
      return;
    }

    const logId = await this.repository.createMealLog(
      ownerId,
      parsed.data.date,
      parsed.data.mealType,
      parsed.data.items,
    );

    if (!logId) {
      res.status(422).json({
        success: false,
        error: { code: "UNKNOWN_FOOD", message: "One or more foods are unavailable to this account" },
      });
      return;
    }

    res.status(201).json({
      success: true,
      data: {
        id: logId,
        date: parsed.data.date,
        mealType: parsed.data.mealType,
      },
    });
  };

  getMealLogs = async (req: Request, res: Response): Promise<void> => {
    const ownerId = res.locals.identity.id;
    const date = z.iso.date().safeParse(req.query.date);
    if (!date.success) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_DATE", message: "A valid YYYY-MM-DD date is required" },
      });
      return;
    }

    const { rows, total } = await this.repository.getMealLogsByDate(ownerId, date.data);
    res.status(200).json({ success: true, data: rows, total });
  };

  deleteMealLog = async (req: Request, res: Response): Promise<void> => {
    const ownerId = res.locals.identity.id;
    const id = idFrom(req.params.id);
    if (!id) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_MEAL_LOG_ID", message: "Meal log ID must be a UUID" },
      });
      return;
    }

    const deleted = await this.repository.deleteMealLog(ownerId, id);
    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { code: "MEAL_LOG_NOT_FOUND", message: "Meal log not found" },
      });
      return;
    }

    res.status(204).end();
  };
}
