CREATE TABLE IF NOT EXISTS body_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  measured_on DATE NOT NULL,
  weight_kg NUMERIC(6, 2) NOT NULL CHECK (weight_kg BETWEEN 20 AND 500),
  body_fat_percent NUMERIC(5, 2) CHECK (body_fat_percent IS NULL OR body_fat_percent BETWEEN 1 AND 75),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, measured_on)
);

CREATE INDEX IF NOT EXISTS body_measurements_owner_date_idx
  ON body_measurements (owner_id, measured_on);

CREATE TABLE IF NOT EXISTS strength_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  exercise_name TEXT NOT NULL CHECK (char_length(exercise_name) BETWEEN 1 AND 120),
  exercise_id TEXT CHECK (exercise_id IS NULL OR char_length(exercise_id) <= 64),
  performed_at DATE NOT NULL,
  weight_kg NUMERIC(7, 2) NOT NULL CHECK (weight_kg BETWEEN 0 AND 2000),
  repetitions INTEGER NOT NULL CHECK (repetitions BETWEEN 1 AND 100),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS strength_records_owner_exercise_date_idx
  ON strength_records (owner_id, lower(exercise_name), performed_at);
