import { Request, Response } from "express";
import { z } from "zod";
import { FoodRepository } from "../repositories/foodRepository.js";
import { AiNutritionService } from "../services/aiNutritionService.js";

const nutrientFields = {
  caloriesPer100: z.number().min(0).max(1000),
  proteinPer100: z.number().min(0).max(100),
  carbohydratesPer100: z.number().min(0).max(100),
  fatPer100: z.number().min(0).max(100),
  fiberPer100: z.number().min(0).max(100),
  sodiumMgPer100: z.number().min(0).max(100000),
  calciumMgPer100: z.number().min(0).max(100000),
  ironMgPer100: z.number().min(0).max(10000),
  potassiumMgPer100: z.number().min(0).max(100000),
  magnesiumMgPer100: z.number().min(0).max(100000),
};

const estimateInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    servingUnit: z.enum(["g", "ml"]),
  })
  .strict();

const foodInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    brand: z.string().trim().min(1).max(120).optional(),
    servingUnit: z.enum(["g", "ml"]),
    ...nutrientFields,
    calciumMgPer100: nutrientFields.calciumMgPer100.default(0),
    ironMgPer100: nutrientFields.ironMgPer100.default(0),
    potassiumMgPer100: nutrientFields.potassiumMgPer100.default(0),
    magnesiumMgPer100: nutrientFields.magnesiumMgPer100.default(0),
    sourceLabel: z.string().trim().min(1).max(200),
    sourceUrl: z.url().max(2048).optional(),
  })
  .strict();

const foodPatchSchema = z
  .object({
    name: foodInputSchema.shape.name.optional(),
    brand: foodInputSchema.shape.brand.nullable().optional(),
    servingUnit: foodInputSchema.shape.servingUnit.optional(),
    caloriesPer100: foodInputSchema.shape.caloriesPer100.optional(),
    proteinPer100: foodInputSchema.shape.proteinPer100.optional(),
    carbohydratesPer100: foodInputSchema.shape.carbohydratesPer100.optional(),
    fatPer100: foodInputSchema.shape.fatPer100.optional(),
    fiberPer100: foodInputSchema.shape.fiberPer100.optional(),
    sodiumMgPer100: foodInputSchema.shape.sodiumMgPer100.optional(),
    calciumMgPer100: foodInputSchema.shape.calciumMgPer100.optional(),
    ironMgPer100: foodInputSchema.shape.ironMgPer100.optional(),
    potassiumMgPer100: foodInputSchema.shape.potassiumMgPer100.optional(),
    magnesiumMgPer100: foodInputSchema.shape.magnesiumMgPer100.optional(),
    sourceLabel: foodInputSchema.shape.sourceLabel.optional(),
    sourceUrl: foodInputSchema.shape.sourceUrl.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one food field must be provided",
  });

function positiveInteger(
  value: unknown,
  fallback: number,
  maximum: number,
): number | null {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= maximum ? parsed : null;
}

function idFrom(value: unknown): string | null {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value
    : null;
}

export class FoodController {
  constructor(
    private readonly repository: FoodRepository,
    private readonly aiService: AiNutritionService,
  ) {}

  listFoods = async (req: Request, res: Response): Promise<void> => {
    const ownerId = res.locals.identity.id;
    const page = positiveInteger(req.query.page, 1, 1000000);
    const limit = positiveInteger(req.query.limit, 20, 100);
    const search =
      req.query.search === undefined
        ? ""
        : typeof req.query.search === "string"
          ? req.query.search.trim()
          : null;
    if (
      page === null ||
      limit === null ||
      search === null ||
      search.length > 100
    ) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_QUERY",
          message: "Food search or pagination parameters are invalid",
        },
      });
      return;
    }
    const data = await this.repository.listFoods(
      ownerId,
      search,
      limit,
      (page - 1) * limit,
    );
    res.status(200).json({ success: true, data, pagination: { page, limit } });
  };

  createFood = async (req: Request, res: Response): Promise<void> => {
    const ownerId = res.locals.identity.id;
    const parsed = foodInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_FOOD", message: z.prettifyError(parsed.error) },
      });
      return;
    }
    const data = await this.repository.createFood(ownerId, parsed.data);
    res.status(201).json({ success: true, data });
  };

  updateFood = async (req: Request, res: Response): Promise<void> => {
    const ownerId = res.locals.identity.id;
    const id = idFrom(req.params.id);
    if (!id) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_FOOD_ID", message: "Food ID must be a UUID" },
      });
      return;
    }
    const parsed = foodPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_FOOD",
          message: z.prettifyError(parsed.error),
        },
      });
      return;
    }
    const data = await this.repository.updateFood(ownerId, id, parsed.data);
    if (!data) {
      res.status(404).json({
        success: false,
        error: { code: "FOOD_NOT_FOUND", message: "Food not found" },
      });
      return;
    }
    res.status(200).json({ success: true, data });
  };

  deleteFood = async (req: Request, res: Response): Promise<void> => {
    const ownerId = res.locals.identity.id;
    const id = idFrom(req.params.id);
    if (!id) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_FOOD_ID", message: "Food ID must be a UUID" },
      });
      return;
    }
    const deleted = await this.repository.deleteFood(ownerId, id);
    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { code: "FOOD_NOT_FOUND", message: "Food not found" },
      });
      return;
    }
    res.status(204).end();
  };

  checkEstimateAvailability = async (
    _req: Request,
    res: Response,
  ): Promise<void> => {
    const available = await this.aiService.checkModelAvailability();
    res.status(200).json({ success: true, data: { available } });
  };

  estimateFood = async (req: Request, res: Response): Promise<void> => {
    const parsed = estimateInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_FOOD_ESTIMATE",
          message: z.prettifyError(parsed.error),
        },
      });
      return;
    }
    const data = await this.aiService.estimateFood(
      parsed.data.name,
      parsed.data.servingUnit,
    );
    res.status(200).json({ success: true, data });
  };
}
