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

export type FoodItem = NutrientFields & {
  id: string;
  name: string;
  brand?: string | null;
  servingUnit: "g" | "ml";
  sourceLabel: string;
  sourceUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
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

export type MealLog = {
  id: string;
  date: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  items: MealLogItem[];
  totals?: NutrientFields;
};
