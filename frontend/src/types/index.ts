export type User = { id: string; email: string };

export type Session = { user: User; accessToken: string };

export type Page =
  | "overview"
  | "plans"
  | "exercises"
  | "nutrition"
  | "activity"
  | "wellness"
  | "progress"
  | "assistant"
  | "account";

export type ApiResponse<T> = { success: boolean; data: T; total?: Totals };

export type Exercise = {
  _id: string;
  name: string;
  muscleGroups: string[];
  equipment: string[];
  difficulty: string;
  movementType: string;
  description: string;
};

export type Plan = {
  _id: string;
  name: string;
  goal: string;
  days: Array<{
    day: number;
    name: string;
    exercises: Array<{ exerciseId: string; sets: Array<{ reps: number }> }>;
  }>;
};

export type WorkoutSessionSet = {
  plannedReps: number;
  plannedWeight: number | null;
  restSeconds: number;
  actualReps?: number;
  actualWeight?: number;
  completedAt?: string;
};

export type WorkoutSessionExercise = {
  exerciseId: string;
  exerciseName: string;
  sets: WorkoutSessionSet[];
};

export type WorkoutSession = {
  _id: string;
  planName: string;
  dayName: string;
  status: "active" | "completed" | "abandoned";
  startedAt: string;
  finishedAt?: string;
  exercises: WorkoutSessionExercise[];
};

export type WorkoutInsight = {
  exerciseId: string;
  exerciseName: string;
  direction: "new" | "up" | "steady" | "down";
  changePercent: number | null;
  latest: {
    performedAt: string;
    completedSets: number;
    volumeKg: number;
    topSet: { weightKg: number; reps: number };
  };
  previous: {
    performedAt: string;
    completedSets: number;
    volumeKg: number;
    topSet: { weightKg: number; reps: number };
  } | null;
};

export type Profile = {
  display_name: string | null;
  units: "metric" | "imperial";
  training_goal: string | null;
  experience_level: string | null;
  equipment: string[];
  dietary_preferences: string[];
};

export type Food = {
  id: string;
  name: string;
  serving_unit: "g" | "ml";
  calories_per_100: string;
  protein_per_100: string;
  carbohydrates_per_100: string;
  fat_per_100: string;
  fiber_per_100: string;
  sodium_mg_per_100: string;
  source_label: string;
};

export type NutritionLogItem = {
  foodName: string;
  servingAmount: string;
  servingUnit: string;
  calories: string;
  proteinG: string;
  carbohydratesG: string;
  fatG: string;
  source: string;
};

export type NutritionLog = {
  id: string;
  meal_type: string;
  items: NutritionLogItem[];
};

export type ActivityRecord = {
  id: string;
  activity_time: string;
  activity_type: string;
  duration_minutes: string;
  distance_km: string | null;
  note: string | null;
  source: string;
};

export type SleepRecord = {
  id: string;
  bedtime: string;
  wake_time: string;
  duration_minutes: string;
  note: string | null;
  source: string;
};

export type ActivityDay = {
  activities: ActivityRecord[];
  sleep: SleepRecord[];
  activityMinutes: number;
  sleepMinutes: number;
};

export type ActivityProgressDay = {
  summary_date: string;
  activity_minutes: string;
  distance_km: string;
  activity_count: string;
  sleep_minutes: string;
  sleep_count: string;
};

export type WellnessProfile = {
  heightCm: number;
  weightKg: number;
  dietPreference: "vegetarian" | "non_vegetarian" | "vegan";
  experienceLevel: "beginner" | "intermediate" | "advanced";
  exerciseCleared: boolean;
  updatedAt: string;
};

export type HealthReport = {
  id: string;
  filename: string;
  mediaType: string;
  fileSize: number;
  createdAt: string;
};

export type WellnessPlan = {
  dietDays: Array<{
    day: number;
    meals: Array<{
      name: "breakfast" | "lunch" | "snack" | "dinner";
      suggestions: string[];
    }>;
  }>;
  workoutDays: Array<{
    day: number;
    focus: string;
    activities: Array<{ name: string; minutes: number; guidance: string }>;
  }> | null;
  generatedAt: string;
  exerciseCleared: boolean;
  notice: string;
  workoutNotice: string | null;
};

export type ReportSummary = {
  reportId: string;
  summary: string;
  note: string;
  provider: string;
};

export type CoachMessage = {
  role: "user" | "assistant";
  content: string;
};

export type Measurement = {
  measured_on: string;
  weight_kg: string;
  body_fat_percent: string | null;
};

export type StrengthRecord = {
  exercise_name: string;
  performed_at: string;
  weight_kg: string;
  repetitions: number;
};

export type Totals = {
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

export type FoodEstimate = {
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
  provider: string;
  model: string;
  sourceLabel: string;
};

export type FoodNutritionFields = Omit<
  FoodEstimate,
  "provider" | "model" | "sourceLabel"
>;

export const emptyFoodValues: Record<keyof FoodNutritionFields, string> = {
  caloriesPer100: "",
  proteinPer100: "",
  carbohydratesPer100: "",
  fatPer100: "",
  fiberPer100: "",
  sodiumMgPer100: "",
  calciumMgPer100: "",
  ironMgPer100: "",
  potassiumMgPer100: "",
  magnesiumMgPer100: "",
};
