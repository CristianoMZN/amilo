// Aerobic exercise favorites — quick-pick row in the catalog.
//
// Mirrors the foodFavorite pattern: a single primary-keyed row marks
// the exercise as a "recent" / "starred" aerobic pick. The repository
// never reads the joined exercise row; the service layer composes the
// catalog with the exerciseTranslation/exercise data when needed.

import type { DbConnection } from '../database/connection';
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

interface AerobicFavoriteRow {
  exercise_id: string;
  created_at: string;
}

/** `true` when the exercise is currently starred as an aerobic pick. */
export async function isAerobicFavorite(conn: DbConnection, exerciseId: string): Promise<boolean> {
  const rows = await query<AerobicFavoriteRow>(
    conn,
    'SELECT exercise_id FROM aerobic_favorite WHERE exercise_id = ?',
    [exerciseId],
  );
  return rows.length > 0;
}

/**
 * Idempotent insert. The dev stub models `INSERT OR IGNORE` natively
 * (see `connection.ts > detectInsertConflict`); on collision the
 * statement silently no-ops.
 */
export async function addAerobicFavorite(conn: DbConnection, exerciseId: string): Promise<void> {
  await exec(
    conn,
    `INSERT OR IGNORE INTO aerobic_favorite (exercise_id, created_at)
     VALUES (?, ?)`,
    [exerciseId, nowIso()],
  );
}

export async function removeAerobicFavorite(conn: DbConnection, exerciseId: string): Promise<void> {
  await exec(conn, 'DELETE FROM aerobic_favorite WHERE exercise_id = ?', [exerciseId]);
}

/** All favorited exercise ids, newest first. */
export async function listAerobicFavorites(conn: DbConnection): Promise<string[]> {
  const rows = await query<AerobicFavoriteRow>(
    conn,
    'SELECT exercise_id FROM aerobic_favorite ORDER BY created_at DESC',
  );
  return rows.map((r) => r.exercise_id);
}
