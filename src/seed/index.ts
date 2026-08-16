// Public entry point for the bundled catalog seed.
//
// `applySeed(conn)` is idempotent — it uses `INSERT OR IGNORE` against the
// natural primary keys so a re-run is a safe no-op once the catalog is in
// place. The boot layer wraps every call in `try`/`catch` so a failed seed
// never blocks app startup.

import type { DbConnection } from 'src/database/connection';
import type { SupportedLocale } from 'src/domain/types';
import { nowIso } from 'src/util/dateDay';
import { normalizeForSearch } from 'src/util/search';

import { OFFICIAL_FOODS, type OfficialFoodSeed } from './officialFoods';
import {
  OFFICIAL_MEAL_TYPES,
  OFFICIAL_MEAL_TYPE_TRANSLATIONS,
} from './officialMealTypes';

// ---------------------------------------------------------------------------
// Re-exports — keep the public catalog API in a single file for ergonomic
// imports across the app.
// ---------------------------------------------------------------------------

export type { OfficialFoodSeed };
export {
  OFFICIAL_FOODS,
  OFFICIAL_MEAL_TYPES,
  OFFICIAL_MEAL_TYPE_TRANSLATIONS,
};

// ---------------------------------------------------------------------------
// Seed runner
// ---------------------------------------------------------------------------

/** Locales, in canonical order — used to drive the translation INSERTs. */
const SUPPORTED_LOCALES: readonly SupportedLocale[] = [
  'en',
  'es',
  'pt-BR',
  'de',
  'fr',
  'ja',
  'ko',
  'it',
] as const;

interface NativeExecuteHandle {
  execute: (sql: string, params?: unknown[]) => Promise<unknown>;
}

async function exec(
  conn: DbConnection,
  sql: string,
  params: unknown[] = [],
): Promise<void> {
  const db = (await conn.getDb()) as NativeExecuteHandle;
  await db.execute(sql, params);
}

/**
 * Apply the bundled food and meal-type seed to the database. The function
 * is idempotent — every `INSERT` is `INSERT OR IGNORE`, keyed on the
 * natural primary key (`food.id`, `(food_id, locale)`, `meal_type.id`,
 * `(meal_type_id, locale)`), so calling it more than once is safe.
 *
 * Required table schema (created by migration 002_nutrition.sql):
 *   - food                       (PK: id)
 *   - food_translation           (PK: food_id, locale)
 *   - meal_type                  (PK: id)
 *   - meal_type_translation      (PK: meal_type_id, locale)
 *
 * The boot layer wraps this in `try`/`catch` so a failed seed never
 * prevents the app from starting.
 */
export async function applySeed(conn: DbConnection): Promise<void> {
  const now = nowIso();

  // --- 1. Meal types (parent rows) -------------------------------------
  // The schema stores `builtin` as INTEGER (0/1) but the domain uses
  // `boolean`; the conversion lives here so the domain types stay clean.
  for (const mt of OFFICIAL_MEAL_TYPES) {
    await exec(
      conn,
      `INSERT OR IGNORE INTO meal_type (id, sort_order, builtin) VALUES (?, ?, ?)`,
      [mt.id, mt.sortOrder, mt.builtin ? 1 : 0],
    );
  }

  // --- 2. Meal type translations ----------------------------------------
  for (const t of OFFICIAL_MEAL_TYPE_TRANSLATIONS) {
    await exec(
      conn,
      `INSERT OR IGNORE INTO meal_type_translation
         (meal_type_id, locale, name)
       VALUES (?, ?, ?)`,
      [t.mealTypeId, t.locale, t.name],
    );
  }

  // --- 3. Foods (parent rows) -------------------------------------------
  for (const seed of OFFICIAL_FOODS) {
    // Re-spell the row with the seed's timestamps. `createdAt` and
    // `updatedAt` are deliberately not part of `OfficialFoodSeed`; the
    // seed runner owns them so re-applying the seed on the same device
    // doesn't rewrite the original "first seen" timestamp.
    await exec(
      conn,
      `INSERT OR IGNORE INTO food
         (id, origin, base_amount_g, base_unit, kcal,
          protein_g, carbs_g, fat_g, fiber_g,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        seed.food.id,
        seed.food.origin,
        seed.food.baseAmountG,
        seed.food.baseUnit,
        seed.food.kcal,
        seed.food.proteinG,
        seed.food.carbsG,
        seed.food.fatG,
        seed.food.fiberG,
        now,
        now,
      ],
    );
  }

  // --- 4. Food translations ---------------------------------------------
  for (const seed of OFFICIAL_FOODS) {
    for (const locale of SUPPORTED_LOCALES) {
      const name = seed.translations[locale];
      await exec(
        conn,
        `INSERT OR IGNORE INTO food_translation
           (food_id, locale, name, search)
         VALUES (?, ?, ?, ?)`,
        [seed.food.id, locale, name, normalizeForSearch(name)],
      );
    }
  }
}
