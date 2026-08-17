// Workout session/division CRUD inside a sheet.
//
// A session is a free-form named row inside a sheet (e.g. "Push",
// "Pull", "Legs") grouping one or more planned exercises.

import type { DbConnection } from '../database/connection';
import type { WorkoutSession } from 'src/domain/types';
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

interface WorkoutSessionRow {
  id: number;
  sheet_id: number;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
}

function rowToSession(row: WorkoutSessionRow): WorkoutSession {
  return {
    id: row.id,
    sheetId: row.sheet_id,
    name: row.name,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findSessionById(
  conn: DbConnection,
  id: number,
): Promise<WorkoutSession | null> {
  const rows = await query<WorkoutSessionRow>(conn, 'SELECT * FROM workout_session WHERE id = ?', [
    id,
  ]);
  const row = rows[0];
  return row ? rowToSession(row) : null;
}

export async function listSessionsBySheet(
  conn: DbConnection,
  sheetId: number,
): Promise<WorkoutSession[]> {
  const rows = await query<WorkoutSessionRow>(
    conn,
    'SELECT * FROM workout_session WHERE sheet_id = ? ORDER BY position ASC, id ASC',
    [sheetId],
  );
  return rows.map(rowToSession);
}

/**
 * Insert a new session at `MAX(position) + 1` within the given sheet
 * (falling back to 0 for an empty sheet).
 */
export async function insertSession(
  conn: DbConnection,
  args: Omit<WorkoutSession, 'id' | 'createdAt' | 'updatedAt' | 'position'>,
): Promise<WorkoutSession> {
  const now = nowIso();
  const maxRows = await query<{ max_pos: number | null }>(
    conn,
    'SELECT MAX(position) AS max_pos FROM workout_session WHERE sheet_id = ?',
    [args.sheetId],
  );
  const nextPosition = (maxRows[0]?.max_pos ?? -1) + 1;
  await exec(
    conn,
    `INSERT INTO workout_session (sheet_id, name, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [args.sheetId, args.name, nextPosition, now, now],
  );
  const idRows = await query<WorkoutSessionRow>(
    conn,
    'SELECT * FROM workout_session ORDER BY id DESC',
  );
  const head = idRows[0];
  if (!head) throw new Error('insertSession: insert failed');
  return rowToSession(head);
}

/** Rename a session. Only `name` and `updated_at` change. */
export async function renameSession(conn: DbConnection, id: number, name: string): Promise<void> {
  await exec(conn, 'UPDATE workout_session SET name = ?, updated_at = ? WHERE id = ?', [
    name,
    nowIso(),
    id,
  ]);
}

/**
 * Delete a session. The dev stub and the native engine both cascade
 * to `workout_planned_exercise` (see `connection.ts > CASCADE_DELETE`).
 */
export async function deleteSession(conn: DbConnection, id: number): Promise<void> {
  await exec(conn, 'DELETE FROM workout_session WHERE id = ?', [id]);
}
