import { Pool } from "pg";
import {
  CreateFoodInput,
  FoodRecord,
  UpdateFoodPatch,
} from "../types/index.js";

export class FoodRepository {
  constructor(private readonly pool: Pool) {}

  async listFoods(
    ownerId: string,
    search: string,
    limit: number,
    offset: number,
  ): Promise<FoodRecord[]> {
    const result = await this.pool.query<FoodRecord>(
      `SELECT id, name, brand, serving_unit, calories_per_100, protein_per_100,
            carbohydrates_per_100, fat_per_100, fiber_per_100, sodium_mg_per_100,
            calcium_mg_per_100, iron_mg_per_100, potassium_mg_per_100, magnesium_mg_per_100,
            source_label, source_url, created_at, updated_at
     FROM foods
     WHERE owner_id = $1 AND ($2 = '' OR name ILIKE '%' || $2 || '%' OR brand ILIKE '%' || $2 || '%')
     ORDER BY lower(name), id
     LIMIT $3 OFFSET $4`,
      [ownerId, search, limit, offset],
    );
    return result.rows;
  }

  async createFood(
    ownerId: string,
    food: CreateFoodInput,
  ): Promise<FoodRecord> {
    const result = await this.pool.query<FoodRecord>(
      `INSERT INTO foods (
       owner_id, name, brand, serving_unit, calories_per_100, protein_per_100,
       carbohydrates_per_100, fat_per_100, fiber_per_100, sodium_mg_per_100,
       calcium_mg_per_100, iron_mg_per_100, potassium_mg_per_100, magnesium_mg_per_100,
       source_label, source_url
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
      [
        ownerId,
        food.name,
        food.brand ?? null,
        food.servingUnit,
        food.caloriesPer100,
        food.proteinPer100,
        food.carbohydratesPer100,
        food.fatPer100,
        food.fiberPer100,
        food.sodiumMgPer100,
        food.calciumMgPer100,
        food.ironMgPer100,
        food.potassiumMgPer100,
        food.magnesiumMgPer100,
        food.sourceLabel,
        food.sourceUrl ?? null,
      ],
    );
    return result.rows[0];
  }

  async updateFood(
    ownerId: string,
    id: string,
    patch: UpdateFoodPatch,
  ): Promise<FoodRecord | null> {
    const columnNames: Record<string, string> = {
      name: "name",
      brand: "brand",
      servingUnit: "serving_unit",
      caloriesPer100: "calories_per_100",
      proteinPer100: "protein_per_100",
      carbohydratesPer100: "carbohydrates_per_100",
      fatPer100: "fat_per_100",
      fiberPer100: "fiber_per_100",
      sodiumMgPer100: "sodium_mg_per_100",
      calciumMgPer100: "calcium_mg_per_100",
      ironMgPer100: "iron_mg_per_100",
      potassiumMgPer100: "potassium_mg_per_100",
      magnesiumMgPer100: "magnesium_mg_per_100",
      sourceLabel: "source_label",
      sourceUrl: "source_url",
    };
    const entries = Object.entries(patch);
    const assignments = entries.map(
      ([key], index) => `${columnNames[key]} = $${index + 3}`,
    );
    const values = entries.map(([, value]) => value);
    const result = await this.pool.query<FoodRecord>(
      `UPDATE foods SET ${assignments.join(", ")}, updated_at = now()
     WHERE owner_id = $1 AND id = $2 RETURNING *`,
      [ownerId, id, ...values],
    );
    return result.rows[0] ?? null;
  }

  async deleteFood(ownerId: string, id: string): Promise<boolean> {
    const result = await this.pool.query(
      "DELETE FROM foods WHERE id = $1 AND owner_id = $2 RETURNING id",
      [id, ownerId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
