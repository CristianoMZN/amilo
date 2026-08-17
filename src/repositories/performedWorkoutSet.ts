// Performed workout set (series) CRUD.
//
// Weight is stored normalised to kilograms. `reps` is REAL to allow
// partial reps (e.g. paused reps); the UI defaults to integer steps
// but the repo never rounds so history is preserved exactly.

import type { DbConnection } from '../database/connection';
import type { PerformedWorkoutSet } from 'src/domain/types';
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

interface PerformedWorkoutSetRow {
  id: number;
  performed_exercise_id: number;
  position: number;
  reps: number;
  weight_kg: number | null;
  completed: number;
  created_at: string;
}

function rowToSet(row: PerformedWorkoutSetRow): PerformedWorkoutSet {
  return {
    id: row.id,
    performedExerciseId: row.performed_exercise_id,
    position: row.position,
    reps: row.reps,
    weightKg: row.weight_kg,
    completed: row.completed === 1,
    createdAt: row.created_at,
  };
}

export async function findPerformedSetById(
  conn: DbConnection,
  id: number,
): Promise<PerformedWorkoutSet | null> {
  const rows = await query<PerformedWorkoutSetRow>(
    conn,
    'SELECT * FROM performed_workout_set WHERE id = ?',
    [id],
  );
  const row = rows[0];
  return row ? rowToSet(row) : null;
}

export async function listPerformedSetsByPerformedExercise(
  conn: DbConnection,
  performedExerciseId: number,
): Promise<PerformedWorkoutSet[]> {
  const rows = await query<PerformedWorkoutSetRow>(
    conn,
    'SELECT * FROM performed_workout_set WHERE performed_exercise_id = ? ORDER BY position ASC, id ASC',
    [performedExerciseId],
  );
  return rows.map(rowToSet);
}

/**
 * All sets for a given canonical exercise across every workout.
 *
 * Two steps because the dev stub does not support subqueries (`IN
 * (SELECT ...)`): first the participating `performed_workout_exercise`
 * ids, then the sets filtered by an `IN (?, ?, …)` placeholder list.
 * The dev stub's `IN` matcher handles the placeholder list natively.
 */
export async function listAllPerformedSetsByExercise(
  conn: DbConnection,
  exerciseId: string,
): Promise<PerformedWorkoutSet[]> {
  const perfExerciseIds = await query<{ id: number }>(
    conn,
    'SELECT id FROM performed_workout_exercise WHERE exercise_id = ? ORDER BY id ASC',
    [exerciseId],
  );
  if (perfExerciseIds.length === 0) return [];
  const ids = perfExerciseIds.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(', ');
  const rows = await query<PerformedWorkoutSetRow>(
    conn,
    `SELECT * FROM performed_workout_set
       WHERE performed_exercise_id IN (${placeholders})
       ORDER BY performed_exercise_id ASC, position ASC, id ASC`,
    ids,
  );
  return rows.map(rowToSet);
}

/**
 * Insert a new set at `MAX(position) + 1` within the target performed
 * exercise.
 */
export async function insertPerformedSet(
  conn: DbConnection,
  args: Omit<PerformedWorkoutSet, 'id' | 'createdAt' | 'position'>,
): Promise<PerformedWorkoutSet> {
  const created = nowIso();
  const maxRows = await query<{ max_pos: number | null }>(
    conn,
    'SELECT MAX(position) AS max_pos FROM performed_workout_set WHERE performed_exercise_id = ?',
    [args.performedExerciseId],
  );
  const nextPosition = (maxRows[0]?.max_pos ?? -1) + 1;
  await exec(
    conn,
    `INSERT INTO performed_workout_set
       (performed_exercise_id, position, reps, weight_kg, completed, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      args.performedExerciseId,
      nextPosition,
      args.reps,
      args.weightKg,
      args.completed ? 1 : 0,
      created,
    ],
  );
  const idRows = await query<{ id: number }>(
    conn,
    'SELECT MAX(id) AS id FROM performed_workout_set',
  );
  const id = idRows[0]?.id ?? 0;
  return { ...args, id, createdAt: created, position: nextPosition };
}

/**
 * Lightweight update — only the user-tunable fields. `position` and
 * `completed` are intentionally not editable from this path so the
 * position reordering and the tick-to-complete flows keep their own
 * dedicated helpers.
 */
export async function updatePerformedSet(
  conn: DbConnection,
  args: PerformedWorkoutSet,
): Promise<void> {
  await exec(
    conn,
    `UPDATE performed_workout_set SET
       reps = ?,
       weight_kg = ?,
       completed = ?
     WHERE id = ?`,
    [args.reps, args.weightKg, args.completed ? 1 : 0, args.id],
  );
}

export async function deletePerformedSet(conn: DbConnection, id: number): Promise<void> {
  await exec(conn, 'DELETE FROM performed_workout_set WHERE id = ?', [id]);
}

/** Lightweight "did the user complete this set" toggle. */
export async function markPerformedSetCompleted(
  conn: DbConnection,
  id: number,
  completed: boolean,
): Promise<void> {
  await exec(conn, 'UPDATE performed_workout_set SET completed = ? WHERE id = ?', [
    completed ? 1 : 0,
    id,
  ]);
}
