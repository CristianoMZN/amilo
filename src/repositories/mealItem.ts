import type { DbConnection } from '../database/connection';
import type { FoodBaseUnit, MealItem, SupportedLocale } from 'src/domain/types';
import { nowIso } from 'src/util/dateDay';

async function query<T>(conn: DbConnection, sql: string, params: unknown[] = []): Promise<T[]> {
  const db = (await conn.getDb()) as {
    query: (sql: string, params?: unknown[]) => Promise<{ values?: T[]; rows?: { _array?: T[] } }>;
  };
  const result = await db.query(sql, params);
  return result.values ?? result.rows?._array ?? [];
}

async function exec(conn: DbConnection, sql: string, params: unknown[] = []): Promise<void> {
  const db = (await conn.getDb()) as {
    execute: (sql: string, params?: unknown[]) => Promise<unknown>;
  };
  await db.execute(sql, params);
}

interface MealItemRow {
  id: number;
  meal_id: number;
  position: number;
  food_id: string | null;
  food_name_snapshot: string;
  amount_g: number;
  unit: FoodBaseUnit;
  kcal_snapshot: number;
  protein_g_snapshot: number;
  carbs_g_snapshot: number;
  fat_g_snapshot: number;
  fiber_g_snapshot: number | null;
  created_at: string;
}

function rowToItem(row: MealItemRow): MealItem {
  return {
    id: row.id,
    mealId: row.meal_id,
    position: row.position,
    foodId: row.food_id,
    foodNameSnapshot: row.food_name_snapshot,
    amountG: row.amount_g,
    unit: row.unit,
    kcalSnapshot: row.kcal_snapshot,
    proteinGSnapshot: row.protein_g_snapshot,
    carbsGSnapshot: row.carbs_g_snapshot,
    fatGSnapshot: row.fat_g_snapshot,
    fiberGSnapshot: row.fiber_g_snapshot,
    createdAt: row.created_at,
  };
}

export async function listItemsByMeal(conn: DbConnection, mealId: number): Promise<MealItem[]> {
  const rows = await query<MealItemRow>(
    conn,
    'SELECT * FROM meal_item WHERE meal_id = ? ORDER BY position ASC',
    [mealId],
  );
  return rows.map(rowToItem);
}

/** Insert a meal item. Caller provides the snapshot values verbatim. */
export async function insertMealItem(
  conn: DbConnection,
  item: Omit<MealItem, 'id' | 'createdAt'> & { createdAt?: string },
): Promise<MealItem> {
  const created = item.createdAt ?? nowIso();
  await exec(
    conn,
    `INSERT INTO meal_item
       (meal_id, position, food_id, food_name_snapshot, amount_g, unit,
        kcal_snapshot, protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot, fiber_g_snapshot, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.mealId,
      item.position,
      item.foodId,
      item.foodNameSnapshot,
      item.amountG,
      item.unit,
      item.kcalSnapshot,
      item.proteinGSnapshot,
      item.carbsGSnapshot,
      item.fatGSnapshot,
      item.fiberGSnapshot,
      created,
    ],
  );
  const rows = await query<{ id: number }>(conn, 'SELECT MAX(id) AS id FROM meal_item');
  const id = rows[0]?.id ?? 0;
  return { ...item, id, createdAt: created };
}

/**
 * Replace the snapshot + amount of an item in one statement. The service
 * layer re-derives the snapshot via `domain.nutrition.createSnapshot(food,
 * name, amount)` before calling this — repositories never construct
 * snapshots directly.
 */
export async function updateMealItem(conn: DbConnection, item: MealItem): Promise<void> {
  await exec(
    conn,
    `UPDATE meal_item SET
       position = ?,
       food_id = ?,
       food_name_snapshot = ?,
       amount_g = ?,
       unit = ?,
       kcal_snapshot = ?,
       protein_g_snapshot = ?,
       carbs_g_snapshot = ?,
       fat_g_snapshot = ?,
       fiber_g_snapshot = ?
     WHERE id = ?`,
    [
      item.position,
      item.foodId,
      item.foodNameSnapshot,
      item.amountG,
      item.unit,
      item.kcalSnapshot,
      item.proteinGSnapshot,
      item.carbsGSnapshot,
      item.fatGSnapshot,
      item.fiberGSnapshot,
      item.id,
    ],
  );
}

export async function deleteMealItem(conn: DbConnection, id: number): Promise<void> {
  await exec(conn, 'DELETE FROM meal_item WHERE id = ?', [id]);
}

/**
 * Most-recent distinct `food_id`s in `meal_item`, ordered by `created_at` DESC.
 * The dev stub does not support `DISTINCT`/`GROUP BY`, so we deduplicate in JS
 * after pulling every matching row. `locale` is accepted for service-contract
 * symmetry and reserved for future filtering by translation availability; the
 * current implementation does not use it.
 */
export async function listRecentFoodIdsByDate(
  conn: DbConnection,
  args: { sinceIso?: string; locale: SupportedLocale; limit?: number },
): Promise<string[]> {
  void args.locale;
  const params: unknown[] = [];
  let where = '';
  if (args.sinceIso) {
    where = 'WHERE created_at >= ?';
    params.push(args.sinceIso);
  }
  const rows = await query<{ food_id: string | null; created_at: string }>(
    conn,
    `SELECT food_id, created_at FROM meal_item ${where} ORDER BY created_at DESC`,
    params,
  );
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    if (r.food_id === null) continue;
    if (seen.has(r.food_id)) continue;
    seen.add(r.food_id);
    out.push(r.food_id);
    if (args.limit && out.length >= args.limit) break;
  }
  return out;
}
