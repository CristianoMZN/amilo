// Workout sheet (plan) CRUD.
//
// A sheet is a reusable plan grouping one or more sessions (e.g. "Push
// day"). The `position` column orders sheets in the catalog; new sheets
// are appended to the end via `MAX(position) + 1`.

import type { DbConnection } from '../database/connection';
import type { WorkoutSheet } from 'src/domain/types';
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

interface WorkoutSheetRow {
  id: number;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
}

function rowToSheet(row: WorkoutSheetRow): WorkoutSheet {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findSheetById(conn: DbConnection, id: number): Promise<WorkoutSheet | null> {
  const rows = await query<WorkoutSheetRow>(conn, 'SELECT * FROM workout_sheet WHERE id = ?', [id]);
  const row = rows[0];
  return row ? rowToSheet(row) : null;
}

export async function listAllSheets(conn: DbConnection): Promise<WorkoutSheet[]> {
  const rows = await query<WorkoutSheetRow>(
    conn,
    'SELECT * FROM workout_sheet ORDER BY position ASC, id ASC',
  );
  return rows.map(rowToSheet);
}

/**
 * Insert a new sheet at `MAX(position) + 1` (falling back to 0 on an
 * empty table). The repository owns `position`, both timestamps and
 * the autoincrement id (read back via `SELECT MAX(id)`); the caller
 * supplies only the name.
 */
export async function insertSheet(
  conn: DbConnection,
  args: Omit<WorkoutSheet, 'id' | 'createdAt' | 'updatedAt' | 'position'>,
): Promise<WorkoutSheet> {
  const now = nowIso();
  const maxRows = await query<{ max_pos: number | null }>(
    conn,
    'SELECT MAX(position) AS max_pos FROM workout_sheet',
  );
  const nextPosition = (maxRows[0]?.max_pos ?? -1) + 1;
  await exec(
    conn,
    `INSERT INTO workout_sheet (name, position, created_at, updated_at)
     VALUES (?, ?, ?, ?)`,
    [args.name, nextPosition, now, now],
  );
  const idRows = await query<WorkoutSheetRow>(conn, 'SELECT * FROM workout_sheet ORDER BY id DESC');
  const head = idRows[0];
  if (!head) throw new Error('insertSheet: insert failed');
  return rowToSheet(head);
}

/**
 * Rename a sheet. Only `name` and `updated_at` change. The rename is
 * a deliberate "soft snapshot" trigger; performed workouts hold a
 * copy of the previous name so historical labels survive.
 */
export async function renameSheet(conn: DbConnection, id: number, name: string): Promise<void> {
  await exec(conn, 'UPDATE workout_sheet SET name = ?, updated_at = ? WHERE id = ?', [
    name,
    nowIso(),
    id,
  ]);
}

/**
 * Delete a sheet. The dev stub manually cascades to `workout_session`
 * (which itself cascades to `workout_planned_exercise`); the native
 * engine enforces the same via `ON DELETE CASCADE` declarations on
 * `workout_session.sheet_id`.
 */
export async function deleteSheet(conn: DbConnection, id: number): Promise<void> {
  await exec(conn, 'DELETE FROM workout_sheet WHERE id = ?', [id]);
}
