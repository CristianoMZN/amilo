// Concrete implementation of `ExerciseService` over the SQLite repositories.
//
// Vue components import the singleton `exerciseService` here and never call
// repositories directly. Each method is responsible for:
//   - keeping the contract promises (idempotency, snapshot integrity, …);
//   - validating user inputs via domain helpers before persisting;
//   - composing translations + exercises into the rich `ExerciseWithName`
//     shape the UI consumes (the dev stub does not support SQL JOIN);
//   - throwing `Error(...)` with descriptive messages on missing rows /
//     invalid inputs.
//
// Concurrency note: this is an offline-only module. All methods assume a
// single-process user; there is no cross-process locking. Methods that
// mutate state should be called from a Vue action that immediately
// refreshes the affected panel.

import type {
  AerobicActivity,
  Exercise,
  ExerciseKind,
  ExerciseOrigin,
  ExerciseTranslation,
  MuscleGroup,
  SupportedLocale,
} from 'src/domain/types';
import { assertValidDurationMinutes, buildAerobicSnapshot } from 'src/domain/aerobic';
import { assertValidExerciseName, assertValidKcalPerHour } from 'src/domain/exercise';
import { nowIso } from 'src/util/dateDay';
import { matchesSearch, normalizeForSearch } from 'src/util/search';
import type { DbConnection } from 'src/database/connection';

import type {
  AerobicActivityWithExercise,
  CreateCustomExerciseInput,
  ExerciseHistorySnapshot,
  ExerciseService,
  ExerciseWithName,
  UpdateCustomExerciseInput,
} from './contract';

import * as aerobicActivityRepo from 'src/repositories/aerobicActivity';
import * as aerobicFavoriteRepo from 'src/repositories/aerobicFavorite';
import * as exerciseRepo from 'src/repositories/exercise';
import * as exerciseTranslationRepo from 'src/repositories/exerciseTranslation';
import * as exerciseAerobicMetaRepo from 'src/repositories/exerciseAerobicMeta';
import * as performedWorkoutExerciseRepo from 'src/repositories/performedWorkoutExercise';
import * as performedWorkoutRepo from 'src/repositories/performedWorkout';
import * as performedWorkoutSetRepo from 'src/repositories/performedWorkoutSet';

// ---------------------------------------------------------------------------
// Helpers (module-private)
// ---------------------------------------------------------------------------

const CUSTOM_EXERCISE_ID_PATTERN = /^exercise:user:[A-Za-z0-9-]+$/;

function assertValidCustomExerciseId(id: string): void {
  if (!CUSTOM_EXERCISE_ID_PATTERN.test(id)) {
    throw new Error(`custom exercise id must match 'exercise:user:<slug>' (got: ${id})`);
  }
}

/**
 * Pick the best translation row for a locale, falling back to 'en' and then
 * to the first available entry. Mirrors `domain/exercise.findTranslationForLocale`
 * but inlined to avoid an extra module hop in the hot path.
 */
function findTranslationForLocale(
  translations: ReadonlyArray<ExerciseTranslation>,
  locale: SupportedLocale,
): ExerciseTranslation | undefined {
  const target = translations.find((t) => t.locale === locale);
  if (target) return target;
  const en = translations.find((t) => t.locale === 'en');
  if (en) return en;
  return translations[0];
}

/**
 * Resolve the best displayable name for an exercise in the given locale.
 * Same fallback chain as `domain/exercise.displayNameFor` — locale, 'en',
 * first available, finally the exercise id.
 */
function displayNameFor(
  exercise: Exercise,
  translations: ReadonlyArray<ExerciseTranslation>,
  locale: SupportedLocale,
): string {
  const tr = findTranslationForLocale(translations, locale);
  if (tr) return tr.name;
  return exercise.id;
}

/**
 * Hydrate a list of exercise rows with their best-known localized name.
 * Joins the translation table in JS (the dev stub doesn't support SQL
 * JOIN). When `filter.query` is provided, applies a substring match
 * against the resolved name's search blob.
 */
async function hydrate(
  conn: DbConnection,
  exercises: ReadonlyArray<Exercise>,
  locale: SupportedLocale,
  filterQuery: string | undefined,
  filterMuscleGroup: MuscleGroup | undefined,
): Promise<ExerciseWithName[]> {
  const out: ExerciseWithName[] = [];
  const wantQuery = filterQuery !== undefined && filterQuery.trim().length > 0;
  for (const exercise of exercises) {
    if (filterMuscleGroup !== undefined && exercise.muscleGroup !== filterMuscleGroup) {
      continue;
    }
    const translations = await exerciseTranslationRepo.listExerciseTranslationsByExercise(
      conn,
      exercise.id,
    );
    const name = displayNameFor(exercise, translations, locale);
    if (wantQuery) {
      const translation = findTranslationForLocale(translations, locale);
      const haystack = translation?.search ?? normalizeForSearch(name);
      if (!matchesSearch(filterQuery, haystack)) continue;
    }
    out.push({ exercise, name });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

// ---------------------------------------------------------------------------
// ExerciseService implementation
// ---------------------------------------------------------------------------

export const exerciseService: ExerciseService = {
  // ----- Exercise library reads -----------------------------------------

  async listExercises(conn, args) {
    let exercises: Exercise[];
    if (args.filter?.kind !== undefined) {
      exercises = await exerciseRepo.listExercisesByKind(conn, args.filter.kind);
    } else {
      exercises = await exerciseRepo.listAllExercises(conn);
    }
    let filtered = exercises;
    if (args.filter?.origin !== undefined) {
      const origin: ExerciseOrigin = args.filter.origin;
      filtered = filtered.filter((e) => e.origin === origin);
    }
    return hydrate(conn, filtered, args.locale, args.filter?.query, args.filter?.muscleGroup);
  },

  async listAerobicExercises(conn, args) {
    const exercises = await exerciseRepo.listExercisesByKind(conn, 'aerobic');
    return hydrate(conn, exercises, args.locale, undefined, undefined);
  },

  async listStrengthExercises(conn, args) {
    const exercises = await exerciseRepo.listExercisesByKind(conn, 'strength');
    return hydrate(conn, exercises, args.locale, args.query, args.muscleGroup);
  },

  async listRecentAerobicExerciseIds(conn, args) {
    return aerobicActivityRepo.listRecentAerobicExerciseIds(conn, args.limit);
  },

  async listFavoriteAerobicExerciseIds(conn) {
    return aerobicFavoriteRepo.listAerobicFavorites(conn);
  },

  async listFavoriteAerobicExercises(conn, args) {
    const ids = await aerobicFavoriteRepo.listAerobicFavorites(conn);
    const out: ExerciseWithName[] = [];
    for (const id of ids) {
      const exercise = await exerciseRepo.findExerciseById(conn, id);
      if (!exercise) continue;
      const translations = await exerciseTranslationRepo.listExerciseTranslationsByExercise(
        conn,
        id,
      );
      out.push({ exercise, name: displayNameFor(exercise, translations, args.locale) });
    }
    return out;
  },

  // ----- Exercise history ------------------------------------------------

  async getExerciseHistory(conn, args): Promise<ExerciseHistorySnapshot> {
    const exercise = await exerciseRepo.findExerciseById(conn, args.exerciseId);
    if (!exercise) {
      return {
        exerciseId: args.exerciseId,
        exerciseName: args.exerciseId,
        lastPerformedWorkout: null,
        recordWeightKg: null,
        recordWeightReps: null,
      };
    }
    const translations = await exerciseTranslationRepo.listExerciseTranslationsByExercise(
      conn,
      exercise.id,
    );
    const exerciseName = displayNameFor(exercise, translations, args.locale);

    const allSets = await performedWorkoutSetRepo.listAllPerformedSetsByExercise(conn, exercise.id);
    if (allSets.length === 0) {
      return {
        exerciseId: exercise.id,
        exerciseName,
        lastPerformedWorkout: null,
        recordWeightKg: null,
        recordWeightReps: null,
      };
    }

    // Find the most recent performed_workout_exercise for this exercise —
    // its row id is the highest (auto-increment). Then find the sets
    // belonging to that exercise.
    let latestPerformedExerciseId = -1;
    for (const set of allSets) {
      if (set.performedExerciseId > latestPerformedExerciseId) {
        latestPerformedExerciseId = set.performedExerciseId;
      }
    }
    const lastSets = allSets.filter((s) => s.performedExerciseId === latestPerformedExerciseId);

    // Best set by weight across the entire history.
    let recordWeightKg: number | null = null;
    let recordWeightReps: number | null = null;
    for (const s of allSets) {
      if (s.weightKg === null) continue;
      if (recordWeightKg === null || s.weightKg > recordWeightKg) {
        recordWeightKg = s.weightKg;
        recordWeightReps = s.reps;
      }
    }

    // Resolve the parent performed_workout so we can stamp `refDate` on the
    // snapshot. Two extra round-trips — kept cheap; the dev stub doesn't
    // model JOINs.
    const performedExercise = await performedWorkoutExerciseRepo.findPerformedExerciseById(
      conn,
      latestPerformedExerciseId,
    );
    let refDate = '';
    let performedWorkoutId = 0;
    if (performedExercise) {
      const performedWorkout = await performedWorkoutRepo.findPerformedWorkoutById(
        conn,
        performedExercise.performedWorkoutId,
      );
      if (performedWorkout) {
        refDate = performedWorkout.refDate;
        performedWorkoutId = performedWorkout.id;
      }
    }

    return {
      exerciseId: exercise.id,
      exerciseName,
      lastPerformedWorkout: {
        performedWorkoutId,
        refDate,
        sets: lastSets.map((s) => ({
          reps: s.reps,
          weightKg: s.weightKg,
          completed: s.completed,
        })),
      },
      recordWeightKg,
      recordWeightReps,
    };
  },

  // ----- Aerobic activity CRUD ------------------------------------------

  async recordAerobicActivity(conn, args): Promise<AerobicActivity> {
    assertValidKcalPerHour(args.kcalPerHour);
    assertValidDurationMinutes(args.durationMinutes);
    const snap = buildAerobicSnapshot({
      exerciseName: args.exerciseName,
      kcalPerHour: args.kcalPerHour,
      durationMinutes: args.durationMinutes,
    });
    return aerobicActivityRepo.insertAerobicActivity(conn, {
      refDate: args.refDate,
      exerciseId: args.exerciseId,
      durationMinutes: args.durationMinutes,
      ...snap,
      notes: args.notes,
    });
  },

  async updateAerobicActivity(conn, args): Promise<AerobicActivity> {
    assertValidKcalPerHour(args.kcalPerHour);
    assertValidDurationMinutes(args.durationMinutes);
    const existing = await aerobicActivityRepo.findAerobicActivityById(conn, args.id);
    if (!existing) {
      throw new Error(`updateAerobicActivity: aerobic activity ${args.id} not found`);
    }
    const kcalEstimated = (args.kcalPerHour * args.durationMinutes) / 60;
    const updated: AerobicActivity = {
      ...existing,
      kcalPerHourSnapshot: args.kcalPerHour,
      durationMinutes: args.durationMinutes,
      kcalEstimated,
      notes: args.notes,
    };
    await aerobicActivityRepo.updateAerobicActivity(conn, updated);
    return updated;
  },

  async deleteAerobicActivity(conn, id) {
    await aerobicActivityRepo.deleteAerobicActivity(conn, id);
  },

  async listAerobicActivitiesByDate(conn, args) {
    const activities = await aerobicActivityRepo.listAerobicActivitiesByDate(conn, args.refDate);
    const out: AerobicActivityWithExercise[] = [];
    for (const activity of activities) {
      out.push(await hydrateAerobicActivity(conn, activity, args.locale));
    }
    return out;
  },

  async listAerobicActivitiesByDateRange(conn, args) {
    const activities = await aerobicActivityRepo.listAerobicActivitiesByDateRange(
      conn,
      args.startDate,
      args.endDate,
    );
    const out: AerobicActivityWithExercise[] = [];
    for (const activity of activities) {
      out.push(await hydrateAerobicActivity(conn, activity, args.locale));
    }
    return out;
  },

  // ----- Aerobic favorites ----------------------------------------------

  async isAerobicFavorite(conn, exerciseId) {
    return aerobicFavoriteRepo.isAerobicFavorite(conn, exerciseId);
  },

  async toggleAerobicFavorite(conn, exerciseId) {
    const already = await aerobicFavoriteRepo.isAerobicFavorite(conn, exerciseId);
    if (already) {
      await aerobicFavoriteRepo.removeAerobicFavorite(conn, exerciseId);
      return false;
    }
    await aerobicFavoriteRepo.addAerobicFavorite(conn, exerciseId);
    return true;
  },

  // ----- Custom exercises ------------------------------------------------

  async createCustomExercise(conn, args: CreateCustomExerciseInput): Promise<Exercise> {
    assertValidCustomExerciseId(args.id);
    assertValidExerciseName(args.name);
    if (args.kind === 'aerobic') {
      if (args.kcalPerHour === null) {
        throw new Error('createCustomExercise: aerobic exercises require kcalPerHour');
      }
      assertValidKcalPerHour(args.kcalPerHour);
    } else if (args.kcalPerHour !== null) {
      throw new Error('createCustomExercise: strength exercises must have kcalPerHour === null');
    }

    const now = nowIso();
    const base = {
      id: args.id,
      origin: 'custom' as const,
      kind: args.kind,
      muscleGroup: args.muscleGroup,
      defaultUnit: args.defaultUnit,
      hasRepetitions: args.hasRepetitions,
      hasDuration: args.hasDuration,
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    };
    const exercise = await exerciseRepo.insertExercise(conn, base);
    await exerciseTranslationRepo.insertExerciseTranslation(conn, {
      exerciseId: args.id,
      locale: args.locale,
      name: args.name,
    });
    if (args.kind === 'aerobic' && args.kcalPerHour !== null) {
      await exerciseAerobicMetaRepo.upsertAerobicMeta(conn, {
        exerciseId: args.id,
        kcalPerHour: args.kcalPerHour,
      });
    }
    return exercise;
  },

  async updateCustomExercise(conn, args: UpdateCustomExerciseInput): Promise<Exercise> {
    assertValidCustomExerciseId(args.id);
    assertValidExerciseName(args.name);
    const existing = await exerciseRepo.findExerciseById(conn, args.id);
    if (!existing) {
      throw new Error(`updateCustomExercise: ${args.id} not found`);
    }
    if (existing.origin !== 'custom') {
      throw new Error(
        `updateCustomExercise: ${args.id} is not a custom exercise (origin=${existing.origin})`,
      );
    }
    if (args.kind === 'aerobic') {
      if (args.kcalPerHour === null) {
        throw new Error('updateCustomExercise: aerobic exercises require kcalPerHour');
      }
      assertValidKcalPerHour(args.kcalPerHour);
    } else if (args.kcalPerHour !== null) {
      throw new Error('updateCustomExercise: strength exercises must have kcalPerHour === null');
    }

    const updated: Exercise = {
      ...existing,
      kind: args.kind,
      muscleGroup: args.muscleGroup,
      defaultUnit: args.defaultUnit,
      hasRepetitions: args.hasRepetitions,
      hasDuration: args.hasDuration,
      notes: args.notes,
      updatedAt: nowIso(),
    };
    await exerciseRepo.updateExercise(conn, updated);
    await exerciseTranslationRepo.upsertExerciseTranslation(conn, {
      exerciseId: args.id,
      locale: args.locale,
      name: args.name,
      search: normalizeForSearch(args.name),
    });
    if (args.kind === 'aerobic' && args.kcalPerHour !== null) {
      await exerciseAerobicMetaRepo.upsertAerobicMeta(conn, {
        exerciseId: args.id,
        kcalPerHour: args.kcalPerHour,
      });
    }
    return updated;
  },

  async deleteCustomExercise(conn, id) {
    const existing = await exerciseRepo.findExerciseById(conn, id);
    if (!existing) {
      throw new Error(`deleteCustomExercise: ${id} not found`);
    }
    if (existing.origin !== 'custom') {
      throw new Error(
        `deleteCustomExercise: ${id} is not a custom exercise (origin=${existing.origin})`,
      );
    }
    await exerciseRepo.deleteExercise(conn, id);
  },
};

// ---------------------------------------------------------------------------
// Helpers (kept after the singleton so the service surface stays focused)
// ---------------------------------------------------------------------------

/**
 * Hydrate a single aerobic activity with its best-known localized name.
 * When the parent exercise has been deleted (`exerciseId === null`) we fall
 * back to the snapshot value and mark the row as `deleted` so the UI can
 * render a "deleted exercise" chip.
 */
async function hydrateAerobicActivity(
  conn: DbConnection,
  activity: AerobicActivity,
  locale: SupportedLocale,
): Promise<AerobicActivityWithExercise> {
  if (activity.exerciseId === null) {
    return {
      activity,
      exerciseName: activity.exerciseNameSnapshot,
      exerciseOrigin: 'deleted',
    };
  }
  const exercise = await exerciseRepo.findExerciseById(conn, activity.exerciseId);
  if (!exercise) {
    return {
      activity,
      exerciseName: activity.exerciseNameSnapshot,
      exerciseOrigin: 'deleted',
    };
  }
  const tr = await exerciseTranslationRepo.findExerciseTranslation(conn, exercise.id, locale);
  const name = tr?.name ?? activity.exerciseNameSnapshot;
  return {
    activity,
    exerciseName: name,
    exerciseOrigin: exercise.origin,
  };
}

// Silence unused-parameter hints for the ExerciseKind import — it is part
// of the public re-exports in `contract.ts` and kept here so future
// type-narrowing additions don't need an extra import.
void (null as unknown as ExerciseKind);
