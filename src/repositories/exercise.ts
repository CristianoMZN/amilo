// Exercise CRUD.
//
// An "exercise" is the canonical movement (walking, barbell bench press, …)
// identified by a stable string slug. Official rows are seeded from the
// bundled catalog (Sprint 3 seed); custom rows come from the user's own
// creations. Aerobic exercises carry kcal/hour estimates in a side table
// (see `./exerciseAerobicMeta`); strength exercises do not.
//
// Muscles/body parts are captured via `muscle_group` so the catalog can
// be filtered. The field is nullable because aerobic exercises have no
// meaningful muscle group.

import type { DbConnection } from '../database/connection';
import type {
  Exercise,
  ExerciseDefaultUnit,
  ExerciseKind,
  ExerciseOrigin,
  MuscleGroup,
} from 'src/domain/types';
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

interface ExerciseRow {
  id: string;
  origin: ExerciseOrigin;
  kind: ExerciseKind;
  muscle_group: string | null;
  default_unit: ExerciseDefaultUnit;
  has_repetitions: number;
  has_duration: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function rowToExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    origin: row.origin,
    kind: row.kind,
    muscleGroup: row.muscle_group as MuscleGroup | null,
    defaultUnit: row.default_unit,
    hasRepetitions: row.has_repetitions === 1,
    hasDuration: row.has_duration === 1,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findExerciseById(conn: DbConnection, id: string): Promise<Exercise | null> {
  const rows = await query<ExerciseRow>(conn, 'SELECT * FROM exercise WHERE id = ?', [id]);
  const row = rows[0];
  return row ? rowToExercise(row) : null;
}

export async function listExercisesByKind(
  conn: DbConnection,
  kind: ExerciseKind,
): Promise<Exercise[]> {
  const rows = await query<ExerciseRow>(
    conn,
    'SELECT * FROM exercise WHERE kind = ? ORDER BY id ASC',
    [kind],
  );
  return rows.map(rowToExercise);
}

export async function listOfficialExercises(conn: DbConnection): Promise<Exercise[]> {
  const rows = await query<ExerciseRow>(
    conn,
    "SELECT * FROM exercise WHERE origin = 'official' ORDER BY id ASC",
  );
  return rows.map(rowToExercise);
}

export async function listCustomExercises(conn: DbConnection): Promise<Exercise[]> {
  const rows = await query<ExerciseRow>(
    conn,
    "SELECT * FROM exercise WHERE origin = 'custom' ORDER BY id ASC",
  );
  return rows.map(rowToExercise);
}

export async function listAllExercises(conn: DbConnection): Promise<Exercise[]> {
  const rows = await query<ExerciseRow>(conn, 'SELECT * FROM exercise ORDER BY id ASC');
  return rows.map(rowToExercise);
}

/**
 * Insert a new exercise row. The repository assigns both timestamps; the
 * caller is expected to provide a stable, semantic id (e.g.
 * 'exercise:walking' or 'exercise:user:<uuid>').
 */
export async function insertExercise(
  conn: DbConnection,
  exercise: Omit<Exercise, 'createdAt' | 'updatedAt'>,
): Promise<Exercise> {
  const now = nowIso();
  await exec(
    conn,
    `INSERT INTO exercise
       (id, origin, kind, muscle_group, default_unit,
        has_repetitions, has_duration, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      exercise.id,
      exercise.origin,
      exercise.kind,
      exercise.muscleGroup,
      exercise.defaultUnit,
      exercise.hasRepetitions ? 1 : 0,
      exercise.hasDuration ? 1 : 0,
      exercise.notes,
      now,
      now,
    ],
  );
  return { ...exercise, createdAt: now, updatedAt: now };
}

/**
 * Update only the user-editable fields of an exercise. `id`, `origin`,
 * `kind`, and the timestamps are intentionally immutable from the
 * repository surface — renaming/recategorising an exercise has
 * downstream snapshot implications that are owned by the service layer.
 */
export async function updateExercise(conn: DbConnection, exercise: Exercise): Promise<void> {
  const now = nowIso();
  await exec(
    conn,
    `UPDATE exercise SET
       muscle_group = ?,
       default_unit = ?,
       has_repetitions = ?,
       has_duration = ?,
       notes = ?,
       updated_at = ?
     WHERE id = ?`,
    [
      exercise.muscleGroup,
      exercise.defaultUnit,
      exercise.hasRepetitions ? 1 : 0,
      exercise.hasDuration ? 1 : 0,
      exercise.notes,
      now,
      exercise.id,
    ],
  );
}

/**
 * Delete an exercise row. The dev stub manually cascades to
 * `exercise_translation`, `exercise_aerobic_meta`, and
 * `aerobic_favorite` (see `connection.ts > CASCADE_DELETE`); the
 * native SQLite engine enforces the same via `ON DELETE CASCADE`.
 *
 * Logged rows (aerobic_activity, workout_planned_exercise,
 * performed_workout_exercise) hold a copy of the parent id and are
 * intentionally untouched — their snapshots preserve history.
 */
export async function deleteExercise(conn: DbConnection, id: string): Promise<void> {
  await exec(conn, 'DELETE FROM exercise WHERE id = ?', [id]);
}
