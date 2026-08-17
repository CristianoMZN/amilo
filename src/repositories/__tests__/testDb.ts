// Shared test helpers for the repository layer.
//
// Drives a `FakeDbConnection` (in `fakeConnection.ts`) instead of the
// real `DevStubConnection`. The dev stub is documented to fail closed
// on JOIN/GROUP BY/LIMIT and to silently lose the user-provided `id`
// on tables where the first column is `id` (treating it as
// autoincrement). The fake connection honours the user's id and
// understands the `INSERT ... ON CONFLICT DO UPDATE` clause that the
// repos use for upserts.

import type { DbConnection } from 'src/database/connection';
import { FakeDbConnection } from './fakeConnection';

export interface TestDb {
  conn: DbConnection;
  /** Direct access to the in-memory row store for low-level assertions. */
  raw: FakeDbConnection;
  /** Execute a statement verbatim. */
  exec: (sql: string, params?: unknown[]) => Promise<void>;
  /** Read rows verbatim. */
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;
  close: () => Promise<void>;
}

export async function createTestDb(): Promise<TestDb> {
  const raw = new FakeDbConnection();
  await raw.open();
  const db = (await raw.getDb()) as {
    execute: (sql: string, params?: unknown[]) => Promise<unknown>;
    query: (sql: string, params?: unknown[]) => Promise<{ values?: unknown[] }>;
  };
  return {
    conn: raw,
    raw,
    exec: async (sql, params = []) => {
      await db.execute(sql, params);
    },
    query: async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
      const result = await db.query(sql, params);
      return (result.values ?? []) as T[];
    },
    close: () => raw.close(),
  };
}

// ---------------------------------------------------------------------------
// Seed helpers — insert rows directly via the fake connection. Tests then
// exercise the read paths of the repo on top of these seeds.
// ---------------------------------------------------------------------------

export interface SeedFood {
  id: string;
  origin: 'official' | 'custom';
  baseAmountG: number;
  baseUnit: 'g' | 'ml';
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  createdAt: string;
  updatedAt: string;
}

export async function insertFoodRow(db: TestDb, food: SeedFood): Promise<void> {
  await db.exec(
    `INSERT OR IGNORE INTO food
       (id, origin, base_amount_g, base_unit, kcal, protein_g, carbs_g, fat_g, fiber_g, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      food.id,
      food.origin,
      food.baseAmountG,
      food.baseUnit,
      food.kcal,
      food.proteinG,
      food.carbsG,
      food.fatG,
      food.fiberG,
      food.createdAt,
      food.updatedAt,
    ],
  );
}

export async function insertFoodTranslationRow(
  db: TestDb,
  foodId: string,
  locale: string,
  name: string,
  search: string,
): Promise<void> {
  await db.exec(
    `INSERT OR IGNORE INTO food_translation (food_id, locale, name, search)
     VALUES (?, ?, ?, ?)`,
    [foodId, locale, name, search],
  );
}

export async function insertFavoriteRow(
  db: TestDb,
  foodId: string,
  createdAt: string,
): Promise<void> {
  await db.exec(`INSERT OR IGNORE INTO food_favorite (food_id, created_at) VALUES (?, ?)`, [
    foodId,
    createdAt,
  ]);
}

export async function insertMealTypeRow(
  db: TestDb,
  id: string,
  sortOrder: number,
  builtin: boolean,
): Promise<void> {
  await db.exec(`INSERT OR IGNORE INTO meal_type (id, sort_order, builtin) VALUES (?, ?, ?)`, [
    id,
    sortOrder,
    builtin ? 1 : 0,
  ]);
}

export async function insertMealTypeTranslationRow(
  db: TestDb,
  mealTypeId: string,
  locale: string,
  name: string,
): Promise<void> {
  await db.exec(
    `INSERT OR IGNORE INTO meal_type_translation (meal_type_id, locale, name) VALUES (?, ?, ?)`,
    [mealTypeId, locale, name],
  );
}

export async function insertMealRow(
  db: TestDb,
  refDate: string,
  mealTypeId: string,
  customName: string | null,
  position: number,
  createdAt: string,
): Promise<number> {
  await db.exec(
    `INSERT INTO meal (ref_date, meal_type_id, custom_name, position, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [refDate, mealTypeId, customName, position, createdAt],
  );
  const rows = await db.query<{ id: number }>('SELECT MAX(id) AS id FROM meal');
  return rows[0]?.id ?? 0;
}

export async function insertMealItemRow(
  db: TestDb,
  mealId: number,
  foodId: string | null,
  foodNameSnapshot: string,
  amountG: number,
  unit: 'g' | 'ml',
  kcal: number,
  proteinG: number,
  carbsG: number,
  fatG: number,
  fiberG: number | null,
  position: number,
  createdAt: string,
): Promise<void> {
  await db.exec(
    `INSERT INTO meal_item
       (meal_id, position, food_id, food_name_snapshot, amount_g, unit,
        kcal_snapshot, protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
        fiber_g_snapshot, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      mealId,
      position,
      foodId,
      foodNameSnapshot,
      amountG,
      unit,
      kcal,
      proteinG,
      carbsG,
      fatG,
      fiberG,
      createdAt,
    ],
  );
}

export async function insertSavedMealRow(
  db: TestDb,
  name: string,
  locale: string,
  createdAt: string,
  updatedAt: string,
): Promise<number> {
  await db.exec(
    `INSERT INTO saved_meal (name, locale, created_at, updated_at) VALUES (?, ?, ?, ?)`,
    [name, locale, createdAt, updatedAt],
  );
  const rows = await db.query<{ id: number }>('SELECT MAX(id) AS id FROM saved_meal');
  return rows[0]?.id ?? 0;
}

export async function insertSavedMealItemRow(
  db: TestDb,
  savedMealId: number,
  foodId: string | null,
  foodNameSnapshot: string,
  amountG: number,
  unit: 'g' | 'ml',
  kcal: number,
  proteinG: number,
  carbsG: number,
  fatG: number,
  fiberG: number | null,
  position: number,
  createdAt: string,
): Promise<void> {
  await db.exec(
    `INSERT INTO saved_meal_item
       (saved_meal_id, position, food_id, food_name_snapshot, amount_g, unit,
        kcal_snapshot, protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
        fiber_g_snapshot, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      savedMealId,
      position,
      foodId,
      foodNameSnapshot,
      amountG,
      unit,
      kcal,
      proteinG,
      carbsG,
      fatG,
      fiberG,
      createdAt,
    ],
  );
}

export async function insertNutritionTargetsRow(
  db: TestDb,
  kcalTarget: number,
  proteinG: number,
  carbsG: number,
  fatG: number,
  updatedAt: string,
): Promise<void> {
  await db.exec(
    `INSERT OR IGNORE INTO nutrition_targets
       (id, kcal_target, protein_g_target, carbs_g_target, fat_g_target, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [1, kcalTarget, proteinG, carbsG, fatG, updatedAt],
  );
}
