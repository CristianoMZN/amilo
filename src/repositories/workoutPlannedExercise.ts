// Planned exercise CRUD inside a workout session.
//
// Each planned exercise captures sets/reps/weight and snapshots the
// canonical exercise name + muscle group so editing the parent exercise
// later doesn't silently rewrite the plan. The `exercise_id` is
// nullable after a custom exercise is removed (`ON DELETE SET NULL`).

import type { DbConnection } from '../database/connection';
import type { MuscleGroup, WorkoutPlannedExercise } from 'src/domain/types';
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

interface WorkoutPlannedExerciseRow {
  id: number;
  session_id: number;
  exercise_id: string | null;
  exercise_name_snapshot: string;
  muscle_group_snapshot: string | null;
  position: number;
  planned_sets: number;
  planned_reps: number;
  planned_weight_kg: number | null;
  notes: string | null;
  created_at: string;
}

function rowToPlannedExercise(row: WorkoutPlannedExerciseRow): WorkoutPlannedExercise {
  return {
    id: row.id,
    sessionId: row.session_id,
    exerciseId: row.exercise_id,
    exerciseNameSnapshot: row.exercise_name_snapshot,
    muscleGroupSnapshot: row.muscle_group_snapshot as MuscleGroup | null,
    position: row.position,
    plannedSets: row.planned_sets,
    plannedReps: row.planned_reps,
    plannedWeightKg: row.planned_weight_kg,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export async function findPlannedExerciseById(
  conn: DbConnection,
  id: number,
): Promise<WorkoutPlannedExercise | null> {
  const rows = await query<WorkoutPlannedExerciseRow>(
    conn,
    'SELECT * FROM workout_planned_exercise WHERE id = ?',
    [id],
  );
  const row = rows[0];
  return row ? rowToPlannedExercise(row) : null;
}

export async function listPlannedExercisesBySession(
  conn: DbConnection,
  sessionId: number,
): Promise<WorkoutPlannedExercise[]> {
  const rows = await query<WorkoutPlannedExerciseRow>(
    conn,
    'SELECT * FROM workout_planned_exercise WHERE session_id = ? ORDER BY position ASC, id ASC',
    [sessionId],
  );
  return rows.map(rowToPlannedExercise);
}

/**
 * Insert a new planned exercise at `MAX(position) + 1` within the
 * target session.
 */
export async function insertPlannedExercise(
  conn: DbConnection,
  args: Omit<WorkoutPlannedExercise, 'id' | 'createdAt' | 'position'>,
): Promise<WorkoutPlannedExercise> {
  const created = nowIso();
  const maxRows = await query<{ max_pos: number | null }>(
    conn,
    'SELECT MAX(position) AS max_pos FROM workout_planned_exercise WHERE session_id = ?',
    [args.sessionId],
  );
  const nextPosition = (maxRows[0]?.max_pos ?? -1) + 1;
  await exec(
    conn,
    `INSERT INTO workout_planned_exercise
       (session_id, exercise_id, exercise_name_snapshot, muscle_group_snapshot,
        position, planned_sets, planned_reps, planned_weight_kg, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      args.sessionId,
      args.exerciseId,
      args.exerciseNameSnapshot,
      args.muscleGroupSnapshot,
      nextPosition,
      args.plannedSets,
      args.plannedReps,
      args.plannedWeightKg,
      args.notes,
      created,
    ],
  );
  const idRows = await query<{ id: number }>(
    conn,
    'SELECT MAX(id) AS id FROM workout_planned_exercise',
  );
  const id = idRows[0]?.id ?? 0;
  return { ...args, id, createdAt: created, position: nextPosition };
}

export async function updatePlannedExercise(
  conn: DbConnection,
  args: WorkoutPlannedExercise,
): Promise<void> {
  await exec(
    conn,
    `UPDATE workout_planned_exercise SET
       exercise_id = ?,
       exercise_name_snapshot = ?,
       muscle_group_snapshot = ?,
       position = ?,
       planned_sets = ?,
       planned_reps = ?,
       planned_weight_kg = ?,
       notes = ?
     WHERE id = ?`,
    [
      args.exerciseId,
      args.exerciseNameSnapshot,
      args.muscleGroupSnapshot,
      args.position,
      args.plannedSets,
      args.plannedReps,
      args.plannedWeightKg,
      args.notes,
      args.id,
    ],
  );
}

export async function deletePlannedExercise(conn: DbConnection, id: number): Promise<void> {
  await exec(conn, 'DELETE FROM workout_planned_exercise WHERE id = ?', [id]);
}

/**
 * Swap the `position` of two planned exercises. The native engine can
 * do this in one transaction via SQL; the dev stub cannot, so we
 * emulate by reading both rows, swapping the values, and UPDATE-ing
 * each. Single-process app → no concurrent writers means the emulation
 * is race-free.
 */
export async function swapPositions(conn: DbConnection, idA: number, idB: number): Promise<void> {
  if (idA === idB) return;
  const rowsA = await query<{ position: number }>(
    conn,
    'SELECT position FROM workout_planned_exercise WHERE id = ?',
    [idA],
  );
  const rowsB = await query<{ position: number }>(
    conn,
    'SELECT position FROM workout_planned_exercise WHERE id = ?',
    [idB],
  );
  const posA = rowsA[0]?.position;
  const posB = rowsB[0]?.position;
  if (posA === undefined || posB === undefined) return;
  await exec(conn, 'UPDATE workout_planned_exercise SET position = ? WHERE id = ?', [posB, idA]);
  await exec(conn, 'UPDATE workout_planned_exercise SET position = ? WHERE id = ?', [posA, idB]);
}
