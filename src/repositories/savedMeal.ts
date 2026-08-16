import type { DbConnection } from '../database/connection';
import type { SavedMeal, SavedMealItem, SupportedLocale } from 'src/domain/types';
import {
  insertSavedMealItem,
  listSavedMealItems,
} from './savedMealItem';
import { nowIso } from 'src/util/dateDay';

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

interface SavedMealRow {
  id: number;
  name: string;
  locale: string;
  created_at: string;
  updated_at: string;
}

function rowToSavedMeal(row: SavedMealRow): SavedMeal {
  return {
    id: row.id,
    name: row.name,
    locale: row.locale as SupportedLocale,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface SavedMealWithCount extends SavedMeal {
  itemCount: number;
}

/** List all saved meals with item counts, newest first. */
export async function listSavedMeals(
  conn: DbConnection,
  locale: SupportedLocale,
): Promise<SavedMealWithCount[]> {
  void locale;
  const rows = await query<SavedMealRow>(
    conn,
    'SELECT * FROM saved_meal ORDER BY updated_at DESC',
  );
  const out: SavedMealWithCount[] = [];
  for (const r of rows) {
    const sm = rowToSavedMeal(r);
    const items = await listSavedMealItems(conn, sm.id);
    out.push({ ...sm, itemCount: items.length });
  }
  return out;
}

export async function getSavedMealWithItems(
  conn: DbConnection,
  id: number,
  locale: SupportedLocale,
): Promise<{ savedMeal: SavedMeal; items: SavedMealItem[] } | null> {
  void locale;
  const rows = await query<SavedMealRow>(
    conn,
    'SELECT * FROM saved_meal WHERE id = ?',
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  const savedMeal = rowToSavedMeal(row);
  const items = await listSavedMealItems(conn, id);
  return { savedMeal, items };
}

export interface CreateSavedMealInput {
  name: string;
  locale: SupportedLocale;
  items: ReadonlyArray<
    Omit<SavedMealItem, 'id' | 'savedMealId' | 'createdAt'>
  >;
}

export async function createSavedMeal(
  conn: DbConnection,
  args: CreateSavedMealInput,
): Promise<SavedMeal> {
  const now = nowIso();
  await exec(
    conn,
    `INSERT INTO saved_meal (name, locale, created_at, updated_at)
     VALUES (?, ?, ?, ?)`,
    [args.name, args.locale, now, now],
  );
  const rows = await query<SavedMealRow>(
    conn,
    'SELECT * FROM saved_meal ORDER BY id DESC',
  );
  const head = rows[0];
  if (!head) throw new Error('createSavedMeal: insert failed');
  const savedMeal = rowToSavedMeal(head);
  for (let i = 0; i < args.items.length; i++) {
    const item = args.items[i];
    if (!item) continue;
    await insertSavedMealItem(conn, { ...item, savedMealId: savedMeal.id, position: i });
  }
  return savedMeal;
}

export async function renameSavedMeal(
  conn: DbConnection,
  id: number,
  name: string,
): Promise<void> {
  await exec(
    conn,
    'UPDATE saved_meal SET name = ?, updated_at = ? WHERE id = ?',
    [name, nowIso(), id],
  );
}

export async function deleteSavedMeal(
  conn: DbConnection,
  id: number,
): Promise<void> {
  await exec(conn, 'DELETE FROM saved_meal WHERE id = ?', [id]);
}
