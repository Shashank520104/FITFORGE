export type UserProfileRecord = {
  display_name: string | null;
  units: "metric" | "imperial";
  training_goal: string | null;
  experience_level: string | null;
  equipment: string[];
  dietary_preferences: string[];
  created_at: string;
  updated_at: string;
};

export type ProfilePatchDto = {
  displayName?: string | null;
  units?: "metric" | "imperial";
  trainingGoal?: string | null;
  experienceLevel?: string | null;
  equipment?: string[];
  dietaryPreferences?: string[];
};
