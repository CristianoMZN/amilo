-- Migration 002 — Nutrition: foods, meals, favorites, saved meals, targets.
--
-- Sprint 2 introduces the food log. Foods are identified by *stable string
-- slugs* (e.g. 'food:rice_white') so the seed catalog can be versioned and
-- incrementally updated without depending on autoincrement ids.
--
-- A meal is a single meal-instance on a single local day (breakfast, lunch,
-- etc. or a user-defined slot). Items inside a meal keep a full *nutritional
-- snapshot* so historical entries stay immune to corrections or deletions of
-- the underlying food.

-- ---- Foods ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS food (
  id              TEXT    PRIMARY KEY,                          -- e.g. 'food:rice_white'
  origin          TEXT    NOT NULL CHECK (origin IN ('official', 'custom')),
  base_amount_g   REAL    NOT NULL CHECK (base_amount_g > 0),
  base_unit       TEXT    NOT NULL CHECK (base_unit IN ('g', 'ml')),
  kcal            REAL    NOT NULL CHECK (kcal >= 0),
  protein_g       REAL    NOT NULL CHECK (protein_g >= 0),
  carbs_g         REAL    NOT NULL CHECK (carbs_g >= 0),
  fat_g           REAL    NOT NULL CHECK (fat_g >= 0),
  fiber_g         REAL,                                          -- nullable: optional
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_food_origin ON food (origin);

-- Localized name + a diacritic-insensitive, case-insensitive search blob
-- per locale. Custom foods have exactly one row in the user's current
-- locale; official foods have rows for every supported locale.
CREATE TABLE IF NOT EXISTS food_translation (
  food_id    TEXT NOT NULL,
  locale     TEXT NOT NULL,
  name       TEXT NOT NULL,
  search     TEXT NOT NULL,
  PRIMARY KEY (food_id, locale),
  FOREIGN KEY (food_id) REFERENCES food (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_food_translation_locale ON food_translation (locale);

-- ---- Meal types ----------------------------------------------------------
-- Five built-in slots (breakfast / lunch / snack / dinner / supper) plus
-- the synthetic 'custom' id used when the user-defined slot carries a
-- meal.custom_name.

CREATE TABLE IF NOT EXISTS meal_type (
  id              TEXT    PRIMARY KEY,
  sort_order      INTEGER NOT NULL,
  builtin         INTEGER NOT NULL CHECK (builtin IN (0, 1))
);

CREATE TABLE IF NOT EXISTS meal_type_translation (
  meal_type_id    TEXT NOT NULL,
  locale          TEXT NOT NULL,
  name            TEXT NOT NULL,
  PRIMARY KEY (meal_type_id, locale),
  FOREIGN KEY (meal_type_id) REFERENCES meal_type (id) ON DELETE CASCADE
);

-- ---- Daily meals ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS meal (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_date        TEXT    NOT NULL,                              -- local YYYY-MM-DD
  meal_type_id    TEXT    NOT NULL,
  custom_name     TEXT,
  position        INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL,
  FOREIGN KEY (meal_type_id) REFERENCES meal_type (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_meal_ref_date ON meal (ref_date);
CREATE INDEX IF NOT EXISTS idx_meal_ref_date_type ON meal (ref_date, meal_type_id);

-- ---- Meal items (with snapshot) ------------------------------------------

CREATE TABLE IF NOT EXISTS meal_item (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  meal_id             INTEGER NOT NULL,
  position            INTEGER NOT NULL DEFAULT 0,
  food_id             TEXT,                                       -- nullable after food deletion
  food_name_snapshot  TEXT    NOT NULL,
  amount_g            REAL    NOT NULL CHECK (amount_g > 0),
  unit                TEXT    NOT NULL DEFAULT 'g' CHECK (unit IN ('g', 'ml')),
  kcal_snapshot       REAL    NOT NULL CHECK (kcal_snapshot >= 0),
  protein_g_snapshot  REAL    NOT NULL CHECK (protein_g_snapshot >= 0),
  carbs_g_snapshot    REAL    NOT NULL CHECK (carbs_g_snapshot >= 0),
  fat_g_snapshot      REAL    NOT NULL CHECK (fat_g_snapshot >= 0),
  fiber_g_snapshot    REAL,
  created_at          TEXT    NOT NULL,
  FOREIGN KEY (meal_id) REFERENCES meal (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meal_item_meal ON meal_item (meal_id);

-- ---- Favorites -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS food_favorite (
  food_id     TEXT    PRIMARY KEY,
  created_at  TEXT    NOT NULL,
  FOREIGN KEY (food_id) REFERENCES food (id) ON DELETE CASCADE
);

-- ---- Saved meals ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS saved_meal (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,
  locale       TEXT    NOT NULL,
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS saved_meal_item (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  saved_meal_id       INTEGER NOT NULL,
  position            INTEGER NOT NULL DEFAULT 0,
  food_id             TEXT,
  food_name_snapshot  TEXT    NOT NULL,
  amount_g            REAL    NOT NULL CHECK (amount_g > 0),
  unit                TEXT    NOT NULL DEFAULT 'g' CHECK (unit IN ('g', 'ml')),
  kcal_snapshot       REAL    NOT NULL CHECK (kcal_snapshot >= 0),
  protein_g_snapshot  REAL    NOT NULL CHECK (protein_g_snapshot >= 0),
  carbs_g_snapshot    REAL    NOT NULL CHECK (carbs_g_snapshot >= 0),
  fat_g_snapshot      REAL    NOT NULL CHECK (fat_g_snapshot >= 0),
  fiber_g_snapshot    REAL,
  created_at          TEXT    NOT NULL,
  FOREIGN KEY (saved_meal_id) REFERENCES saved_meal (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_saved_meal_item_meal ON saved_meal_item (saved_meal_id);

-- ---- Nutrition targets (singleton) ---------------------------------------

CREATE TABLE IF NOT EXISTS nutrition_targets (
  id                INTEGER PRIMARY KEY CHECK (id = 1),
  kcal_target       REAL    NOT NULL CHECK (kcal_target > 0),
  protein_g_target  REAL    NOT NULL CHECK (protein_g_target >= 0),
  carbs_g_target    REAL    NOT NULL CHECK (carbs_g_target >= 0),
  fat_g_target      REAL    NOT NULL CHECK (fat_g_target >= 0),
  updated_at        TEXT    NOT NULL
);
