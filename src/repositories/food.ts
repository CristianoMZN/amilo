// Food row CRUD. Foods are identified by stable string slugs so the seed
// catalog can be incrementally updated without depending on autoincrement
// ids. The repo keeps `insertFood` (upsert-by-id) and `updateFood` as
// separate operations so the service can choose the right semantics.

import type { DbConnection } from '../database/connection';
import type { Food, FoodOrigin, SupportedLocale } from 'src/domain/types';
import { nowIso } from 'src/util/dateDay';
import { normalizeForSearch } from 'src/util/search';

// Re-export the translation CRUD so callers can import everything from
// `./food`. The implementation lives in `./foodTranslation.ts`.
export {
  findFoodTranslation,
  findAnyTranslation,
  listTranslationsForFood,
  upsertFoodTranslation,
} from './foodTranslation';

async function query<T>(
  conn: DbConnection,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const db = (await conn.getDb()) as {
    query: (sql: string, params?: unknown[]) => Promise<{ values?: T[]; rows?: { _array?: T[] } }>;
  };
  const result = await db.query(sql, params);
  return result.values ?? result.rows?._array ?? [];
}

async function exec(
  conn: DbConnection,
  sql: string,
  params: unknown[] = [],
): Promise<void> {
  const db = (await conn.getDb()) as {
    execute: (sql: string, params?: unknown[]) => Promise<unknown>;
  };
  await db.execute(sql, params);
}

interface FoodRow {
  id: string;
  origin: FoodOrigin;
  base_amount_g: number;
  base_unit: Food['baseUnit'];
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  created_at: string;
  updated_at: string;
}

interface FoodTranslationRow {
  food_id: string;
  locale: SupportedLocale;
  name: string;
}

function rowToFood(row: FoodRow): Food {
  return {
    id: row.id,
    origin: row.origin,
    baseAmountG: row.base_amount_g,
    baseUnit: row.base_unit,
    kcal: row.kcal,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    fiberG: row.fiber_g,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findFoodById(
  conn: DbConnection,
  id: string,
): Promise<Food | null> {
  const rows = await query<FoodRow>(conn, 'SELECT * FROM food WHERE id = ?', [id]);
  const row = rows[0];
  return row ? rowToFood(row) : null;
}

export async function listAllOfficialFoodIds(conn: DbConnection): Promise<string[]> {
  const rows = await query<{ id: string }>(
    conn,
    "SELECT id FROM food WHERE origin = 'official' ORDER BY id ASC",
  );
  return rows.map((r) => r.id);
}

export async function listOfficialFoods(
  conn: DbConnection,
  locale: SupportedLocale,
): Promise<Array<Food & { name: string }>> {
  return listFoodsWithNames(conn, 'official', locale);
}

export async function listCustomFoods(
  conn: DbConnection,
  locale: SupportedLocale,
): Promise<Array<Food & { name: string }>> {
  return listFoodsWithNames(conn, 'custom', locale);
}

async function listFoodsWithNames(
  conn: DbConnection,
  origin: FoodOrigin,
  locale: SupportedLocale,
): Promise<Array<Food & { name: string }>> {
  const foods = await listFoods(conn, { origin });
  if (foods.length === 0) return [];
  // Two-step: fetch the locale-specific translations separately. The dev
  // stub does not support JOIN, so the two-step shape is the same as the
  // native engine would use if it wanted explicit control over the order.
  const translations = await query<FoodTranslationRow>(
    conn,
    'SELECT food_id, name FROM food_translation WHERE locale = ? ORDER BY food_id ASC',
    [locale],
  );
  const nameById = new Map(translations.map((t) => [t.food_id, t.name]));
  return foods.map((f) => ({ ...f, name: nameById.get(f.id) ?? '' }));
}

export async function listFoods(
  conn: DbConnection,
  opts: { origin: FoodOrigin },
): Promise<Food[]> {
  const rows = await query<FoodRow>(
    conn,
    'SELECT * FROM food WHERE origin = ? ORDER BY id ASC',
    [opts.origin],
  );
  return rows.map(rowToFood);
}

export async function searchFoods(
  conn: DbConnection,
  opts: {
    locale: SupportedLocale;
    query: string;
    origin?: FoodOrigin;
    limit?: number;
  },
): Promise<Array<Food & { name: string }>> {
  const normalized = normalizeForSearch(opts.query);
  if (normalized.length === 0) return [];
  const pattern = `%${normalized}%`;

  // Step 1: collect matching translations by (locale, search LIKE).
  const translations = await query<FoodTranslationRow>(
    conn,
    'SELECT food_id, name FROM food_translation WHERE locale = ? AND search LIKE ? ORDER BY food_id ASC',
    [opts.locale, pattern],
  );
  if (translations.length === 0) return [];

  // Step 2: optional origin filter — fetch the candidate ids and intersect.
  let allowedIds: Set<string> | null = null;
  if (opts.origin) {
    const ids = await query<{ id: string }>(
      conn,
      'SELECT id FROM food WHERE origin = ? ORDER BY id ASC',
      [opts.origin],
    );
    allowedIds = new Set(ids.map((r) => r.id));
  }

  const filtered = allowedIds
    ? translations.filter((t) => allowedIds?.has(t.food_id) ?? false)
    : translations;
  if (filtered.length === 0) return [];

  // Step 3: pair each translation with its food row. The stub can't do
  // JOIN, so we fetch the food rows once and build a map.
  const foodRows = await query<FoodRow>(conn, 'SELECT * FROM food ORDER BY id ASC');
  const foodById = new Map(foodRows.map((r) => [r.id, rowToFood(r)]));

  const result: Array<Food & { name: string }> = [];
  for (const t of filtered) {
    const food = foodById.get(t.food_id);
    if (food) {
      result.push({ ...food, name: t.name });
    }
  }

  // The dev stub does not support LIMIT. The native engine enforces the
  // cap; the stub returns every match. The caller can still apply a
  // best-effort in-code slice so behaviour stays predictable.
  return opts.limit ? result.slice(0, opts.limit) : result;
}

export async function insertFood(conn: DbConnection, food: Food): Promise<Food> {
  // The dev stub does not model `INSERT ... ON CONFLICT(id) DO UPDATE`.
  // The native engine handles this correctly; the stub will silently no-op
  // the statement. The seed in `src/seed/` uses `INSERT OR IGNORE` so the
  // dev workflow can populate the catalog.
  const now = nowIso();
  await exec(
    conn,
    `INSERT INTO food
       (id, origin, base_amount_g, base_unit, kcal, protein_g, carbs_g, fat_g, fiber_g, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       origin = excluded.origin,
       base_amount_g = excluded.base_amount_g,
       base_unit = excluded.base_unit,
       kcal = excluded.kcal,
       protein_g = excluded.protein_g,
       carbs_g = excluded.carbs_g,
       fat_g = excluded.fat_g,
       fiber_g = excluded.fiber_g,
       updated_at = excluded.updated_at`,
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
      food.createdAt ?? now,
      now,
    ],
  );
  return { ...food, updatedAt: now };
}

export async function updateFood(conn: DbConnection, food: Food): Promise<void> {
  const now = nowIso();
  await exec(
    conn,
    `UPDATE food SET
       origin = ?,
       base_amount_g = ?,
       base_unit = ?,
       kcal = ?,
       protein_g = ?,
       carbs_g = ?,
       fat_g = ?,
       fiber_g = ?,
       updated_at = ?
     WHERE id = ?`,
    [
      food.origin,
      food.baseAmountG,
      food.baseUnit,
      food.kcal,
      food.proteinG,
      food.carbsG,
      food.fatG,
      food.fiberG,
      now,
      food.id,
    ],
  );
}

export async function deleteFood(conn: DbConnection, id: string): Promise<void> {
  // Dangling FK cleanup: sever the loose food_id → NULL reference in
  // meal_item before deleting the food row. The DB-level FK is
  // intentionally non-cascading for meal_item.food_id; the stub mirrors
  // the loose behaviour. Without this pass, historical rows would still
  // resolve via the snapshot name but the dangling FK would leak storage
  // and confuse importers.
  await exec(conn, 'UPDATE meal_item SET food_id = NULL WHERE food_id = ?', [id]);
  await exec(conn, 'DELETE FROM food WHERE id = ?', [id]);
}
