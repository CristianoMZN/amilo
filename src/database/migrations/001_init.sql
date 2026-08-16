-- Migration 001 — initial schema.
-- Sprint 1 brings the foundation tables for profile, preferences and weight
-- history. Future sprints will append tables (food, meals, exercises, etc.).

CREATE TABLE IF NOT EXISTS schema_version (
  version    INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_profile (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  name        TEXT    NOT NULL,
  birth_date  TEXT    NOT NULL, -- ISO YYYY-MM-DD
  sex         TEXT    NOT NULL CHECK (sex IN ('male', 'female')),
  height_cm   REAL    NOT NULL CHECK (height_cm > 0),
  weight_kg   REAL    NOT NULL CHECK (weight_kg > 0),
  activity    TEXT    NOT NULL CHECK (activity IN (
                'sedentary', 'lightly_active', 'moderately_active',
                'very_active', 'extremely_active'
              )),
  goal        TEXT    NOT NULL CHECK (goal IN ('lose', 'maintain', 'gain')),
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS user_preferences (
  id                     INTEGER PRIMARY KEY CHECK (id = 1),
  locale                 TEXT    NOT NULL,
  measurement_system     TEXT    NOT NULL CHECK (measurement_system IN ('metric', 'imperial')),
  theme                  TEXT    NOT NULL CHECK (theme IN ('system', 'light', 'dark')),
  onboarding_completed_at TEXT,
  updated_at             TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS weight_entry (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  weight_kg    REAL    NOT NULL CHECK (weight_kg > 0),
  recorded_at  TEXT    NOT NULL,
  source       TEXT    NOT NULL CHECK (source IN ('onboarding', 'manual', 'import'))
);

CREATE INDEX IF NOT EXISTS idx_weight_entry_recorded_at
  ON weight_entry (recorded_at DESC);