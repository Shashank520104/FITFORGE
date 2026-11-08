export type Measurement = {
  id?: string;
  measuredOn: string;
  weightKg: number;
  bodyFatPercent?: number;
  note?: string;
};

export type MeasurementRow = {
  id: string;
  measured_on: string;
  weight_kg: number;
  body_fat_percent: number | null;
  note: string | null;
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

export type StrengthRow = {
  id: string;
  exercise_name: string;
  exercise_id: string | null;
  performed_at: string;
  weight_kg: number;
  repetitions: number;
  note: string | null;
};

export type ActivityInput = {
  activityDate: string;
  activityTime: string;
  activityType: string;
  durationMinutes: number;
  distanceKm?: number;
  note?: string;
};

export type ActivityRow = {
  id: string;
  activity_date: string;
  activity_time: string;
  activity_type: string;
  duration_minutes: number;
  distance_km: number | null;
  note: string | null;
  source: string;
  created_at: string;
};

export type SleepInput = {
  sleepDate: string;
  bedtime: string;
  wakeTime: string;
  durationMinutes: number;
  note?: string;
};

export type SleepRow = {
  id: string;
  sleep_date: string;
  bedtime: string;
  wake_time: string;
  duration_minutes: number;
  note: string | null;
  source: string;
  created_at: string;
};

export type DailyActivitiesAndSleep = {
  activities: ActivityRow[];
  sleep: SleepRow[];
  activityMinutes: number;
  sleepMinutes: number;
};

export type ActivitySummaryRow = {
  summary_date: string;
  activity_minutes: number;
  distance_km: number;
  activity_count: number;
  sleep_minutes: number;
  sleep_count: number;
};

export type ProgressSummary = {
  measurements: Array<{
    measured_on: string;
    weight_kg: number;
    body_fat_percent: number | null;
  }>;
  personalRecords: Array<{
    exercise_name: string;
    performed_at: string;
    weight_kg: number;
    repetitions: number;
  }>;
};
