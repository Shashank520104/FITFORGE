export type Measurement = {
  id?: string;
  measuredOn: string;
  weightKg: number;
  bodyFatPercent?: number;
  note?: string;
};

export type StrengthRecord = {
  id?: string;
  exerciseName: string;
  exerciseId?: string;
  performedAt: string;
  weightKg: number;
  repetitions: number;
  note?: string;
};

export type ActivityRecord = {
  id?: string;
  activityDate: string;
  activityTime: string;
  activityType: "walking" | "running" | "cycling" | "strength" | "yoga" | "other";
  durationMinutes: number;
  distanceKm?: number;
  note?: string;
};

export type SleepRecord = {
  id?: string;
  sleepDate: string;
  bedtime: string;
  wakeTime: string;
  note?: string;
};
