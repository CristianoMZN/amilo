// Pure helpers for workout sheets / sessions / performed sets.
// No Vue, Pinia, Capacitor or Quasar imports.
//
// All functions are deterministic and side-effect-free. Position-based
// reordering is non-mutating — input arrays are never modified; callers
// receive a fresh array.

import type { MuscleGroup } from './types';

/**
 * Throw on an invalid sheet name. Trims first so whitespace-only strings
 * are rejected. There is no upper length check here (caller-side UI is the
 * place for that — the DB column is a generous TEXT).
 *
 * Throws `Error('sheet name required')` when the trimmed value is empty.
 */
export function assertValidSheetName(name: string): void {
  if (name.trim().length === 0) {
    throw new Error('sheet name required');
  }
}

/**
 * Throw on an invalid session name. Same semantics as `assertValidSheetName`.
 *
 * Throws `Error('session name required')` when the trimmed value is empty.
 */
export function assertValidSessionName(name: string): void {
  if (name.trim().length === 0) {
    throw new Error('session name required');
  }
}

/**
 * Return a new array sorted by `.position` ascending. The input array is
 * never mutated; ties are broken by current order (stable sort).
 */
export function reorderByPosition<T extends { position: number }>(items: ReadonlyArray<T>): T[] {
  return [...items].sort((a, b) => a.position - b.position);
}

/**
 * Return a new array with `.position` reset to `0..items.length-1`. Useful
 * after the user reorders rows — keeps the persisted positions dense so
 * future inserts have predictable anchor slots.
 *
 * The input array is never mutated; a fresh shallow copy is produced for
 * each item so callers can persist the result safely.
 */
export function assignConsecutivePositions<T extends { position: number }>(
  items: ReadonlyArray<T>,
): T[] {
  return items.map((item, i) => ({ ...item, position: i }));
}

/**
 * Build the snapshot fields stored on a `WorkoutPlannedExercise` row. The
 * snapshot freezes the display name + muscle group at plan time so a later
 * rename or delete of the parent exercise does not mutate history.
 *
 * Caller still owns the row — this helper only assembles the snapshot
 * bundle, it does not construct the row or the position.
 */
export function snapshotForPlannedExercise(args: {
  exerciseId: string | null;
  name: string;
  muscleGroup: MuscleGroup | null;
  plannedSets: number;
  plannedReps: number;
  plannedWeightKg: number | null;
  notes: string | null;
}): { exerciseNameSnapshot: string; muscleGroupSnapshot: MuscleGroup | null } {
  void args.exerciseId;
  void args.plannedSets;
  void args.plannedReps;
  void args.plannedWeightKg;
  void args.notes;
  return {
    exerciseNameSnapshot: args.name,
    muscleGroupSnapshot: args.muscleGroup,
  };
}

/**
 * Build the snapshot fields stored on a `PerformedWorkout` row. The
 * snapshot freezes the sheet/session names at start time. `startedAt` is
 * not snapshotted on the row — it is the row's primary timestamp.
 */
export function snapshotForPerformedWorkout(args: {
  sheetId: number | null;
  sessionId: number | null;
  sheetName: string;
  sessionName: string;
  startedAt: string;
}): { sheetNameSnapshot: string; sessionNameSnapshot: string } {
  void args.sheetId;
  void args.sessionId;
  void args.startedAt;
  return {
    sheetNameSnapshot: args.sheetName,
    sessionNameSnapshot: args.sessionName,
  };
}

/**
 * Build the snapshot fields stored on a `PerformedWorkoutExercise` row.
 * Mirrors `snapshotForPlannedExercise` but for ad-hoc executions (the row
 * still snapshots the name + muscle group so history is preserved when the
 * parent exercise is renamed or deleted).
 */
export function snapshotForPerformedExercise(args: {
  exerciseId: string | null;
  name: string;
  muscleGroup: MuscleGroup | null;
}): { exerciseNameSnapshot: string; muscleGroupSnapshot: MuscleGroup | null } {
  void args.exerciseId;
  return {
    exerciseNameSnapshot: args.name,
    muscleGroupSnapshot: args.muscleGroup,
  };
}
