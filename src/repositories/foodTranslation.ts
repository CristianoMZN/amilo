// Food translation CRUD. Each food has one row per locale it ships in;
// custom foods typically have a single row in the user's active locale.
//
// Search column: the `search` field is the canonicalised name (lowercased,
// NFKC, marks stripped, whitespace collapsed) so the dev stub and the
// native engine both produce the same match patterns.

import type { DbConnection } from '../database/connection';
import type { FoodTranslation, SupportedLocale } from 'src/domain/types';
import { normalizeForSearch } from 'src/util/search';

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

interface FoodTranslationRow {
  food_id: string;
  locale: string;
  name: string;
  search: string;
}

function rowToTranslation(row: FoodTranslationRow): FoodTranslation {
  return {
    foodId: row.food_id,
    locale: row.locale as SupportedLocale,
    name: row.name,
    search: row.search,
  };
}

export async function findFoodTranslation(
  conn: DbConnection,
  foodId: string,
  locale: SupportedLocale,
): Promise<FoodTranslation | null> {
  const rows = await query<FoodTranslationRow>(
    conn,
    'SELECT * FROM food_translation WHERE food_id = ? AND locale = ?',
    [foodId, locale],
  );
  const row = rows[0];
  return row ? rowToTranslation(row) : null;
}

export async function findAnyTranslation(
  conn: DbConnection,
  foodId: string,
): Promise<FoodTranslation | null> {
  const rows = await query<FoodTranslationRow>(
    conn,
    'SELECT * FROM food_translation WHERE food_id = ? ORDER BY locale ASC',
    [foodId],
  );
  const row = rows[0];
  return row ? rowToTranslation(row) : null;
}

export async function listTranslationsForFood(
  conn: DbConnection,
  foodId: string,
): Promise<FoodTranslation[]> {
  const rows = await query<FoodTranslationRow>(
    conn,
    'SELECT * FROM food_translation WHERE food_id = ? ORDER BY locale ASC',
    [foodId],
  );
  return rows.map(rowToTranslation);
}

export async function upsertFoodTranslation(
  conn: DbConnection,
  tr: FoodTranslation,
): Promise<void> {
  const search = tr.search.length > 0 ? tr.search : normalizeForSearch(tr.name);
  await exec(
    conn,
    `INSERT INTO food_translation (food_id, locale, name, search)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(food_id, locale) DO UPDATE SET
       name = excluded.name,
       search = excluded.search`,
    [tr.foodId, tr.locale, tr.name, search],
  );
}
