CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  activity_date DATE NOT NULL,
  activity_type TEXT NOT NULL CHECK (
    activity_type IN ('walking', 'running', 'cycling', 'strength', 'yoga', 'other')
  ),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 1 AND 1440),
  distance_km NUMERIC(7, 2) CHECK (distance_km IS NULL OR distance_km BETWEEN 0 AND 1000),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source = 'manual'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_logs_owner_date_idx
  ON activity_logs (owner_id, activity_date, created_at);

CREATE TABLE IF NOT EXISTS sleep_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  sleep_date DATE NOT NULL,
  bedtime TIME NOT NULL,
  wake_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 1 AND 1440),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source = 'manual'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sleep_logs_owner_date_idx
  ON sleep_logs (owner_id, sleep_date, created_at);
