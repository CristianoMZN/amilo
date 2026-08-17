// Performed workout exercise CRUD.
//
// Each performed exercise carries the canonical name + muscle group
// captured at log time. Editing the parent `exercise` row later never
// rewrites a logged history — the snapshot columns own the display.

import type { DbConnection } from '../database/connection';
import type {
  MuscleGroup,
  PerformedWorkout,
  PerformedWorkoutExercise,
  PerformedWorkoutSet,
} from 'src/domain/types';
import { nowIso } from 'src/util/dateDay';
// Local imports avoid introducing a circular dep at module load — the
// performed-set repo re-exports nothing so this is one-way safe.
import { findPerformedWorkoutById } from './performedWorkout';
import { listPerformedSetsByPerformedExercise } from './performedWorkoutSet';

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

interface PerformedWorkoutExerciseRow {
  id: number;
  performed_workout_id: number;
  exercise_id: string | null;
  exercise_name_snapshot: string;
  muscle_group_snapshot: string | null;
  position: number;
  created_at: string;
}

function rowToPerformedExercise(row: PerformedWorkoutExerciseRow): PerformedWorkoutExercise {
  return {
    id: row.id,
    performedWorkoutId: row.performed_workout_id,
    exerciseId: row.exercise_id,
    exerciseNameSnapshot: row.exercise_name_snapshot,
    muscleGroupSnapshot: row.muscle_group_snapshot as MuscleGroup | null,
    position: row.position,
    createdAt: row.created_at,
  };
}

export async function findPerformedExerciseById(
  conn: DbConnection,
  id: number,
): Promise<PerformedWorkoutExercise | null> {
  const rows = await query<PerformedWorkoutExerciseRow>(
    conn,
    'SELECT * FROM performed_workout_exercise WHERE id = ?',
    [id],
  );
  const row = rows[0];
  return row ? rowToPerformedExercise(row) : null;
}

export async function listPerformedExercisesByWorkout(
  conn: DbConnection,
  performedWorkoutId: number,
): Promise<PerformedWorkoutExercise[]> {
  const rows = await query<PerformedWorkoutExerciseRow>(
    conn,
    'SELECT * FROM performed_workout_exercise WHERE performed_workout_id = ? ORDER BY position ASC, id ASC',
    [performedWorkoutId],
  );
  return rows.map(rowToPerformedExercise);
}

/**
 * Most-recent performed exercise for a given canonical exercise id,
 * optionally excluding a workout id (used to skip the current workout
 * when computing "last time" comparisons).
 *
 * Returns the parent performed workout and its sets so the caller can
 * render the comparison view with one repository call.
 *
 * Two steps because the dev stub does not support `JOIN`:
 *   1. SELECT most-recent `performed_workout_exercise` for the
 *      exercise id (excluding the workout if provided).
 *   2. SELECT the parent workout and its sets via the relevant repos.
 *
 * The native engine would resolve this in a single query with a
 * correlated subquery; the dev stub fails closed on subqueries, so we
 * accept the extra round-trip here.
 */
export async function findLastPerformedExerciseForExercise(
  conn: DbConnection,
  exerciseId: string,
  excludeWorkoutId: number | null,
): Promise<{
  performedExercise: PerformedWorkoutExercise;
  sets: PerformedWorkoutSet[];
  performedWorkout: PerformedWorkout;
} | null> {
  const sql =
    excludeWorkoutId === null
      ? 'SELECT * FROM performed_workout_exercise WHERE exercise_id = ? ORDER BY id DESC'
      : 'SELECT * FROM performed_workout_exercise WHERE exercise_id = ? AND performed_workout_id != ? ORDER BY id DESC';
  const params = excludeWorkoutId === null ? [exerciseId] : [exerciseId, excludeWorkoutId];
  const rows = await query<PerformedWorkoutExerciseRow>(conn, sql, params);
  const head = rows[0];
  if (!head) return null;
  const performedExercise = rowToPerformedExercise(head);
  const performedWorkout = await findPerformedWorkoutById(
    conn,
    performedExercise.performedWorkoutId,
  );
  if (!performedWorkout) return null;
  const sets = await listPerformedSetsByPerformedExercise(conn, performedExercise.id);
  return { performedExercise, sets, performedWorkout };
}

/**
 * Insert a new performed exercise at `MAX(position) + 1` within the
 * target workout.
 */
export async function insertPerformedExercise(
  conn: DbConnection,
  args: Omit<PerformedWorkoutExercise, 'id' | 'createdAt' | 'position'>,
): Promise<PerformedWorkoutExercise> {
  const created = nowIso();
  const maxRows = await query<{ max_pos: number | null }>(
    conn,
    'SELECT MAX(position) AS max_pos FROM performed_workout_exercise WHERE performed_workout_id = ?',
    [args.performedWorkoutId],
  );
  const nextPosition = (maxRows[0]?.max_pos ?? -1) + 1;
  await exec(
    conn,
    `INSERT INTO performed_workout_exercise
       (performed_workout_id, exercise_id, exercise_name_snapshot,
        muscle_group_snapshot, position, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      args.performedWorkoutId,
      args.exerciseId,
      args.exerciseNameSnapshot,
      args.muscleGroupSnapshot,
      nextPosition,
      created,
    ],
  );
  const idRows = await query<{ id: number }>(
    conn,
    'SELECT MAX(id) AS id FROM performed_workout_exercise',
  );
  const id = idRows[0]?.id ?? 0;
  return { ...args, id, createdAt: created, position: nextPosition };
}

export async function updatePerformedExercise(
  conn: DbConnection,
  args: PerformedWorkoutExercise,
): Promise<void> {
  await exec(
    conn,
    `UPDATE performed_workout_exercise SET
       exercise_id = ?,
       exercise_name_snapshot = ?,
       muscle_group_snapshot = ?,
       position = ?
     WHERE id = ?`,
    [args.exerciseId, args.exerciseNameSnapshot, args.muscleGroupSnapshot, args.position, args.id],
  );
}

export async function deletePerformedExercise(conn: DbConnection, id: number): Promise<void> {
  await exec(conn, 'DELETE FROM performed_workout_exercise WHERE id = ?', [id]);
}
