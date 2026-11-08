import { Pool } from "pg";

export class MealRepository {
  constructor(private readonly pool: Pool) {}

  async createMealLog(
    ownerId: string,
    date: string,
    mealType: string,
    items: Array<{ foodId: string; servingAmount: number }>,
  ): Promise<string | null> {
    const client = await this.pool.connect();
    let transactionOpen = false;
    try {
      await client.query("BEGIN");
      transactionOpen = true;
      const ids = [...new Set(items.map((item) => item.foodId))];
      const foods = await client.query(
        `SELECT id, owner_id, name, serving_unit, calories_per_100, protein_per_100,
              carbohydrates_per_100, fat_per_100, fiber_per_100, sodium_mg_per_100,
               calcium_mg_per_100, iron_mg_per_100, potassium_mg_per_100, magnesium_mg_per_100,
               source_label
       FROM foods WHERE id = ANY($1::uuid[]) AND owner_id = $2`,
        [ids, ownerId],
      );
      const foodsById = new Map(foods.rows.map((food) => [food.id, food]));
      if (foodsById.size !== ids.length) {
        await client.query("ROLLBACK");
        transactionOpen = false;
        return null;
      }

      const logResult = await client.query(
        `INSERT INTO meal_logs (owner_id, log_date, meal_type)
       VALUES ($1, $2, $3) RETURNING id`,
        [ownerId, date, mealType],
      );
      const logId = logResult.rows[0].id as string;
      for (const item of items) {
        const food = foodsById.get(item.foodId);
        if (!food) {
          throw new Error("Validated food disappeared from transaction result");
        }
        const ratio = item.servingAmount / 100;
        await client.query(
          `INSERT INTO meal_log_items (
           log_id, food_id, food_name_snapshot, serving_unit, serving_amount,
           calories, protein_g, carbohydrates_g, fat_g, fiber_g, sodium_mg,
           calcium_mg, iron_mg, potassium_mg, magnesium_mg,
           source_label_snapshot
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
          [
            logId,
            food.id,
            food.name,
            food.serving_unit,
            item.servingAmount,
            Number(food.calories_per_100) * ratio,
            Number(food.protein_per_100) * ratio,
            Number(food.carbohydrates_per_100) * ratio,
            Number(food.fat_per_100) * ratio,
            Number(food.fiber_per_100) * ratio,
            Number(food.sodium_mg_per_100) * ratio,
            Number(food.calcium_mg_per_100) * ratio,
            Number(food.iron_mg_per_100) * ratio,
            Number(food.potassium_mg_per_100) * ratio,
            Number(food.magnesium_mg_per_100) * ratio,
            food.source_label,
          ],
        );
      }
      await client.query("COMMIT");
      transactionOpen = false;
      return logId;
    } catch (error) {
      if (transactionOpen) await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getMealLogsByDate(ownerId: string, date: string): Promise<{ rows: any[]; total: any }> {
    const result = await this.pool.query(
      `SELECT logs.id, logs.log_date, logs.meal_type,
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'id', items.id, 'foodId', items.food_id, 'foodName', items.food_name_snapshot,
                  'servingUnit', items.serving_unit, 'servingAmount', items.serving_amount,
                  'calories', items.calories, 'proteinG', items.protein_g,
                  'carbohydratesG', items.carbohydrates_g, 'fatG', items.fat_g,
                  'fiberG', items.fiber_g, 'sodiumMg', items.sodium_mg,
                  'calciumMg', items.calcium_mg, 'ironMg', items.iron_mg,
                  'potassiumMg', items.potassium_mg, 'magnesiumMg', items.magnesium_mg,
                  'source', items.source_label_snapshot
                ) ORDER BY items.created_at
              ) FILTER (WHERE items.id IS NOT NULL), '[]'::jsonb
            ) AS items,
            COALESCE(sum(items.calories), 0) AS calories,
            COALESCE(sum(items.protein_g), 0) AS protein_g,
            COALESCE(sum(items.carbohydrates_g), 0) AS carbohydrates_g,
            COALESCE(sum(items.fat_g), 0) AS fat_g,
            COALESCE(sum(items.fiber_g), 0) AS fiber_g,
            COALESCE(sum(items.sodium_mg), 0) AS sodium_mg,
            COALESCE(sum(items.calcium_mg), 0) AS calcium_mg,
            COALESCE(sum(items.iron_mg), 0) AS iron_mg,
            COALESCE(sum(items.potassium_mg), 0) AS potassium_mg,
            COALESCE(sum(items.magnesium_mg), 0) AS magnesium_mg
     FROM meal_logs logs
     LEFT JOIN meal_log_items items ON items.log_id = logs.id
     WHERE logs.owner_id = $1 AND logs.log_date = $2
     GROUP BY logs.id
     ORDER BY logs.meal_type, logs.created_at`,
      [ownerId, date],
    );

    const total = result.rows.reduce(
      (sum, row) => ({
        calories: sum.calories + Number(row.calories),
        proteinG: sum.proteinG + Number(row.protein_g),
        carbohydratesG: sum.carbohydratesG + Number(row.carbohydrates_g),
        fatG: sum.fatG + Number(row.fat_g),
        fiberG: sum.fiberG + Number(row.fiber_g),
        sodiumMg: sum.sodiumMg + Number(row.sodium_mg),
        calciumMg: sum.calciumMg + Number(row.calcium_mg),
        ironMg: sum.ironMg + Number(row.iron_mg),
        potassiumMg: sum.potassiumMg + Number(row.potassium_mg),
        magnesiumMg: sum.magnesiumMg + Number(row.magnesium_mg),
      }),
      {
        calories: 0,
        proteinG: 0,
        carbohydratesG: 0,
        fatG: 0,
        fiberG: 0,
        sodiumMg: 0,
        calciumMg: 0,
        ironMg: 0,
        potassiumMg: 0,
        magnesiumMg: 0,
      },
    );

    return { rows: result.rows, total };
  }

  async deleteMealLog(ownerId: string, id: string): Promise<boolean> {
    const result = await this.pool.query(
      "DELETE FROM meal_logs WHERE id = $1 AND owner_id = $2 RETURNING id",
      [id, ownerId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
