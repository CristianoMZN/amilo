-- Migration 003 — Exercises, aerobic activities, workout sheets & performed workouts.
--
-- Sprint 3 brings the exercise domain on top of the existing user profile.
--
-- An *exercise* is a canonical movement (e.g. walking, barbell bench press)
-- identified by a stable string slug ('exercise:walking', 'exercise:user:<uuid>'
-- for custom ones). It is decoupled from any logged instance: every log row
-- (aerobic activity, planned exercise, performed exercise, performed set)
-- keeps a *snapshot* of the relevant display fields so history stays correct
-- even if the parent exercise is later edited or deleted.
--
-- A *workout sheet* is a reusable plan grouping one or more sessions
-- (e.g. "Push day"), each containing planned exercises with planned
-- sets/reps/weight. A *performed workout* is an actual execution captured
-- independently of the sheet — snapshots of the sheet/session names preserve
-- the historical label even if the plan is renamed or deleted.
--
-- Like the nutrition domain, locale-specific display names live in a side
-- table (exercise_translation) seeded with diacritic-insensitive search
-- blobs so the in-app catalog stays searchable across locales.

-- ---- Exercises ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS exercise (
  id              TEXT    PRIMARY KEY,                          -- e.g. 'exercise:walking', 'exercise:barbell_bench_press', 'exercise:user:<uuid>'
  origin          TEXT    NOT NULL CHECK (origin IN ('official', 'custom')),
  kind            TEXT    NOT NULL CHECK (kind IN ('aerobic', 'strength')),
  muscle_group    TEXT,                                          -- nullable; only meaningful for strength
  default_unit    TEXT    NOT NULL CHECK (default_unit IN ('kg', 'lb', 'bodyweight', 'none')),
  has_repetitions INTEGER NOT NULL CHECK (has_repetitions IN (0, 1)) DEFAULT 1,
  has_duration    INTEGER NOT NULL CHECK (has_duration IN (0, 1)) DEFAULT 0,
  notes           TEXT,
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exercise_origin ON exercise (origin);
CREATE INDEX IF NOT EXISTS idx_exercise_kind ON exercise (kind);
CREATE INDEX IF NOT EXISTS idx_exercise_muscle_group ON exercise (muscle_group);

-- Per-locale display name + diacritic-insensitive, case-insensitive search
-- blob. Official exercises have rows for every shipped locale; custom
-- exercises only have a row in the user's active locale.
CREATE TABLE IF NOT EXISTS exercise_translation (
  exercise_id  TEXT NOT NULL,
  locale       TEXT NOT NULL,
  name         TEXT NOT NULL,
  search       TEXT NOT NULL,
  PRIMARY KEY (exercise_id, locale),
  FOREIGN KEY (exercise_id) REFERENCES exercise (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_exercise_translation_locale ON exercise_translation (locale);

-- Per-aerobic-exercise kcal/hour estimate. Strength exercises do not get a row.
CREATE TABLE IF NOT EXISTS exercise_aerobic_meta (
  exercise_id     TEXT    NOT NULL,
  kcal_per_hour   REAL    NOT NULL CHECK (kcal_per_hour >= 0),
  PRIMARY KEY (exercise_id),
  FOREIGN KEY (exercise_id) REFERENCES exercise (id) ON DELETE CASCADE
);

-- ---- Aerobic activities ---------------------------------------------------
-- A logged aerobic session on a single local day. Snapshot fields preserve
-- the historical label + kcal/hour estimate so future edits to the parent
-- exercise never alter recorded history.

CREATE TABLE IF NOT EXISTS aerobic_activity (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_date                 TEXT    NOT NULL,                          -- local YYYY-MM-DD
  exercise_id              TEXT,                                       -- nullable after deletion of custom exercise
  exercise_name_snapshot   TEXT    NOT NULL,
  kcal_per_hour_snapshot   REAL    NOT NULL CHECK (kcal_per_hour_snapshot >= 0),
  duration_minutes         REAL    NOT NULL CHECK (duration_minutes > 0),
  kcal_estimated           REAL    NOT NULL CHECK (kcal_estimated >= 0),
  notes                    TEXT,
  created_at               TEXT    NOT NULL,
  FOREIGN KEY (exercise_id) REFERENCES exercise (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_aerobic_activity_ref_date ON aerobic_activity (ref_date);
CREATE INDEX IF NOT EXISTS idx_aerobic_activity_exercise ON aerobic_activity (exercise_id);

-- ---- Aerobic favorites ----------------------------------------------------
-- Reuses the pattern established by food_favorite: a single primary-keyed
-- row marks the exercise as a quick-pick in the catalog.

CREATE TABLE IF NOT EXISTS aerobic_favorite (
  exercise_id  TEXT    PRIMARY KEY,
  created_at   TEXT    NOT NULL,
  FOREIGN KEY (exercise_id) REFERENCES exercise (id) ON DELETE CASCADE
);

-- ---- Workout sheets (plans) -----------------------------------------------
-- A free-form plan grouping one or more sessions (no rigid A/B/C template).

CREATE TABLE IF NOT EXISTS workout_sheet (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL CHECK (length(trim(name)) > 0),
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workout_sheet_position ON workout_sheet (position);

-- A session/division inside a sheet (e.g. "Push", "Pull", "Legs").
CREATE TABLE IF NOT EXISTS workout_session (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sheet_id    INTEGER NOT NULL,
  name        TEXT    NOT NULL CHECK (length(trim(name)) > 0),
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL,
  FOREIGN KEY (sheet_id) REFERENCES workout_sheet (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workout_session_sheet ON workout_session (sheet_id, position);

-- ---- Planned exercises (inside a session) ---------------------------------
-- Each planned exercise carries its planned sets/reps/weight and snapshots
-- the name + muscle_group so editing the canonical exercise later doesn't
-- silently rewrite the plan.

CREATE TABLE IF NOT EXISTS workout_planned_exercise (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id               INTEGER NOT NULL,
  exercise_id              TEXT,                                       -- nullable after deletion
  exercise_name_snapshot   TEXT    NOT NULL,
  muscle_group_snapshot    TEXT,                                       -- nullable
  position                 INTEGER NOT NULL DEFAULT 0,
  planned_sets             INTEGER NOT NULL DEFAULT 0 CHECK (planned_sets >= 0),
  planned_reps             INTEGER NOT NULL DEFAULT 0 CHECK (planned_reps >= 0),
  planned_weight_kg        REAL,                                       -- nullable
  notes                    TEXT,
  created_at               TEXT    NOT NULL,
  FOREIGN KEY (session_id) REFERENCES workout_session (id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercise (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_workout_planned_exercise_session ON workout_planned_exercise (session_id, position);

-- ---- Performed workouts ---------------------------------------------------
-- An actual workout execution. Decoupled from the sheet: even if the source
-- sheet is renamed or deleted, snapshots preserve the historical labels.

CREATE TABLE IF NOT EXISTS performed_workout (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_date               TEXT    NOT NULL,
  sheet_id               INTEGER,                                     -- nullable after deletion
  session_id             INTEGER,                                     -- nullable after deletion
  sheet_name_snapshot    TEXT    NOT NULL,
  session_name_snapshot  TEXT    NOT NULL,
  status                 TEXT    NOT NULL CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  started_at             TEXT    NOT NULL,
  finished_at            TEXT,                                         -- nullable while in_progress
  notes                  TEXT,
  created_at             TEXT    NOT NULL,
  updated_at             TEXT    NOT NULL,
  FOREIGN KEY (sheet_id) REFERENCES workout_sheet (id) ON DELETE SET NULL,
  FOREIGN KEY (session_id) REFERENCES workout_session (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_performed_workout_ref_date ON performed_workout (ref_date);
CREATE INDEX IF NOT EXISTS idx_performed_workout_status ON performed_workout (status);
CREATE INDEX IF NOT EXISTS idx_performed_workout_exercise_ref ON performed_workout (session_id, ref_date);

-- Exercise within a performed workout. Snapshots preserve name + muscle_group.
CREATE TABLE IF NOT EXISTS performed_workout_exercise (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  performed_workout_id     INTEGER NOT NULL,
  exercise_id              TEXT,                                       -- nullable after deletion
  exercise_name_snapshot   TEXT    NOT NULL,
  muscle_group_snapshot    TEXT,                                       -- nullable
  position                 INTEGER NOT NULL DEFAULT 0,
  created_at               TEXT    NOT NULL,
  FOREIGN KEY (performed_workout_id) REFERENCES performed_workout (id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercise (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_performed_workout_exercise_workout ON performed_workout_exercise (performed_workout_id, position);

-- Actual performed set (series). Weight is stored normalized to kilograms.
CREATE TABLE IF NOT EXISTS performed_workout_set (
  id                          INTEGER PRIMARY KEY AUTOINCREMENT,
  performed_exercise_id       INTEGER NOT NULL,
  position                    INTEGER NOT NULL DEFAULT 0,
  reps                        REAL    NOT NULL CHECK (reps >= 0),
  weight_kg                   REAL,                                       -- nullable for bodyweight/no-weight exercises
  completed                   INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  created_at                  TEXT    NOT NULL,
  FOREIGN KEY (performed_exercise_id) REFERENCES performed_workout_exercise (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_performed_workout_set_exercise ON performed_workout_set (performed_exercise_id, position);