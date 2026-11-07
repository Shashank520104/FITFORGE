0CREATE TABLE IF NOT EXISTS user_profiles (
  owner_id UUID PRIMARY KEY,
  display_name TEXT CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 1 AND 80),
  units TEXT NOT NULL DEFAULT 'metric' CHECK (units IN ('metric', 'imperial')),
  training_goal TEXT CHECK (training_goal IS NULL OR training_goal IN (
    'muscle_gain', 'fat_loss', 'powerlifting', 'athletic_performance', 'general_fitness'
  )),
  experience_level TEXT CHECK (experience_level IS NULL OR experience_level IN (
    'beginner', 'intermediate', 'advanced'
  )),
  equipment TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  dietary_preferences TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (cardinality(equipment) <= 5),
  CHECK (cardinality(dietary_preferences) <= 7),
  CHECK (equipment <@ ARRAY['bodyweight', 'dumbbell', 'barbell', 'machine', 'band']::TEXT[]),
  CHECK (dietary_preferences <@ ARRAY[
    'vegetarian', 'vegan', 'pescatarian', 'halal', 'kosher', 'gluten_free', 'dairy_free'
  ]::TEXT[])
);
