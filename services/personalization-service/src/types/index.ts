export type WellnessProfileRecord = {
  heightCm: number;
  weightKg: number;
  dietPreference: "vegetarian" | "non_vegetarian" | "vegan";
  experienceLevel: "beginner" | "intermediate" | "advanced";
  exerciseCleared: boolean;
  updatedAt: string;
};

export type HealthReportRow = {
  id: string;
  filename: string;
  mediaType: string;
  fileSize: number;
  createdAt: string;
};

export type EncryptedReportRecord = {
  id: string;
  filename: string;
  media_type: string;
  file_size: number;
  encrypted_content: Buffer;
  initialization_vector: Buffer;
  authentication_tag: Buffer;
};

export type WorkoutActivity = {
  name: string;
  minutes: number;
  guidance: string;
};

export type WorkoutDay = {
  day: number;
  focus: string;
  activities: WorkoutActivity[];
};

export type MealSuggestion = {
  name: "breakfast" | "lunch" | "snack" | "dinner";
  suggestions: string[];
};

export type DietDay = {
  day: number;
  meals: MealSuggestion[];
};

export type WellnessPlanRecord = {
  dietDays: DietDay[];
  workoutDays: WorkoutDay[] | null;
  generatedAt: string;
  exerciseCleared: boolean;
  notice: string;
  workoutNotice: string | null;
};
