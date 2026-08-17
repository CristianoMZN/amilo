import type { DbConnection } from '../database/connection';
import type { SavedMealItem } from 'src/domain/types';
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

interface SavedMealItemRow {
  id: number;
  saved_meal_id: number;
  position: number;
  food_id: string | null;
  food_name_snapshot: string;
  amount_g: number;
  unit: 'g' | 'ml';
  kcal_snapshot: number;
  protein_g_snapshot: number;
  carbs_g_snapshot: number;
  fat_g_snapshot: number;
  fiber_g_snapshot: number | null;
  created_at: string;
}

function rowToItem(row: SavedMealItemRow): SavedMealItem {
  return {
    id: row.id,
    savedMealId: row.saved_meal_id,
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

export async function listSavedMealItems(
  conn: DbConnection,
  savedMealId: number,
): Promise<SavedMealItem[]> {
  const rows = await query<SavedMealItemRow>(
    conn,
    'SELECT * FROM saved_meal_item WHERE saved_meal_id = ? ORDER BY position ASC',
    [savedMealId],
  );
  return rows.map(rowToItem);
}

export async function insertSavedMealItem(
  conn: DbConnection,
  item: Omit<SavedMealItem, 'id' | 'createdAt'> & { createdAt?: string },
): Promise<SavedMealItem> {
  const created = item.createdAt ?? nowIso();
  await exec(
    conn,
    `INSERT INTO saved_meal_item
       (saved_meal_id, position, food_id, food_name_snapshot, amount_g, unit,
        kcal_snapshot, protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot, fiber_g_snapshot, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.savedMealId,
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
  const rows = await query<{ id: number }>(
    conn,
    'SELECT MAX(id) AS id FROM saved_meal_item WHERE saved_meal_id = ?',
    [item.savedMealId],
  );
  return { ...item, id: rows[0]?.id ?? 0, createdAt: created };
}

export async function deleteSavedMealItem(conn: DbConnection, id: number): Promise<void> {
  await exec(conn, 'DELETE FROM saved_meal_item WHERE id = ?', [id]);
}
