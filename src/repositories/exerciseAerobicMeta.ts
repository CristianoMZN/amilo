// Per-aerobic-exercise kcal/hour estimate.
//
// Strength exercises never get a row in this table — they have no
// meaningful kcal/hour rate. The `findAerobicMeta` / `upsertAerobicMeta`
// pair therefore always operates on aerobic exercises only.

import type { DbConnection } from '../database/connection';
import type { ExerciseAerobicMeta } from 'src/domain/types';

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

interface AerobicMetaRow {
  exercise_id: string;
  kcal_per_hour: number;
}

function rowToMeta(row: AerobicMetaRow): ExerciseAerobicMeta {
  return {
    exerciseId: row.exercise_id,
    kcalPerHour: row.kcal_per_hour,
  };
}

export async function findAerobicMeta(
  conn: DbConnection,
  exerciseId: string,
): Promise<ExerciseAerobicMeta | null> {
  const rows = await query<AerobicMetaRow>(
    conn,
    'SELECT * FROM exercise_aerobic_meta WHERE exercise_id = ?',
    [exerciseId],
  );
  const row = rows[0];
  return row ? rowToMeta(row) : null;
}

/**
 * Upsert an aerobic kcal/hour estimate. The dev stub models
 * `INSERT OR IGNORE` natively; we chain a follow-up UPDATE so the
 * behaviour matches the native engine's
 * `INSERT ... ON CONFLICT(exercise_id) DO UPDATE` clause.
 */
export async function upsertAerobicMeta(
  conn: DbConnection,
  meta: ExerciseAerobicMeta,
): Promise<void> {
  await exec(
    conn,
    `INSERT OR IGNORE INTO exercise_aerobic_meta (exercise_id, kcal_per_hour)
     VALUES (?, ?)`,
    [meta.exerciseId, meta.kcalPerHour],
  );
  await exec(conn, `UPDATE exercise_aerobic_meta SET kcal_per_hour = ? WHERE exercise_id = ?`, [
    meta.kcalPerHour,
    meta.exerciseId,
  ]);
}

export async function deleteAerobicMeta(conn: DbConnection, exerciseId: string): Promise<void> {
  await exec(conn, 'DELETE FROM exercise_aerobic_meta WHERE exercise_id = ?', [exerciseId]);
}
