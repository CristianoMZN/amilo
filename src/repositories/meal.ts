import type { DbConnection } from '../database/connection';
import type { Meal, MealItem, MealTypeId, SupportedLocale } from 'src/domain/types';
import { listItemsByMeal } from './mealItem';
import { findMealTypeTranslation } from './mealType';
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

interface MealRow {
  id: number;
  ref_date: string;
  meal_type_id: string;
  custom_name: string | null;
  position: number;
  created_at: string;
}

function rowToMeal(row: MealRow): Meal {
  return {
    id: row.id,
    refDate: row.ref_date,
    mealTypeId: row.meal_type_id as MealTypeId,
    customName: row.custom_name,
    position: row.position,
    createdAt: row.created_at,
  };
}

export interface MealWithItems {
  meal: Meal;
  items: MealItem[];
  typeName: string;
}

/** All meals for a given local day, each carrying its items and slot name. */
export async function listMealsByDate(
  conn: DbConnection,
  refDate: string,
  locale: SupportedLocale,
): Promise<MealWithItems[]> {
  const meals = await query<MealRow>(
    conn,
    'SELECT * FROM meal WHERE ref_date = ? ORDER BY position ASC, id ASC',
    [refDate],
  );
  const out: MealWithItems[] = [];
  for (const m of meals) {
    const meal = rowToMeal(m);
    const items = await listItemsByMeal(conn, meal.id);
    let typeName = meal.customName ?? '';
    if (meal.mealTypeId !== 'custom') {
      const tr = await findMealTypeTranslation(conn, meal.mealTypeId, locale);
      typeName = tr?.name ?? typeName;
    }
    out.push({ meal, items, typeName });
  }
  return out;
}

export async function getMealById(
  conn: DbConnection,
  id: number,
  locale: SupportedLocale,
): Promise<MealWithItems | null> {
  const rows = await query<MealRow>(conn, 'SELECT * FROM meal WHERE id = ?', [id]);
  const row = rows[0];
  if (!row) return null;
  const meal = rowToMeal(row);
  const items = await listItemsByMeal(conn, meal.id);
  let typeName = meal.customName ?? '';
  if (meal.mealTypeId !== 'custom') {
    const tr = await findMealTypeTranslation(conn, meal.mealTypeId, locale);
    typeName = tr?.name ?? typeName;
  }
  return { meal, items, typeName };
}

/**
 * Idempotent: returns the existing `(ref_date, meal_type_id, custom_name)`
 * row if present, otherwise inserts it and returns the new row.
 *
 * The dev stub does not model `COLLATE NOCASE` / `LOWER(...)` predicates,
 * so this implementation matches `custom_name` exactly. The service layer
 * canonicalises custom-slot names before calling this, which keeps the
 * production behaviour (case-insensitive dedup) and the dev behaviour
 * (always inserts) consistent enough for the MVP — see Risk #6.
 */
export async function ensureMealForType(
  conn: DbConnection,
  args: { refDate: string; mealTypeId: MealTypeId; customName: string | null },
): Promise<Meal> {
  const rows = await query<MealRow>(
    conn,
    args.customName === null
      ? 'SELECT * FROM meal WHERE ref_date = ? AND meal_type_id = ? AND custom_name IS NULL ORDER BY id ASC'
      : 'SELECT * FROM meal WHERE ref_date = ? AND meal_type_id = ? AND custom_name = ? ORDER BY id ASC',
    args.customName === null
      ? [args.refDate, args.mealTypeId]
      : [args.refDate, args.mealTypeId, args.customName],
  );
  const existing = rows[0];
  if (existing) return rowToMeal(existing);

  const created = nowIso();
  // Next position is the current max + 1 for this ref_date; fallback 0.
  const maxRows = await query<{ max_pos: number | null }>(
    conn,
    'SELECT MAX(position) AS max_pos FROM meal WHERE ref_date = ?',
    [args.refDate],
  );
  const nextPosition = (maxRows[0]?.max_pos ?? -1) + 1;
  await exec(
    conn,
    `INSERT INTO meal (ref_date, meal_type_id, custom_name, position, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [args.refDate, args.mealTypeId, args.customName, nextPosition, created],
  );
  // The dev stub's autoincrement gives a fresh MAX(id); the native engine
  // exposes lastInsertRowid. Either way `ORDER BY id DESC` + take first is
  // safe because no other writer is racing us (single-process app).
  const inserted = await query<MealRow>(conn, 'SELECT * FROM meal ORDER BY id DESC');
  const insertedRow = inserted[0];
  if (!insertedRow) throw new Error('ensureMealForType: insert failed');
  return rowToMeal(insertedRow);
}

export async function renameMeal(
  conn: DbConnection,
  id: number,
  customName: string | null,
): Promise<void> {
  await exec(conn, 'UPDATE meal SET custom_name = ? WHERE id = ?', [customName, id]);
}

export async function deleteMeal(conn: DbConnection, id: number): Promise<void> {
  await exec(conn, 'DELETE FROM meal WHERE id = ?', [id]);
}
