export type NutrientFields = {
  caloriesPer100: number;
  proteinPer100: number;
  carbohydratesPer100: number;
  fatPer100: number;
  fiberPer100: number;
  sodiumMgPer100: number;
  calciumMgPer100: number;
  ironMgPer100: number;
  potassiumMgPer100: number;
  magnesiumMgPer100: number;
};

export type FoodRecord = {
  id: string;
  name: string;
  brand: string | null;
  serving_unit: "g" | "ml";
  calories_per_100: number;
  protein_per_100: number;
  carbohydrates_per_100: number;
  fat_per_100: number;
  fiber_per_100: number;
  sodium_mg_per_100: number;
  calcium_mg_per_100: number;
  iron_mg_per_100: number;
  potassium_mg_per_100: number;
  magnesium_mg_per_100: number;
  source_label: string;
  source_url: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateFoodInput = NutrientFields & {
  name: string;
  brand?: string | null;
  servingUnit: "g" | "ml";
  sourceLabel: string;
  sourceUrl?: string | null;
};

export type UpdateFoodPatch = Partial<CreateFoodInput>;

export type FoodEstimate = NutrientFields & {
  provider: string;
  model: string;
  sourceLabel: string;
};

export type MealLogTotals = {
  calories: number;
  proteinG: number;
  carbohydratesG: number;
  fatG: number;
  fiberG: number;
  sodiumMg: number;
  calciumMg: number;
  ironMg: number;
  potassiumMg: number;
  magnesiumMg: number;
};

export type MealLogItem = {
  id?: string;
  foodId: string;
  foodName?: string;
  servingAmount: number;
  servingUnit?: string;
  calories?: number;
  proteinG?: number;
  carbohydratesG?: number;
  fatG?: number;
  fiberG?: number;
  sodiumMg?: number;
  calciumMg?: number;
  ironMg?: number;
  potassiumMg?: number;
  magnesiumMg?: number;
  source?: string;
};

export type MealLogRow = {
  id: string;
  log_date: string;
  meal_type: string;
  items: unknown[];
  calories: number;
  protein_g: number;
  carbohydrates_g: number;
  fat_g: number;
  fiber_g: number;
  sodium_mg: number;
  calcium_mg: number;
  iron_mg: number;
  potassium_mg: number;
  magnesium_mg: number;
};

export type MealLogQueryResult = {
  rows: MealLogRow[];
  total: MealLogTotals;
};
