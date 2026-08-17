// Performed workout CRUD.
//
// A performed workout is an actual execution captured independently
// of the source sheet. Snapshot fields (`sheet_name_snapshot`,
// `session_name_snapshot`) preserve the historical label even if the
// sheet/session is later renamed or deleted. `sheet_id` and
// `session_id` are nullable after their parent rows are removed
// (`ON DELETE SET NULL`).

import type { DbConnection } from '../database/connection';
import type { PerformedWorkout, PerformedWorkoutStatus } from 'src/domain/types';
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

interface PerformedWorkoutRow {
  id: number;
  ref_date: string;
  sheet_id: number | null;
  session_id: number | null;
  sheet_name_snapshot: string;
  session_name_snapshot: string;
  status: PerformedWorkoutStatus;
  started_at: string;
  finished_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function rowToPerformedWorkout(row: PerformedWorkoutRow): PerformedWorkout {
  return {
    id: row.id,
    refDate: row.ref_date,
    sheetId: row.sheet_id,
    sessionId: row.session_id,
    sheetNameSnapshot: row.sheet_name_snapshot,
    sessionNameSnapshot: row.session_name_snapshot,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findPerformedWorkoutById(
  conn: DbConnection,
  id: number,
): Promise<PerformedWorkout | null> {
  const rows = await query<PerformedWorkoutRow>(
    conn,
    'SELECT * FROM performed_workout WHERE id = ?',
    [id],
  );
  const row = rows[0];
  return row ? rowToPerformedWorkout(row) : null;
}

export async function listPerformedWorkoutsByDate(
  conn: DbConnection,
  refDate: string,
): Promise<PerformedWorkout[]> {
  const rows = await query<PerformedWorkoutRow>(
    conn,
    'SELECT * FROM performed_workout WHERE ref_date = ? ORDER BY started_at ASC',
    [refDate],
  );
  return rows.map(rowToPerformedWorkout);
}

export async function listPerformedWorkoutsBySession(
  conn: DbConnection,
  sessionId: number,
): Promise<PerformedWorkout[]> {
  const rows = await query<PerformedWorkoutRow>(
    conn,
    'SELECT * FROM performed_workout WHERE session_id = ? ORDER BY ref_date DESC, id DESC',
    [sessionId],
  );
  return rows.map(rowToPerformedWorkout);
}

export async function listPerformedWorkoutsByDateRange(
  conn: DbConnection,
  startDate: string,
  endDate: string,
): Promise<PerformedWorkout[]> {
  const rows = await query<PerformedWorkoutRow>(
    conn,
    'SELECT * FROM performed_workout WHERE ref_date BETWEEN ? AND ? ORDER BY ref_date ASC, started_at ASC',
    [startDate, endDate],
  );
  return rows.map(rowToPerformedWorkout);
}

/**
 * Return the (at most one) `in_progress` workout, or `null` when there
 * is no such row. The schema is intentionally single-writer — there
 * is always at most one active execution at a time.
 */
export async function findInProgressPerformedWorkout(
  conn: DbConnection,
): Promise<PerformedWorkout | null> {
  const rows = await query<PerformedWorkoutRow>(
    conn,
    "SELECT * FROM performed_workout WHERE status = 'in_progress' ORDER BY id ASC",
  );
  const row = rows[0];
  return row ? rowToPerformedWorkout(row) : null;
}

/**
 * Insert a new performed workout. Caller supplies `updatedAt` (rare —
 * services always pass `nowIso()`); the repo assigns `createdAt` only
 * when the caller omits it.
 */
export async function insertPerformedWorkout(
  conn: DbConnection,
  args: Omit<PerformedWorkout, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<PerformedWorkout> {
  const created = nowIso();
  await exec(
    conn,
    `INSERT INTO performed_workout
       (ref_date, sheet_id, session_id, sheet_name_snapshot, session_name_snapshot,
        status, started_at, finished_at, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      args.refDate,
      args.sheetId,
      args.sessionId,
      args.sheetNameSnapshot,
      args.sessionNameSnapshot,
      args.status,
      args.startedAt,
      args.finishedAt,
      args.notes,
      created,
      created,
    ],
  );
  const idRows = await query<PerformedWorkoutRow>(
    conn,
    'SELECT * FROM performed_workout ORDER BY id DESC',
  );
  const head = idRows[0];
  if (!head) throw new Error('insertPerformedWorkout: insert failed');
  return rowToPerformedWorkout(head);
}

/**
 * Update every mutable column. `createdAt` is intentionally immutable;
 * `updated_at` is always refreshed by the repository via `nowIso()`.
 */
export async function updatePerformedWorkout(
  conn: DbConnection,
  args: PerformedWorkout,
): Promise<void> {
  const now = nowIso();
  await exec(
    conn,
    `UPDATE performed_workout SET
       ref_date = ?,
       sheet_id = ?,
       session_id = ?,
       sheet_name_snapshot = ?,
       session_name_snapshot = ?,
       status = ?,
       started_at = ?,
       finished_at = ?,
       notes = ?,
       updated_at = ?
     WHERE id = ?`,
    [
      args.refDate,
      args.sheetId,
      args.sessionId,
      args.sheetNameSnapshot,
      args.sessionNameSnapshot,
      args.status,
      args.startedAt,
      args.finishedAt,
      args.notes,
      now,
      args.id,
    ],
  );
}

/**
 * Delete a performed workout. The dev stub and the native engine both
 * cascade to `performed_workout_exercise` (which itself cascades to
 * `performed_workout_set`).
 */
export async function deletePerformedWorkout(conn: DbConnection, id: number): Promise<void> {
  await exec(conn, 'DELETE FROM performed_workout WHERE id = ?', [id]);
}

/**
 * Lightweight status transition. Used when the only thing that
 * changes is `status` + `finished_at` — avoids resending every other
 * column.
 */
export async function markPerformedWorkoutStatus(
  conn: DbConnection,
  id: number,
  status: PerformedWorkoutStatus,
  finishedAt: string | null,
): Promise<void> {
  await exec(
    conn,
    `UPDATE performed_workout SET
       status = ?,
       finished_at = ?,
       updated_at = ?
     WHERE id = ?`,
    [status, finishedAt, nowIso(), id],
  );
}
