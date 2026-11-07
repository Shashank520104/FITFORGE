CREATE TABLE IF NOT EXISTS wellness_profiles (
  owner_id UUID PRIMARY KEY,
  height_cm NUMERIC(5, 1) NOT NULL CHECK (height_cm BETWEEN 100 AND 250),
  weight_kg NUMERIC(5, 1) NOT NULL CHECK (weight_kg BETWEEN 30 AND 350),
  diet_preference TEXT NOT NULL CHECK (diet_preference IN ('vegetarian', 'non_vegetarian', 'vegan')),
  experience_level TEXT NOT NULL CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  exercise_cleared BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS health_reports (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL,
  filename TEXT NOT NULL CHECK (char_length(filename) BETWEEN 1 AND 120),
  media_type TEXT NOT NULL CHECK (media_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  file_size INTEGER NOT NULL CHECK (file_size BETWEEN 1 AND 8388608),
  encrypted_content BYTEA NOT NULL,
  initialization_vector BYTEA NOT NULL,
  authentication_tag BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS health_reports_owner_created_idx
  ON health_reports (owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS personalized_plans (
  owner_id UUID PRIMARY KEY,
  plan JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
