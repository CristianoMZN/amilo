import type { DbConnection } from '../database/connection';
import type { Food, SupportedLocale } from 'src/domain/types';
import { findFoodById } from './food';
import { findAnyTranslation, findFoodTranslation } from './foodTranslation';

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

interface FavoriteRow {
  food_id: string;
  created_at: string;
}

/** All favorited food ids, newest first. */
export async function listFavoriteFoodIds(conn: DbConnection): Promise<string[]> {
  const rows = await query<FavoriteRow>(
    conn,
    'SELECT food_id FROM food_favorite ORDER BY created_at DESC',
  );
  return rows.map((r) => r.food_id);
}

export async function isFavorite(conn: DbConnection, foodId: string): Promise<boolean> {
  const rows = await query<FavoriteRow>(
    conn,
    'SELECT food_id FROM food_favorite WHERE food_id = ?',
    [foodId],
  );
  return rows.length > 0;
}

/** Idempotent insert. PK conflict is silently ignored. */
export async function addFavorite(conn: DbConnection, foodId: string): Promise<void> {
  await exec(conn, 'INSERT OR IGNORE INTO food_favorite (food_id, created_at) VALUES (?, ?)', [
    foodId,
    new Date().toISOString(),
  ]);
}

export async function removeFavorite(conn: DbConnection, foodId: string): Promise<void> {
  await exec(conn, 'DELETE FROM food_favorite WHERE food_id = ?', [foodId]);
}

/** Locale-aware list used by the Favorites tab in the add-food sheet. */
export async function listFavoriteFoods(
  conn: DbConnection,
  locale: SupportedLocale,
): Promise<Array<Food & { name: string }>> {
  const out: Array<Food & { name: string }> = [];
  for (const id of await listFavoriteFoodIds(conn)) {
    const f = await findFoodById(conn, id);
    if (!f) continue;
    const tr =
      (await findFoodTranslation(conn, id, locale)) ?? (await findAnyTranslation(conn, id));
    if (!tr) continue;
    out.push({ ...f, name: tr.name });
  }
  return out;
}
