CREATE TABLE IF NOT EXISTS foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  brand TEXT CHECK (brand IS NULL OR char_length(brand) <= 120),
  serving_unit TEXT NOT NULL CHECK (serving_unit IN ('g', 'ml')),
  calories_per_100 NUMERIC(8, 2) NOT NULL CHECK (calories_per_100 BETWEEN 0 AND 1000),
  protein_per_100 NUMERIC(8, 2) NOT NULL CHECK (protein_per_100 BETWEEN 0 AND 100),
  carbohydrates_per_100 NUMERIC(8, 2) NOT NULL CHECK (carbohydrates_per_100 BETWEEN 0 AND 100),
  fat_per_100 NUMERIC(8, 2) NOT NULL CHECK (fat_per_100 BETWEEN 0 AND 100),
  fiber_per_100 NUMERIC(8, 2) NOT NULL CHECK (fiber_per_100 BETWEEN 0 AND 100),
  sodium_mg_per_100 NUMERIC(8, 2) NOT NULL CHECK (sodium_mg_per_100 BETWEEN 0 AND 100000),
  source_label TEXT NOT NULL CHECK (char_length(source_label) BETWEEN 1 AND 200),
  source_url TEXT CHECK (source_url IS NULL OR char_length(source_url) <= 2048),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id)
);

CREATE INDEX IF NOT EXISTS foods_owner_name_idx
  ON foods (owner_id, lower(name));

CREATE TABLE IF NOT EXISTS meal_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  log_date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id)
);

CREATE INDEX IF NOT EXISTS meal_logs_owner_date_idx
  ON meal_logs (owner_id, log_date, meal_type);

CREATE TABLE IF NOT EXISTS meal_log_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id UUID NOT NULL REFERENCES meal_logs(id) ON DELETE CASCADE,
  food_id UUID NOT NULL,
  food_name_snapshot TEXT NOT NULL,
  serving_unit TEXT NOT NULL CHECK (serving_unit IN ('g', 'ml')),
  serving_amount NUMERIC(8, 2) NOT NULL CHECK (serving_amount BETWEEN 0.1 AND 10000),
  calories NUMERIC(10, 2) NOT NULL CHECK (calories >= 0),
  protein_g NUMERIC(10, 2) NOT NULL CHECK (protein_g >= 0),
  carbohydrates_g NUMERIC(10, 2) NOT NULL CHECK (carbohydrates_g >= 0),
  fat_g NUMERIC(10, 2) NOT NULL CHECK (fat_g >= 0),
  fiber_g NUMERIC(10, 2) NOT NULL CHECK (fiber_g >= 0),
  sodium_mg NUMERIC(10, 2) NOT NULL CHECK (sodium_mg >= 0),
  source_label_snapshot TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meal_log_items_log_id_idx
  ON meal_log_items (log_id);
