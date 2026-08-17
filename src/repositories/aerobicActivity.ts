// Aerobic activity log — one row per logged session on a single day.
//
// Snapshot fields (`exercise_name_snapshot`, `kcal_per_hour_snapshot`)
// preserve the historical label and kcal/hour estimate even when the
// parent exercise is edited or deleted. The exercise_id is intentionally
// nullable after a custom exercise is removed (the FK declares
// `ON DELETE SET NULL`).

import type { DbConnection } from '../database/connection';
import type { AerobicActivity } from 'src/domain/types';
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

interface AerobicActivityRow {
  id: number;
  ref_date: string;
  exercise_id: string | null;
  exercise_name_snapshot: string;
  kcal_per_hour_snapshot: number;
  duration_minutes: number;
  kcal_estimated: number;
  notes: string | null;
  created_at: string;
}

function rowToActivity(row: AerobicActivityRow): AerobicActivity {
  return {
    id: row.id,
    refDate: row.ref_date,
    exerciseId: row.exercise_id,
    exerciseNameSnapshot: row.exercise_name_snapshot,
    kcalPerHourSnapshot: row.kcal_per_hour_snapshot,
    durationMinutes: row.duration_minutes,
    kcalEstimated: row.kcal_estimated,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export async function findAerobicActivityById(
  conn: DbConnection,
  id: number,
): Promise<AerobicActivity | null> {
  const rows = await query<AerobicActivityRow>(
    conn,
    'SELECT * FROM aerobic_activity WHERE id = ?',
    [id],
  );
  const row = rows[0];
  return row ? rowToActivity(row) : null;
}

export async function listAerobicActivitiesByDate(
  conn: DbConnection,
  refDate: string,
): Promise<AerobicActivity[]> {
  const rows = await query<AerobicActivityRow>(
    conn,
    'SELECT * FROM aerobic_activity WHERE ref_date = ? ORDER BY created_at ASC',
    [refDate],
  );
  return rows.map(rowToActivity);
}

export async function listAerobicActivitiesByDateRange(
  conn: DbConnection,
  startDate: string,
  endDate: string,
): Promise<AerobicActivity[]> {
  const rows = await query<AerobicActivityRow>(
    conn,
    'SELECT * FROM aerobic_activity WHERE ref_date BETWEEN ? AND ? ORDER BY ref_date ASC, created_at ASC',
    [startDate, endDate],
  );
  return rows.map(rowToActivity);
}

export async function listAerobicActivitiesByExercise(
  conn: DbConnection,
  exerciseId: string,
): Promise<AerobicActivity[]> {
  const rows = await query<AerobicActivityRow>(
    conn,
    'SELECT * FROM aerobic_activity WHERE exercise_id = ? ORDER BY created_at DESC',
    [exerciseId],
  );
  return rows.map(rowToActivity);
}

/**
 * Distinct exercise ids ordered by most-recent activity, deduplicated in
 * JS because the dev stub does not support `DISTINCT`/`GROUP BY`.
 */
export async function listRecentAerobicExerciseIds(
  conn: DbConnection,
  limit: number,
): Promise<string[]> {
  const rows = await query<{ exercise_id: string | null; created_at: string }>(
    conn,
    'SELECT exercise_id, created_at FROM aerobic_activity ORDER BY created_at DESC',
  );
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    if (r.exercise_id === null) continue;
    if (seen.has(r.exercise_id)) continue;
    seen.add(r.exercise_id);
    out.push(r.exercise_id);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Insert a new aerobic activity. The repository owns `created_at`
 * (assigned via `nowIso`); the caller supplies the snapshot fields
 * plus ref_date, duration, kcal_estimated and notes.
 */
export async function insertAerobicActivity(
  conn: DbConnection,
  args: Omit<AerobicActivity, 'id' | 'createdAt'>,
): Promise<AerobicActivity> {
  const created = nowIso();
  await exec(
    conn,
    `INSERT INTO aerobic_activity
       (ref_date, exercise_id, exercise_name_snapshot,
        kcal_per_hour_snapshot, duration_minutes, kcal_estimated,
        notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      args.refDate,
      args.exerciseId,
      args.exerciseNameSnapshot,
      args.kcalPerHourSnapshot,
      args.durationMinutes,
      args.kcalEstimated,
      args.notes,
      created,
    ],
  );
  const idRows = await query<{ id: number }>(conn, 'SELECT MAX(id) AS id FROM aerobic_activity');
  const id = idRows[0]?.id ?? 0;
  return { ...args, id, createdAt: created };
}

/**
 * Update only the user-editable columns — ref_date and created_at are
 * intentionally immutable so daily aggregations stay stable.
 */
export async function updateAerobicActivity(
  conn: DbConnection,
  args: AerobicActivity,
): Promise<void> {
  await exec(
    conn,
    `UPDATE aerobic_activity SET
       exercise_id = ?,
       exercise_name_snapshot = ?,
       kcal_per_hour_snapshot = ?,
       duration_minutes = ?,
       kcal_estimated = ?,
       notes = ?
     WHERE id = ?`,
    [
      args.exerciseId,
      args.exerciseNameSnapshot,
      args.kcalPerHourSnapshot,
      args.durationMinutes,
      args.kcalEstimated,
      args.notes,
      args.id,
    ],
  );
}

export async function deleteAerobicActivity(conn: DbConnection, id: number): Promise<void> {
  await exec(conn, 'DELETE FROM aerobic_activity WHERE id = ?', [id]);
}
