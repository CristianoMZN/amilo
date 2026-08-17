// Public service contract for the Amilio workout module (sheets, sessions,
// planned exercises, performed workouts, performed exercises + sets).
//
// Vue components and Pinia stores depend on this TypeScript interface
// (not on the implementation). One real implementation lives in
// `./service.ts`. Adding a new operation means: append to this interface,
// implement in `./service.ts`. TypeScript will refuse to compile
// otherwise — keeping the surfaces in sync.
//
// Conventions:
//   - every operation is async, takes `conn: DbConnection` first
//   - `locale` is always passed explicitly (no implicit `i18n` reads)
//   - snapshots are computed via `domain/workout` helpers so renaming or
//     deleting a parent row never rewrites history
//   - return IDs and entities the caller can use to update local state
//     without re-fetching the whole day's data

import type { DbConnection } from 'src/database/connection';
import type {
  Exercise,
  MuscleGroup,
  PerformedWorkout,
  PerformedWorkoutSet,
  SupportedLocale,
  WorkoutSession,
  WorkoutSheet,
  WorkoutPlannedExercise,
} from 'src/domain/types';

// ---------------------------------------------------------------------------
// Composite return shapes
// ---------------------------------------------------------------------------

export interface SheetWithSessions {
  sheet: WorkoutSheet;
  sessions: SessionWithExercises[];
}

export interface SessionWithExercises {
  session: WorkoutSession;
  plannedExercises: PlannedExerciseWithExercise[];
}

export interface PlannedExerciseWithExercise {
  planned: WorkoutPlannedExercise;
  /** Null when the parent custom exercise has been deleted. */
  exercise: Exercise | null;
  exerciseOrigin: 'official' | 'custom' | 'deleted';
}

export interface PerformedWorkoutWithDetails {
  performedWorkout: PerformedWorkout;
  exercises: PerformedExerciseWithSets[];
}

export interface PerformedExerciseWithSets {
  performedExercise: {
    id: number;
    performedWorkoutId: number;
    exerciseId: string | null;
    exerciseNameSnapshot: string;
    muscleGroupSnapshot: MuscleGroup | null;
    position: number;
    createdAt: string;
  };
  exercise: Exercise | null;
  sets: PerformedWorkoutSet[];
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateSheetInput {
  name: string;
}

export interface CreateSessionInput {
  sheetId: number;
  name: string;
}

export interface AddPlannedExerciseInput {
  sessionId: number;
  /** Null = user-defined custom. The service generates a uuid in that case. */
  exerciseId: string | null;
  name: string;
  muscleGroup: MuscleGroup | null;
  plannedSets: number;
  plannedReps: number;
  plannedWeightKg: number | null;
  notes: string | null;
}

export interface UpdatePlannedExerciseInput {
  id: number;
  plannedSets: number;
  plannedReps: number;
  plannedWeightKg: number | null;
  notes: string | null;
}

/** (Reserved for future use — see Lane 6 / Lane 7.) */
export interface StartWorkoutInput {
  sheetId: number | null;
  sessionId: number | null;
  refDate: string;
  /** ISO timestamp. */
  startedAt: string;
  sheetNameSnapshot: string;
  sessionNameSnapshot: string;
}

export interface RecordSetInput {
  performedExerciseId: number;
  reps: number;
  weightKg: number | null;
}

export interface UpdateSetInput {
  id: number;
  reps: number;
  weightKg: number | null;
  completed: boolean;
}

/** Result of comparing current vs previous sets for the same exercise. */
export interface PerformedSetComparison {
  exerciseId: string;
  exerciseName: string;
  currentSets: Array<{ reps: number; weightKg: number | null }>;
  /** Null when there is no prior workout to compare against. */
  previousSets: Array<{ reps: number; weightKg: number | null }> | null;
  progression: {
    weightDeltaKg: number | null;
    repsDelta: number | null;
    volumeDeltaKg: number | null;
  };
  recordWeightKg: number | null;
  recordWeightReps: number | null;
}

// ---------------------------------------------------------------------------
// The interface
// ---------------------------------------------------------------------------

export interface WorkoutService {
  // ----- Sheets ---------------------------------------------------------

  listSheets(conn: DbConnection): Promise<WorkoutSheet[]>;

  listSheetsWithSessions(conn: DbConnection): Promise<SheetWithSessions[]>;

  findSheet(conn: DbConnection, id: number): Promise<SheetWithSessions | null>;

  createSheet(conn: DbConnection, args: CreateSheetInput): Promise<WorkoutSheet>;

  renameSheet(conn: DbConnection, args: { id: number; name: string }): Promise<void>;

  /** Performed workouts survive via snapshot — only the plan row is removed. */
  deleteSheet(conn: DbConnection, id: number): Promise<void>;

  // ----- Sessions -------------------------------------------------------

  createSession(conn: DbConnection, args: CreateSessionInput): Promise<WorkoutSession>;

  renameSession(conn: DbConnection, args: { id: number; name: string }): Promise<void>;

  deleteSession(conn: DbConnection, id: number): Promise<void>;

  // ----- Planned exercises ----------------------------------------------

  listPlannedExercisesBySession(
    conn: DbConnection,
    sessionId: number,
  ): Promise<PlannedExerciseWithExercise[]>;

  addPlannedExercise(
    conn: DbConnection,
    args: AddPlannedExerciseInput,
  ): Promise<WorkoutPlannedExercise>;

  updatePlannedExercise(conn: DbConnection, args: UpdatePlannedExerciseInput): Promise<void>;

  deletePlannedExercise(conn: DbConnection, id: number): Promise<void>;

  /** Swap with the previous position. No-op when at the top. */
  movePlannedExerciseUp(conn: DbConnection, sessionId: number, plannedId: number): Promise<void>;

  /** Swap with the next position. No-op when at the bottom. */
  movePlannedExerciseDown(conn: DbConnection, sessionId: number, plannedId: number): Promise<void>;

  // ----- Performed workout lifecycle -----------------------------------

  findInProgressWorkout(conn: DbConnection): Promise<PerformedWorkoutWithDetails | null>;

  /**
   * Start a workout from an existing sheet + session, cloning each planned
   * exercise into a new `performed_workout_exercise` row (so further edits
   * to the plan don't mutate the in-progress execution).
   */
  startWorkoutFromSession(
    conn: DbConnection,
    args: { sheetId: number; sessionId: number; refDate: string },
  ): Promise<PerformedWorkoutWithDetails>;

  /** Start a fully user-defined workout (no sheet/session backing). */
  startAdHocWorkout(
    conn: DbConnection,
    args: {
      sheetId: number | null;
      sessionId: number | null;
      sheetName: string;
      sessionName: string;
      refDate: string;
    },
  ): Promise<PerformedWorkoutWithDetails>;

  listPerformedWorkoutsByDate(
    conn: DbConnection,
    args: { refDate: string },
  ): Promise<PerformedWorkoutWithDetails[]>;

  listPerformedWorkoutsBySession(
    conn: DbConnection,
    args: { sessionId: number; limit?: number },
  ): Promise<PerformedWorkout[]>;

  finishWorkout(conn: DbConnection, args: { id: number; finishedAt: string }): Promise<void>;

  /** Same as finish but with status='abandoned'. Stamps `finishedAt = nowIso()`. */
  abandonWorkout(conn: DbConnection, args: { id: number }): Promise<void>;

  // ----- Performed exercises + sets (during a workout) -----------------

  /**
   * Add a new performed exercise to an in-progress workout. Returns the
   * inserted `performed_workout_exercise` id. When `exerciseId === null`,
   * the caller passes a custom name + muscle group and the service treats
   * it as ad-hoc (history-only, no catalog link).
   */
  addPerformedExercise(
    conn: DbConnection,
    args: {
      performedWorkoutId: number;
      exerciseId: string | null;
      exerciseName: string;
      muscleGroup: MuscleGroup | null;
    },
  ): Promise<number>;

  deletePerformedExercise(conn: DbConnection, id: number): Promise<void>;

  recordSet(conn: DbConnection, args: RecordSetInput): Promise<PerformedWorkoutSet>;

  updateSet(conn: DbConnection, args: UpdateSetInput): Promise<void>;

  deleteSet(conn: DbConnection, id: number): Promise<void>;

  markSetCompleted(conn: DbConnection, args: { id: number; completed: boolean }): Promise<void>;

  // ----- History comparison ---------------------------------------------

  /**
   * Compute the progression summary (current vs previous sets) for a single
   * canonical exercise. Returns null-safe defaults when there is no history.
   */
  getExerciseComparison(
    conn: DbConnection,
    args: { exerciseId: string; locale: SupportedLocale },
  ): Promise<PerformedSetComparison>;

  // ----- Recompute helpers (optional) -----------------------------------

  getPerformedWorkout(conn: DbConnection, id: number): Promise<PerformedWorkoutWithDetails | null>;
}
