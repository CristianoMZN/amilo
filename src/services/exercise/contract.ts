// Public service contract for the Amilo exercise + aerobic module.
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
//   - snapshot fields live on the AerobicActivity row so historical kcal
//     estimates stay correct even if the parent exercise is edited or
//     deleted
//   - return IDs and entities the caller can use to update local state
//     without re-fetching the whole day's data

import type { DbConnection } from 'src/database/connection';
import type {
  AerobicActivity,
  AerobicFavorite,
  Exercise,
  ExerciseKind,
  ExerciseTranslation,
  MuscleGroup,
  SupportedLocale,
} from 'src/domain/types';

// ---------------------------------------------------------------------------
// Return-shape types
// ---------------------------------------------------------------------------

/** Exercise with its localized display name (locale → 'en' → first → id). */
export interface ExerciseWithName {
  exercise: Exercise;
  name: string;
}

/** Inputs for recording a new aerobic activity. */
export interface AerobicActivityInput {
  exerciseId: string;
  exerciseName: string;
  kcalPerHour: number;
  durationMinutes: number;
  notes: string | null;
  refDate: string;
}

/** Aerobic activity enriched with its exercise name (when available). */
export interface AerobicActivityWithExercise {
  activity: AerobicActivity;
  /** Best-known localized name: live translation → snapshot fallback. */
  exerciseName: string;
  /** Where the name ultimately came from. */
  exerciseOrigin: 'official' | 'custom' | 'deleted';
}

/**
 * History snapshot for a strength exercise — the last time the user
 * lifted it and the all-time best by weight.
 */
export interface ExerciseHistorySnapshot {
  exerciseId: string;
  exerciseName: string;
  lastPerformedWorkout: {
    performedWorkoutId: number;
    refDate: string;
    sets: Array<{ reps: number; weightKg: number | null; completed: boolean }>;
  } | null;
  /** Highest `weightKg` ever recorded for this exercise (`null` if none). */
  recordWeightKg: number | null;
  /** Reps at `recordWeightKg`. */
  recordWeightReps: number | null;
}

// ---------------------------------------------------------------------------
// Custom-exercise input types
// ---------------------------------------------------------------------------

export interface CreateCustomExerciseInput {
  /** Stable id, e.g. 'exercise:user:<uuid>'. */
  id: string;
  kind: ExerciseKind;
  name: string;
  locale: SupportedLocale;
  muscleGroup: MuscleGroup | null;
  defaultUnit: 'kg' | 'lb' | 'bodyweight' | 'none';
  hasRepetitions: boolean;
  hasDuration: boolean;
  notes: string | null;
  /** Required (must be a finite non-negative number) when `kind === 'aerobic'`. */
  kcalPerHour: number | null;
}
export type UpdateCustomExerciseInput = CreateCustomExerciseInput;

// ---------------------------------------------------------------------------
// Filter / args shapes
// ---------------------------------------------------------------------------

export interface ExerciseListFilter {
  kind?: ExerciseKind;
  origin?: 'official' | 'custom';
  muscleGroup?: MuscleGroup;
  /** Locale-aware substring match against the localized name. */
  query?: string;
}

// ---------------------------------------------------------------------------
// The interface
// ---------------------------------------------------------------------------

/**
 * The full surface of the exercise module's high-level operations. Every
 * entry is a method on the `ExerciseService` instance — keep them here,
 * never inline in components.
 */
export interface ExerciseService {
  // ----- Exercise library reads -----------------------------------------

  /** List exercises with the configured filter; sorted by localized name. */
  listExercises(
    conn: DbConnection,
    args: { locale: SupportedLocale; filter?: ExerciseListFilter },
  ): Promise<ExerciseWithName[]>;

  /** Only aerobic exercises, sorted by localized name. */
  listAerobicExercises(
    conn: DbConnection,
    args: { locale: SupportedLocale },
  ): Promise<ExerciseWithName[]>;

  /** Only strength exercises, optionally narrowed by muscle group / query. */
  listStrengthExercises(
    conn: DbConnection,
    args: { locale: SupportedLocale; muscleGroup?: MuscleGroup; query?: string },
  ): Promise<ExerciseWithName[]>;

  /** Distinct aerobic exercise ids, most-recently-used first. */
  listRecentAerobicExerciseIds(conn: DbConnection, args: { limit: number }): Promise<string[]>;

  /** All favorited aerobic exercise ids. */
  listFavoriteAerobicExerciseIds(conn: DbConnection): Promise<string[]>;

  /** All favorited aerobic exercises (with localized names). */
  listFavoriteAerobicExercises(
    conn: DbConnection,
    args: { locale: SupportedLocale },
  ): Promise<ExerciseWithName[]>;

  // ----- Exercise history ------------------------------------------------

  /**
   * History snapshot for a single strength exercise (last time it was
   * performed + all-time best set). Returns a blank snapshot when the
   * exercise has been deleted or has no history.
   */
  getExerciseHistory(
    conn: DbConnection,
    args: { exerciseId: string; locale: SupportedLocale },
  ): Promise<ExerciseHistorySnapshot>;

  // ----- Aerobic activity CRUD ------------------------------------------

  /** Record a new aerobic activity; returns the inserted row. */
  recordAerobicActivity(conn: DbConnection, args: AerobicActivityInput): Promise<AerobicActivity>;

  /**
   * Update kcal/h + duration (and recompute `kcal_estimated` from those).
   * Other columns (`ref_date`, `created_at`) are intentionally immutable.
   */
  updateAerobicActivity(
    conn: DbConnection,
    args: {
      id: number;
      kcalPerHour: number;
      durationMinutes: number;
      notes: string | null;
    },
  ): Promise<AerobicActivity>;

  /** Delete an aerobic activity. */
  deleteAerobicActivity(conn: DbConnection, id: number): Promise<void>;

  /** All aerobic activities for a single day, with localized names. */
  listAerobicActivitiesByDate(
    conn: DbConnection,
    args: { refDate: string; locale: SupportedLocale },
  ): Promise<AerobicActivityWithExercise[]>;

  /** All aerobic activities in a `[startDate, endDate]` range. */
  listAerobicActivitiesByDateRange(
    conn: DbConnection,
    args: { startDate: string; endDate: string; locale: SupportedLocale },
  ): Promise<AerobicActivityWithExercise[]>;

  // ----- Aerobic favorites ----------------------------------------------

  isAerobicFavorite(conn: DbConnection, exerciseId: string): Promise<boolean>;
  /** Add when not present, remove when present. Returns the new state. */
  toggleAerobicFavorite(conn: DbConnection, exerciseId: string): Promise<boolean>;

  // ----- Custom exercises ------------------------------------------------

  createCustomExercise(conn: DbConnection, args: CreateCustomExerciseInput): Promise<Exercise>;
  updateCustomExercise(conn: DbConnection, args: UpdateCustomExerciseInput): Promise<Exercise>;
  /** Throws when the row is not user-owned (origin !== 'custom'). */
  deleteCustomExercise(conn: DbConnection, id: string): Promise<void>;
}

// Re-export the type-only identifiers that consumers may want to import
// from this module (mirrors the index.ts barrel).
export type { ExerciseTranslation, AerobicFavorite };
