// Concrete implementation of `WorkoutService` over the SQLite repositories.
//
// Vue components import the singleton `workoutService` here and never call
// repositories directly. Each method is responsible for:
//   - keeping the contract promises (idempotency, snapshot integrity, …);
//   - validating user inputs via domain helpers before persisting;
//   - composing sheets / sessions / performed exercises into the rich
//     shapes the UI consumes (the dev stub doesn't model SQL JOIN);
//   - throwing `Error(...)` with descriptive messages on missing rows /
//     invalid inputs.
//
// Concurrency note: this is an offline-only module. All methods assume a
// single-process user; there is no cross-process locking. Methods that
// mutate state should be called from a Vue action that immediately
// refreshes the affected panel.

import type {
  MuscleGroup,
  PerformedWorkout,
  PerformedWorkoutSet,
  SupportedLocale,
  WorkoutPlannedExercise,
  WorkoutSession,
  WorkoutSheet,
} from 'src/domain/types';
import { assertValidReps, assertValidWeightKg } from 'src/domain/exercise';
import {
  assertValidSessionName,
  assertValidSheetName,
  snapshotForPerformedExercise,
  snapshotForPerformedWorkout,
  snapshotForPlannedExercise,
} from 'src/domain/workout';
import { bestSetByWeight } from 'src/domain/volume';
import { progressionSummary } from 'src/domain/progression';
import { nowIso } from 'src/util/dateDay';
import type { DbConnection } from 'src/database/connection';

import type {
  PerformedExerciseWithSets,
  PerformedSetComparison,
  PerformedWorkoutWithDetails,
  PlannedExerciseWithExercise,
  RecordSetInput,
  SessionWithExercises,
  SheetWithSessions,
  UpdatePlannedExerciseInput,
  WorkoutService,
} from './contract';

import * as exerciseRepo from 'src/repositories/exercise';
import * as exerciseTranslationRepo from 'src/repositories/exerciseTranslation';
import * as workoutSheetRepo from 'src/repositories/workoutSheet';
import * as workoutSessionRepo from 'src/repositories/workoutSession';
import * as workoutPlannedExerciseRepo from 'src/repositories/workoutPlannedExercise';
import * as performedWorkoutRepo from 'src/repositories/performedWorkout';
import * as performedWorkoutExerciseRepo from 'src/repositories/performedWorkoutExercise';
import * as performedWorkoutSetRepo from 'src/repositories/performedWorkoutSet';

// ---------------------------------------------------------------------------
// Helpers (module-private)
// ---------------------------------------------------------------------------

/** Best localized name for an exercise (locale → 'en' → first → id). */
async function exerciseDisplayName(
  conn: DbConnection,
  exerciseId: string | null,
  fallback: string,
  locale: SupportedLocale,
): Promise<string> {
  if (exerciseId === null) return fallback;
  const tr = await exerciseTranslationRepo.findExerciseTranslation(conn, exerciseId, locale);
  if (tr) return tr.name;
  const anyTr = await exerciseTranslationRepo.findAnyExerciseTranslation(conn, exerciseId);
  if (anyTr) return anyTr.name;
  return exerciseId;
}

/** Compose a `PerformedExerciseWithSets` from its three parts. */
async function hydratePerformedExercise(
  conn: DbConnection,
  performedExercise: {
    id: number;
    performedWorkoutId: number;
    exerciseId: string | null;
    exerciseNameSnapshot: string;
    muscleGroupSnapshot: MuscleGroup | null;
    position: number;
    createdAt: string;
  },
  sets: PerformedWorkoutSet[],
  locale: SupportedLocale | undefined,
): Promise<PerformedExerciseWithSets> {
  const exercise = performedExercise.exerciseId
    ? await exerciseRepo.findExerciseById(conn, performedExercise.exerciseId)
    : null;
  // Locale is best-effort — only used for the `exercise` lookup display name
  // below; callers can pass `undefined` for non-UI paths.
  void locale;
  return {
    performedExercise,
    exercise,
    sets,
  };
}

/** Compose a `PerformedWorkoutWithDetails` from its parts. */
async function hydratePerformedWorkout(
  conn: DbConnection,
  performedWorkout: PerformedWorkout,
  locale?: SupportedLocale,
): Promise<PerformedWorkoutWithDetails> {
  const performedExercises = await performedWorkoutExerciseRepo.listPerformedExercisesByWorkout(
    conn,
    performedWorkout.id,
  );
  const exercises: PerformedExerciseWithSets[] = [];
  for (const pe of performedExercises) {
    const sets = await performedWorkoutSetRepo.listPerformedSetsByPerformedExercise(conn, pe.id);
    exercises.push(await hydratePerformedExercise(conn, pe, sets, locale));
  }
  return { performedWorkout, exercises };
}

/** Compose a `PlannedExerciseWithExercise` from its parts. */
async function hydratePlannedExercise(
  conn: DbConnection,
  planned: WorkoutPlannedExercise,
): Promise<PlannedExerciseWithExercise> {
  if (planned.exerciseId === null) {
    return { planned, exercise: null, exerciseOrigin: 'deleted' };
  }
  const exercise = await exerciseRepo.findExerciseById(conn, planned.exerciseId);
  if (!exercise) {
    return { planned, exercise: null, exerciseOrigin: 'deleted' };
  }
  return { planned, exercise, exerciseOrigin: exercise.origin };
}

/** Compose a `SessionWithExercises` from its parts. */
async function hydrateSession(
  conn: DbConnection,
  session: WorkoutSession,
): Promise<SessionWithExercises> {
  const planned = await workoutPlannedExerciseRepo.listPlannedExercisesBySession(conn, session.id);
  const plannedExercises: PlannedExerciseWithExercise[] = [];
  for (const p of planned) {
    plannedExercises.push(await hydratePlannedExercise(conn, p));
  }
  return { session, plannedExercises };
}

/** Compose a `SheetWithSessions` from its parts. */
async function hydrateSheet(conn: DbConnection, sheet: WorkoutSheet): Promise<SheetWithSessions> {
  const sessions = await workoutSessionRepo.listSessionsBySheet(conn, sheet.id);
  const out: SessionWithExercises[] = [];
  for (const s of sessions) {
    out.push(await hydrateSession(conn, s));
  }
  return { sheet, sessions: out };
}

// ---------------------------------------------------------------------------
// WorkoutService implementation
// ---------------------------------------------------------------------------

export const workoutService: WorkoutService = {
  // ----- Sheets ---------------------------------------------------------

  async listSheets(conn) {
    return workoutSheetRepo.listAllSheets(conn);
  },

  async listSheetsWithSessions(conn) {
    const sheets = await workoutSheetRepo.listAllSheets(conn);
    const out: SheetWithSessions[] = [];
    for (const s of sheets) {
      out.push(await hydrateSheet(conn, s));
    }
    return out;
  },

  async findSheet(conn, id) {
    const sheet = await workoutSheetRepo.findSheetById(conn, id);
    if (!sheet) return null;
    return hydrateSheet(conn, sheet);
  },

  async createSheet(conn, args) {
    assertValidSheetName(args.name);
    return workoutSheetRepo.insertSheet(conn, { name: args.name.trim() });
  },

  async renameSheet(conn, args) {
    assertValidSheetName(args.name);
    await workoutSheetRepo.renameSheet(conn, args.id, args.name.trim());
  },

  async deleteSheet(conn, id) {
    await workoutSheetRepo.deleteSheet(conn, id);
  },

  // ----- Sessions -------------------------------------------------------

  async createSession(conn, args) {
    assertValidSessionName(args.name);
    return workoutSessionRepo.insertSession(conn, {
      sheetId: args.sheetId,
      name: args.name.trim(),
    });
  },

  async renameSession(conn, args) {
    assertValidSessionName(args.name);
    await workoutSessionRepo.renameSession(conn, args.id, args.name.trim());
  },

  async deleteSession(conn, id) {
    await workoutSessionRepo.deleteSession(conn, id);
  },

  // ----- Planned exercises ----------------------------------------------

  async listPlannedExercisesBySession(conn, sessionId) {
    const planned = await workoutPlannedExerciseRepo.listPlannedExercisesBySession(conn, sessionId);
    const out: PlannedExerciseWithExercise[] = [];
    for (const p of planned) {
      out.push(await hydratePlannedExercise(conn, p));
    }
    return out;
  },

  async addPlannedExercise(conn, args): Promise<WorkoutPlannedExercise> {
    // Custom exercises get a synthetic id so the parent exercise row can be
    // created on-demand. For now we just snapshot the user-supplied name +
    // muscle group; the actual exercise row creation is owned by Lane 7.
    const snap = snapshotForPlannedExercise({
      exerciseId: args.exerciseId,
      name: args.name,
      muscleGroup: args.muscleGroup,
      plannedSets: args.plannedSets,
      plannedReps: args.plannedReps,
      plannedWeightKg: args.plannedWeightKg,
      notes: args.notes,
    });
    return workoutPlannedExerciseRepo.insertPlannedExercise(conn, {
      sessionId: args.sessionId,
      exerciseId: args.exerciseId,
      exerciseNameSnapshot: snap.exerciseNameSnapshot,
      muscleGroupSnapshot: snap.muscleGroupSnapshot,
      plannedSets: args.plannedSets,
      plannedReps: args.plannedReps,
      plannedWeightKg: args.plannedWeightKg,
      notes: args.notes,
    });
  },

  async updatePlannedExercise(conn, args: UpdatePlannedExerciseInput) {
    const existing = await workoutPlannedExerciseRepo.findPlannedExerciseById(conn, args.id);
    if (!existing) {
      throw new Error(`updatePlannedExercise: planned exercise ${args.id} not found`);
    }
    const updated: WorkoutPlannedExercise = {
      ...existing,
      plannedSets: args.plannedSets,
      plannedReps: args.plannedReps,
      plannedWeightKg: args.plannedWeightKg,
      notes: args.notes,
    };
    await workoutPlannedExerciseRepo.updatePlannedExercise(conn, updated);
  },

  async deletePlannedExercise(conn, id) {
    await workoutPlannedExerciseRepo.deletePlannedExercise(conn, id);
  },

  async movePlannedExerciseUp(conn, sessionId, plannedId) {
    const items = await workoutPlannedExerciseRepo.listPlannedExercisesBySession(conn, sessionId);
    const idx = items.findIndex((it) => it.id === plannedId);
    if (idx <= 0) return; // boundary or not found — no-op
    const prev = items[idx - 1];
    const curr = items[idx];
    if (!prev || !curr) return;
    await workoutPlannedExerciseRepo.swapPositions(conn, curr.id, prev.id);
  },

  async movePlannedExerciseDown(conn, sessionId, plannedId) {
    const items = await workoutPlannedExerciseRepo.listPlannedExercisesBySession(conn, sessionId);
    const idx = items.findIndex((it) => it.id === plannedId);
    if (idx < 0 || idx >= items.length - 1) return; // boundary or not found
    const next = items[idx + 1];
    const curr = items[idx];
    if (!next || !curr) return;
    await workoutPlannedExerciseRepo.swapPositions(conn, curr.id, next.id);
  },

  // ----- Performed workout lifecycle -----------------------------------

  async findInProgressWorkout(conn): Promise<PerformedWorkoutWithDetails | null> {
    const performedWorkout = await performedWorkoutRepo.findInProgressPerformedWorkout(conn);
    if (!performedWorkout) return null;
    return hydratePerformedWorkout(conn, performedWorkout);
  },

  async startWorkoutFromSession(conn, args): Promise<PerformedWorkoutWithDetails> {
    const sheet = await workoutSheetRepo.findSheetById(conn, args.sheetId);
    if (!sheet) {
      throw new Error(`startWorkoutFromSession: sheet ${args.sheetId} not found`);
    }
    const session = await workoutSessionRepo.findSessionById(conn, args.sessionId);
    if (!session) {
      throw new Error(`startWorkoutFromSession: session ${args.sessionId} not found`);
    }
    if (session.sheetId !== sheet.id) {
      throw new Error(
        `startWorkoutFromSession: session ${session.id} does not belong to sheet ${sheet.id}`,
      );
    }

    const snap = snapshotForPerformedWorkout({
      sheetId: sheet.id,
      sessionId: session.id,
      sheetName: sheet.name,
      sessionName: session.name,
      startedAt: nowIso(),
    });

    const performedWorkout = await performedWorkoutRepo.insertPerformedWorkout(conn, {
      refDate: args.refDate,
      sheetId: sheet.id,
      sessionId: session.id,
      sheetNameSnapshot: snap.sheetNameSnapshot,
      sessionNameSnapshot: snap.sessionNameSnapshot,
      status: 'in_progress',
      startedAt: nowIso(),
      finishedAt: null,
      notes: null,
    });

    // Clone every planned exercise into a performed row so future sheet edits
    // don't mutate the in-progress execution.
    const planned = await workoutPlannedExerciseRepo.listPlannedExercisesBySession(
      conn,
      session.id,
    );
    for (const plan of planned) {
      const peSnap = snapshotForPerformedExercise({
        exerciseId: plan.exerciseId,
        name: plan.exerciseNameSnapshot,
        muscleGroup: plan.muscleGroupSnapshot,
      });
      await performedWorkoutExerciseRepo.insertPerformedExercise(conn, {
        performedWorkoutId: performedWorkout.id,
        exerciseId: plan.exerciseId,
        exerciseNameSnapshot: peSnap.exerciseNameSnapshot,
        muscleGroupSnapshot: peSnap.muscleGroupSnapshot,
      });
    }

    return hydratePerformedWorkout(conn, performedWorkout);
  },

  async startAdHocWorkout(conn, args): Promise<PerformedWorkoutWithDetails> {
    const snap = snapshotForPerformedWorkout({
      sheetId: args.sheetId,
      sessionId: args.sessionId,
      sheetName: args.sheetName,
      sessionName: args.sessionName,
      startedAt: nowIso(),
    });
    const performedWorkout = await performedWorkoutRepo.insertPerformedWorkout(conn, {
      refDate: args.refDate,
      sheetId: args.sheetId,
      sessionId: args.sessionId,
      sheetNameSnapshot: snap.sheetNameSnapshot,
      sessionNameSnapshot: snap.sessionNameSnapshot,
      status: 'in_progress',
      startedAt: nowIso(),
      finishedAt: null,
      notes: null,
    });
    return hydratePerformedWorkout(conn, performedWorkout);
  },

  async listPerformedWorkoutsByDate(conn, args) {
    const list = await performedWorkoutRepo.listPerformedWorkoutsByDate(conn, args.refDate);
    const out: PerformedWorkoutWithDetails[] = [];
    for (const pw of list) {
      out.push(await hydratePerformedWorkout(conn, pw));
    }
    return out;
  },

  async listPerformedWorkoutsBySession(conn, args) {
    const full = await performedWorkoutRepo.listPerformedWorkoutsBySession(conn, args.sessionId);
    if (args.limit !== undefined) return full.slice(0, args.limit);
    return full;
  },

  async finishWorkout(conn, args) {
    await performedWorkoutRepo.markPerformedWorkoutStatus(
      conn,
      args.id,
      'completed',
      args.finishedAt,
    );
  },

  async abandonWorkout(conn, args) {
    await performedWorkoutRepo.markPerformedWorkoutStatus(conn, args.id, 'abandoned', nowIso());
  },

  // ----- Performed exercises + sets (during a workout) -----------------

  async addPerformedExercise(conn, args): Promise<number> {
    const snap = snapshotForPerformedExercise({
      exerciseId: args.exerciseId,
      name: args.exerciseName,
      muscleGroup: args.muscleGroup,
    });
    const inserted = await performedWorkoutExerciseRepo.insertPerformedExercise(conn, {
      performedWorkoutId: args.performedWorkoutId,
      exerciseId: args.exerciseId,
      exerciseNameSnapshot: snap.exerciseNameSnapshot,
      muscleGroupSnapshot: snap.muscleGroupSnapshot,
    });
    return inserted.id;
  },

  async deletePerformedExercise(conn, id) {
    await performedWorkoutExerciseRepo.deletePerformedExercise(conn, id);
  },

  async recordSet(conn, args: RecordSetInput): Promise<PerformedWorkoutSet> {
    assertValidReps(args.reps);
    assertValidWeightKg(args.weightKg);
    return performedWorkoutSetRepo.insertPerformedSet(conn, {
      performedExerciseId: args.performedExerciseId,
      reps: args.reps,
      weightKg: args.weightKg,
      completed: false,
    });
  },

  async updateSet(conn, args) {
    assertValidReps(args.reps);
    assertValidWeightKg(args.weightKg);
    const existing = await performedWorkoutSetRepo.findPerformedSetById(conn, args.id);
    if (!existing) {
      throw new Error(`updateSet: set ${args.id} not found`);
    }
    const updated: PerformedWorkoutSet = {
      ...existing,
      reps: args.reps,
      weightKg: args.weightKg,
      completed: args.completed,
    };
    await performedWorkoutSetRepo.updatePerformedSet(conn, updated);
  },

  async deleteSet(conn, id) {
    await performedWorkoutSetRepo.deletePerformedSet(conn, id);
  },

  async markSetCompleted(conn, args) {
    await performedWorkoutSetRepo.markPerformedSetCompleted(conn, args.id, args.completed);
  },

  // ----- History comparison ---------------------------------------------

  async getExerciseComparison(conn, args): Promise<PerformedSetComparison> {
    // Pull every performed set for this canonical exercise. The repo walks
    // through `performed_workout_exercise` first because the dev stub does
    // not model subqueries — we accept the extra round-trip.
    const allSets = await performedWorkoutSetRepo.listAllPerformedSetsByExercise(
      conn,
      args.exerciseId,
    );
    if (allSets.length === 0) {
      return {
        exerciseId: args.exerciseId,
        exerciseName: args.exerciseId,
        currentSets: [],
        previousSets: null,
        progression: { weightDeltaKg: null, repsDelta: null, volumeDeltaKg: null },
        recordWeightKg: null,
        recordWeightReps: null,
      };
    }

    // Group sets by their parent `performed_workout_id` so we can pick the
    // two most-recent completed workouts (per-exercise). The dev stub's
    // set ordering is `performed_exercise_id ASC, position ASC`; descending
    // by `performed_exercise_id` is therefore a chronological proxy.
    const groupedByWorkout = new Map<number, PerformedWorkoutSet[]>();
    for (const set of allSets) {
      // Fetch the parent performed_exercise → performed_workout_id.
      const pe = await performedWorkoutExerciseRepo.findPerformedExerciseById(
        conn,
        set.performedExerciseId,
      );
      if (!pe) continue;
      const list = groupedByWorkout.get(pe.performedWorkoutId) ?? [];
      list.push(set);
      groupedByWorkout.set(pe.performedWorkoutId, list);
    }

    // Sort workouts by their most-recent performed_exercise id descending
    // (auto-increment monotonic; same proxy as the repo's ordering).
    const sortedWorkoutIds = Array.from(groupedByWorkout.keys()).sort((a, b) => b - a);
    const currentWorkoutId = sortedWorkoutIds[0];
    const previousWorkoutId = sortedWorkoutIds[1];
    if (currentWorkoutId === undefined) {
      throw new Error('getExerciseComparison: unreachable — no current workout');
    }
    const currentSets = groupedByWorkout.get(currentWorkoutId) ?? [];
    const previousSets =
      previousWorkoutId !== undefined ? (groupedByWorkout.get(previousWorkoutId) ?? null) : null;

    const progression = progressionSummary(null, previousSets ?? [], currentSets);

    const recordSet = bestSetByWeight(allSets);
    const exerciseName = await exerciseDisplayName(
      conn,
      args.exerciseId,
      args.exerciseId,
      args.locale,
    );

    return {
      exerciseId: args.exerciseId,
      exerciseName,
      currentSets: currentSets.map((s) => ({ reps: s.reps, weightKg: s.weightKg })),
      previousSets:
        previousSets === null
          ? null
          : previousSets.map((s) => ({ reps: s.reps, weightKg: s.weightKg })),
      progression,
      recordWeightKg: recordSet?.weightKg ?? null,
      recordWeightReps: recordSet?.reps ?? null,
    };
  },

  // ----- Recompute helpers ----------------------------------------------

  async getPerformedWorkout(conn, id) {
    const performedWorkout = await performedWorkoutRepo.findPerformedWorkoutById(conn, id);
    if (!performedWorkout) return null;
    return hydratePerformedWorkout(conn, performedWorkout);
  },
};
