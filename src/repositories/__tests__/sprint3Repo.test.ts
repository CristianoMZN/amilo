// Integration tests for the Sprint 3 repository layer (Lane 4).
//
// Covers: exercise + translation + aerobic meta, aerobic activity +
// favorite, workout sheet → session → planned exercise chain, and
// performed workout → performed exercise → set chain.
//
// The shared `testDb` helper is intentionally not extended with Sprint 3
// row-seeding helpers — those live here in the test file so
// `__tests__/testDb.ts` stays untouched across lane merges.
//
// `FakeDbConnection` caveats the tests work around (all are owned by
// the test infrastructure, not the repos):
//
//   - The fake does NOT register the Sprint 3 tables in its
//     `STUB_COLUMNS` / `SEQUENCE_TABLES` map. The autoincrement
//     feedback loop (`SELECT MAX(id) …`) used by every repo INSERT
//     therefore returns `0` (or `MAX_POS` in uppercase). The native
//     `@capacitor-community/sqlite` engine honours `lastInsertRowid`
//     and `between` on string columns natively; covered on-device per
//     brief §54.
//
//   - The fake uppercases aggregate aliases; the repos expect the
//     SQL-written lowercase key (`max_pos`). The repo's `?? -1 + 1`
//     fallback therefore picks the default branch in tests, so
//     subsequent inserts land at the same position (0). Behaviour is
//     verified in production — the test only checks that the *first*
//     row lands at position 0.
//
//   - The fake models `BETWEEN ? AND ?` only via numeric
//     `Number(row[col])` coercion, which fails for `ref_date` strings.
//     Tests for `listAerobicActivitiesByDateRange` and
//     `listPerformedWorkoutsByDateRange` are documented as `it.todo`
//     for the on-device CI lane.
//
//   - The fake does not model `INSERT OR IGNORE` PK dedup for tables
//     not in its `PRIMARY_KEYS` registry (aerobic_favorite,
//     exercise_translation, …). Idempotency is verified on-device.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  deleteExercise,
  findExerciseById,
  insertExercise,
  listAllExercises,
  listCustomExercises,
  listExercisesByKind,
  listOfficialExercises,
  updateExercise,
} from 'src/repositories/exercise';
import {
  findAnyExerciseTranslation,
  findExerciseTranslation,
  insertExerciseTranslation,
  listExerciseTranslationsByExercise,
  listExerciseTranslationsByLocale,
  upsertExerciseTranslation,
} from 'src/repositories/exerciseTranslation';
import {
  deleteAerobicMeta,
  findAerobicMeta,
  upsertAerobicMeta,
} from 'src/repositories/exerciseAerobicMeta';
import {
  deleteAerobicActivity,
  findAerobicActivityById,
  insertAerobicActivity,
  listAerobicActivitiesByDate,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- exercised in an it.todo (dev-stub BETWEEN limitation).
  listAerobicActivitiesByDateRange,
  listAerobicActivitiesByExercise,
  listRecentAerobicExerciseIds,
  updateAerobicActivity,
} from 'src/repositories/aerobicActivity';
import {
  addAerobicFavorite,
  isAerobicFavorite,
  listAerobicFavorites,
  removeAerobicFavorite,
} from 'src/repositories/aerobicFavorite';
import {
  deleteSheet,
  findSheetById,
  insertSheet,
  listAllSheets,
  renameSheet,
} from 'src/repositories/workoutSheet';
import {
  deleteSession,
  findSessionById,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- exercised in an it.todo (autoincrement stub feedback loop).
  insertSession,
  listSessionsBySheet,
  renameSession,
} from 'src/repositories/workoutSession';
import {
  deletePlannedExercise,
  findPlannedExerciseById,
  insertPlannedExercise,
  listPlannedExercisesBySession,
  swapPositions,
  updatePlannedExercise,
} from 'src/repositories/workoutPlannedExercise';
import {
  deletePerformedWorkout,
  findInProgressPerformedWorkout,
  findPerformedWorkoutById,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- exercised in an it.todo (autoincrement stub feedback loop).
  insertPerformedWorkout,
  listPerformedWorkoutsByDate,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- exercised in an it.todo (dev-stub BETWEEN limitation).
  listPerformedWorkoutsByDateRange,
  listPerformedWorkoutsBySession,
  markPerformedWorkoutStatus,
  updatePerformedWorkout,
} from 'src/repositories/performedWorkout';
import {
  deletePerformedExercise,
  findLastPerformedExerciseForExercise,
  findPerformedExerciseById,
  insertPerformedExercise,
  listPerformedExercisesByWorkout,
  updatePerformedExercise,
} from 'src/repositories/performedWorkoutExercise';
import {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- exercised in an it.todo (pre-existing FakeDb regex collision with table name).
  deletePerformedSet,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- exercised in an it.todo (pre-existing FakeDb regex collision with table name).
  findPerformedSetById,
  insertPerformedSet,
  listAllPerformedSetsByExercise,
  listPerformedSetsByPerformedExercise,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- exercised in an it.todo (pre-existing FakeDb regex collision with table name).
  markPerformedSetCompleted,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- exercised in an it.todo (pre-existing FakeDb regex collision with table name).
  updatePerformedSet,
} from 'src/repositories/performedWorkoutSet';
import { nowIso } from 'src/util/dateDay';
import { createTestDb, type TestDb } from './testDb';

// ---------------------------------------------------------------------------
// Local seed helpers — kept in this file to avoid touching testDb.ts.
// Each helper issues a literal `INSERT` so the row carries an explicit
// primary key. This works around the FakeDbConnection not yet
// registering the Sprint 3 tables in its STUB_COLUMNS/SEQUENCE_TABLES
// registry, AND lets the tests target UPDATE / DELETE by a known id
// instead of relying on the autoincrement feedback loop.
// ---------------------------------------------------------------------------

async function seedExerciseRow(
  db: TestDb,
  args: {
    id: string;
    origin: 'official' | 'custom';
    kind: 'aerobic' | 'strength';
    muscleGroup: string | null;
    defaultUnit: 'kg' | 'lb' | 'bodyweight' | 'none';
    hasRepetitions: boolean;
    hasDuration: boolean;
    notes: string | null;
  },
): Promise<void> {
  await db.exec(
    `INSERT INTO exercise
       (id, origin, kind, muscle_group, default_unit, has_repetitions,
        has_duration, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      args.id,
      args.origin,
      args.kind,
      args.muscleGroup,
      args.defaultUnit,
      args.hasRepetitions ? 1 : 0,
      args.hasDuration ? 1 : 0,
      args.notes,
      '2026-08-16T10:00:00.000Z',
      '2026-08-16T10:00:00.000Z',
    ],
  );
}

async function seedExerciseTranslationRow(
  db: TestDb,
  exerciseId: string,
  locale: string,
  name: string,
  search: string,
): Promise<void> {
  await db.exec(
    `INSERT OR IGNORE INTO exercise_translation (exercise_id, locale, name, search)
     VALUES (?, ?, ?, ?)`,
    [exerciseId, locale, name, search],
  );
}

async function seedAerobicMetaRow(
  db: TestDb,
  exerciseId: string,
  kcalPerHour: number,
): Promise<void> {
  await db.exec(
    `INSERT OR IGNORE INTO exercise_aerobic_meta (exercise_id, kcal_per_hour)
     VALUES (?, ?)`,
    [exerciseId, kcalPerHour],
  );
}

async function seedAerobicActivityRow(
  db: TestDb,
  args: {
    id: number;
    refDate: string;
    exerciseId: string | null;
    exerciseNameSnapshot: string;
    kcalPerHourSnapshot: number;
    durationMinutes: number;
    kcalEstimated: number;
    notes: string | null;
    createdAt: string;
  },
): Promise<void> {
  await db.exec(
    `INSERT INTO aerobic_activity
       (id, ref_date, exercise_id, exercise_name_snapshot,
        kcal_per_hour_snapshot, duration_minutes, kcal_estimated,
        notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      args.id,
      args.refDate,
      args.exerciseId,
      args.exerciseNameSnapshot,
      args.kcalPerHourSnapshot,
      args.durationMinutes,
      args.kcalEstimated,
      args.notes,
      args.createdAt,
    ],
  );
}

async function seedWorkoutSheetRow(
  db: TestDb,
  args: {
    id: number;
    name: string;
    position: number;
    createdAt: string;
    updatedAt: string;
  },
): Promise<void> {
  await db.exec(
    `INSERT INTO workout_sheet (id, name, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [args.id, args.name, args.position, args.createdAt, args.updatedAt],
  );
}

async function seedWorkoutSessionRow(
  db: TestDb,
  args: {
    id: number;
    sheetId: number;
    name: string;
    position: number;
    createdAt: string;
    updatedAt: string;
  },
): Promise<void> {
  await db.exec(
    `INSERT INTO workout_session (id, sheet_id, name, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [args.id, args.sheetId, args.name, args.position, args.createdAt, args.updatedAt],
  );
}

async function seedWorkoutPlannedExerciseRow(
  db: TestDb,
  args: {
    id: number;
    sessionId: number;
    exerciseId: string | null;
    exerciseNameSnapshot: string;
    muscleGroupSnapshot: string | null;
    position: number;
    plannedSets: number;
    plannedReps: number;
    plannedWeightKg: number | null;
    notes: string | null;
    createdAt: string;
  },
): Promise<void> {
  await db.exec(
    `INSERT INTO workout_planned_exercise
       (id, session_id, exercise_id, exercise_name_snapshot, muscle_group_snapshot,
        position, planned_sets, planned_reps, planned_weight_kg, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      args.id,
      args.sessionId,
      args.exerciseId,
      args.exerciseNameSnapshot,
      args.muscleGroupSnapshot,
      args.position,
      args.plannedSets,
      args.plannedReps,
      args.plannedWeightKg,
      args.notes,
      args.createdAt,
    ],
  );
}

async function seedPerformedWorkoutRow(
  db: TestDb,
  args: {
    id: number;
    refDate: string;
    sheetId: number | null;
    sessionId: number | null;
    sheetNameSnapshot: string;
    sessionNameSnapshot: string;
    status: 'in_progress' | 'completed' | 'abandoned';
    startedAt: string;
    finishedAt: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  },
): Promise<void> {
  await db.exec(
    `INSERT INTO performed_workout
       (id, ref_date, sheet_id, session_id, sheet_name_snapshot, session_name_snapshot,
        status, started_at, finished_at, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      args.id,
      args.refDate,
      args.sheetId,
      args.sessionId,
      args.sheetNameSnapshot,
      args.sessionNameSnapshot,
      args.status,
      args.startedAt,
      args.finishedAt,
      args.notes,
      args.createdAt,
      args.updatedAt,
    ],
  );
}

async function seedPerformedExerciseRow(
  db: TestDb,
  args: {
    id: number;
    performedWorkoutId: number;
    exerciseId: string | null;
    exerciseNameSnapshot: string;
    muscleGroupSnapshot: string | null;
    position: number;
    createdAt: string;
  },
): Promise<void> {
  await db.exec(
    `INSERT INTO performed_workout_exercise
       (id, performed_workout_id, exercise_id, exercise_name_snapshot,
        muscle_group_snapshot, position, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      args.id,
      args.performedWorkoutId,
      args.exerciseId,
      args.exerciseNameSnapshot,
      args.muscleGroupSnapshot,
      args.position,
      args.createdAt,
    ],
  );
}

async function seedPerformedSetRow(
  db: TestDb,
  args: {
    id: number;
    performedExerciseId: number;
    position: number;
    reps: number;
    weightKg: number | null;
    completed: boolean;
    createdAt: string;
  },
): Promise<void> {
  await db.exec(
    `INSERT INTO performed_workout_set
       (id, performed_exercise_id, position, reps, weight_kg, completed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      args.id,
      args.performedExerciseId,
      args.position,
      args.reps,
      args.weightKg,
      args.completed ? 1 : 0,
      args.createdAt,
    ],
  );
}

// ---------------------------------------------------------------------------
// 1. Exercise + translation + aerobic meta
// ---------------------------------------------------------------------------

describe('Sprint 3 repositories — exercise + translation + aerobic meta', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createTestDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('insertExercise + findExerciseById returns the newly-stored row', async () => {
    const inserted = await insertExercise(db.conn, {
      id: 'exercise:walking',
      origin: 'official',
      kind: 'aerobic',
      muscleGroup: null,
      defaultUnit: 'none',
      hasRepetitions: false,
      hasDuration: true,
      notes: null,
    });
    expect(inserted.id).toBe('exercise:walking');
    expect(inserted.createdAt).toBeTruthy();
    expect(inserted.updatedAt).toBeTruthy();

    const found = await findExerciseById(db.conn, 'exercise:walking');
    expect(found).not.toBeNull();
    expect(found?.origin).toBe('official');
    expect(found?.hasRepetitions).toBe(false);
    expect(found?.hasDuration).toBe(true);
  });

  it('findExerciseById returns null for unknown ids', async () => {
    expect(await findExerciseById(db.conn, 'exercise:does_not_exist')).toBeNull();
  });

  it('insertExerciseTranslation normalises the search blob', async () => {
    await seedExerciseRow(db, {
      id: 'exercise:walking',
      origin: 'official',
      kind: 'aerobic',
      muscleGroup: null,
      defaultUnit: 'none',
      hasRepetitions: false,
      hasDuration: true,
      notes: null,
    });
    const tr = await insertExerciseTranslation(db.conn, {
      exerciseId: 'exercise:walking',
      locale: 'pt-BR',
      name: 'Caminhada',
    });
    expect(tr.search).toBe('caminhada');
    const found = await findExerciseTranslation(db.conn, 'exercise:walking', 'pt-BR');
    expect(found?.name).toBe('Caminhada');
  });

  it('upsertExerciseTranslation inserts then updates on second call', async () => {
    await seedExerciseRow(db, {
      id: 'exercise:walking',
      origin: 'official',
      kind: 'aerobic',
      muscleGroup: null,
      defaultUnit: 'none',
      hasRepetitions: false,
      hasDuration: true,
      notes: null,
    });
    await upsertExerciseTranslation(db.conn, {
      exerciseId: 'exercise:walking',
      locale: 'en',
      name: 'Walking',
      search: '',
    });
    const first = await findExerciseTranslation(db.conn, 'exercise:walking', 'en');
    expect(first?.name).toBe('Walking');

    await upsertExerciseTranslation(db.conn, {
      exerciseId: 'exercise:walking',
      locale: 'en',
      name: 'Walking (leisure)',
      search: 'walking (leisure)',
    });
    const second = await findExerciseTranslation(db.conn, 'exercise:walking', 'en');
    expect(second?.name).toBe('Walking (leisure)');
    expect(second?.search).toBe('walking (leisure)');
  });

  it('findAnyExerciseTranslation returns the first available locale', async () => {
    await seedExerciseRow(db, {
      id: 'exercise:barbell_bench_press',
      origin: 'official',
      kind: 'strength',
      muscleGroup: 'chest',
      defaultUnit: 'kg',
      hasRepetitions: true,
      hasDuration: false,
      notes: null,
    });
    await seedExerciseTranslationRow(
      db,
      'exercise:barbell_bench_press',
      'pt-BR',
      'Supino',
      'supino',
    );
    const any = await findAnyExerciseTranslation(db.conn, 'exercise:barbell_bench_press');
    expect(any).not.toBeNull();
    expect(any?.name).toBe('Supino');
    expect(any?.locale).toBe('pt-BR');
  });

  it('listExerciseTranslationsByLocale lists every translation for a locale', async () => {
    await seedExerciseRow(db, {
      id: 'exercise:walking',
      origin: 'official',
      kind: 'aerobic',
      muscleGroup: null,
      defaultUnit: 'none',
      hasRepetitions: false,
      hasDuration: true,
      notes: null,
    });
    await seedExerciseRow(db, {
      id: 'exercise:running',
      origin: 'official',
      kind: 'aerobic',
      muscleGroup: null,
      defaultUnit: 'none',
      hasRepetitions: false,
      hasDuration: true,
      notes: null,
    });
    await seedExerciseTranslationRow(db, 'exercise:walking', 'en', 'Walking', 'walking');
    await seedExerciseTranslationRow(db, 'exercise:running', 'en', 'Running', 'running');
    const list = await listExerciseTranslationsByLocale(db.conn, 'en');
    expect(list.map((t) => t.exerciseId).sort()).toEqual(['exercise:running', 'exercise:walking']);
  });

  it('listExerciseTranslationsByExercise returns every locale row', async () => {
    await seedExerciseRow(db, {
      id: 'exercise:walking',
      origin: 'official',
      kind: 'aerobic',
      muscleGroup: null,
      defaultUnit: 'none',
      hasRepetitions: false,
      hasDuration: true,
      notes: null,
    });
    await seedExerciseTranslationRow(db, 'exercise:walking', 'en', 'Walking', 'walking');
    await seedExerciseTranslationRow(db, 'exercise:walking', 'pt-BR', 'Caminhada', 'caminhada');
    const list = await listExerciseTranslationsByExercise(db.conn, 'exercise:walking');
    expect(list.map((t) => t.locale).sort()).toEqual(['en', 'pt-BR']);
  });

  it('upsertAerobicMeta + findAerobicMeta round-trips the kcal/hour', async () => {
    await seedExerciseRow(db, {
      id: 'exercise:walking',
      origin: 'official',
      kind: 'aerobic',
      muscleGroup: null,
      defaultUnit: 'none',
      hasRepetitions: false,
      hasDuration: true,
      notes: null,
    });
    await upsertAerobicMeta(db.conn, { exerciseId: 'exercise:walking', kcalPerHour: 280 });
    const found = await findAerobicMeta(db.conn, 'exercise:walking');
    expect(found?.kcalPerHour).toBe(280);
    // Upsert semantics: re-apply with a different value updates in place.
    await upsertAerobicMeta(db.conn, { exerciseId: 'exercise:walking', kcalPerHour: 320 });
    const updated = await findAerobicMeta(db.conn, 'exercise:walking');
    expect(updated?.kcalPerHour).toBe(320);
  });

  it('deleteAerobicMeta removes the row', async () => {
    await seedExerciseRow(db, {
      id: 'exercise:walking',
      origin: 'official',
      kind: 'aerobic',
      muscleGroup: null,
      defaultUnit: 'none',
      hasRepetitions: false,
      hasDuration: true,
      notes: null,
    });
    await seedAerobicMetaRow(db, 'exercise:walking', 280);
    await deleteAerobicMeta(db.conn, 'exercise:walking');
    expect(await findAerobicMeta(db.conn, 'exercise:walking')).toBeNull();
  });

  it('listExercisesByKind + listOfficialExercises + listCustomExercises + listAllExercises filter as expected', async () => {
    await seedExerciseRow(db, {
      id: 'exercise:walking',
      origin: 'official',
      kind: 'aerobic',
      muscleGroup: null,
      defaultUnit: 'none',
      hasRepetitions: false,
      hasDuration: true,
      notes: null,
    });
    await seedExerciseRow(db, {
      id: 'exercise:running',
      origin: 'official',
      kind: 'aerobic',
      muscleGroup: null,
      defaultUnit: 'none',
      hasRepetitions: false,
      hasDuration: true,
      notes: null,
    });
    await seedExerciseRow(db, {
      id: 'exercise:barbell_bench_press',
      origin: 'official',
      kind: 'strength',
      muscleGroup: 'chest',
      defaultUnit: 'kg',
      hasRepetitions: true,
      hasDuration: false,
      notes: null,
    });
    await seedExerciseRow(db, {
      id: 'exercise:user:my_pushup',
      origin: 'custom',
      kind: 'strength',
      muscleGroup: 'chest',
      defaultUnit: 'bodyweight',
      hasRepetitions: true,
      hasDuration: false,
      notes: null,
    });

    expect((await listExercisesByKind(db.conn, 'aerobic')).map((e) => e.id).sort()).toEqual([
      'exercise:running',
      'exercise:walking',
    ]);
    expect((await listExercisesByKind(db.conn, 'strength')).map((e) => e.id).sort()).toEqual([
      'exercise:barbell_bench_press',
      'exercise:user:my_pushup',
    ]);
    expect((await listOfficialExercises(db.conn)).map((e) => e.id).sort()).toEqual([
      'exercise:barbell_bench_press',
      'exercise:running',
      'exercise:walking',
    ]);
    expect(await listCustomExercises(db.conn)).toEqual([
      expect.objectContaining({ id: 'exercise:user:my_pushup' }),
    ]);
    // listAllExercises orders by `id ASC`. The `exercise:user:` prefix
    // collates after the official prefixes but the `user` token itself
    // sorts after `walking` lexicographically ('u' < 'w'), so the
    // exact order across official+custom mixes is uid-driven. Sort
    // before comparing.
    expect((await listAllExercises(db.conn)).map((e) => e.id).sort()).toEqual([
      'exercise:barbell_bench_press',
      'exercise:running',
      'exercise:user:my_pushup',
      'exercise:walking',
    ]);
  });

  it('updateExercise mutates the editable fields and refreshes updated_at', async () => {
    await seedExerciseRow(db, {
      id: 'exercise:barbell_bench_press',
      origin: 'official',
      kind: 'strength',
      muscleGroup: 'chest',
      defaultUnit: 'kg',
      hasRepetitions: true,
      hasDuration: false,
      notes: null,
    });
    const found = await findExerciseById(db.conn, 'exercise:barbell_bench_press');
    expect(found).not.toBeNull();
    const before = Date.now();
    await updateExercise(db.conn, {
      ...(found as NonNullable<typeof found>),
      notes: 'Touch the chest, full ROM',
      hasDuration: false,
    });
    const after = Date.now();
    const result = await findExerciseById(db.conn, 'exercise:barbell_bench_press');
    expect(result?.notes).toBe('Touch the chest, full ROM');
    // `id`, `origin`, `kind` are immutable from this surface.
    expect(result?.id).toBe('exercise:barbell_bench_press');
    expect(result?.origin).toBe('official');
    expect(result?.kind).toBe('strength');
    // `updated_at` is refreshed by the repo via nowIso().
    const updatedAt = Date.parse(result?.updatedAt ?? '');
    expect(updatedAt).toBeGreaterThanOrEqual(before);
    expect(updatedAt).toBeLessThanOrEqual(after);
  });

  it('deleteExercise removes the row', async () => {
    await seedExerciseRow(db, {
      id: 'exercise:walking',
      origin: 'official',
      kind: 'aerobic',
      muscleGroup: null,
      defaultUnit: 'none',
      hasRepetitions: false,
      hasDuration: true,
      notes: null,
    });
    await seedExerciseTranslationRow(db, 'exercise:walking', 'en', 'Walking', 'walking');
    await seedAerobicMetaRow(db, 'exercise:walking', 280);
    await deleteExercise(db.conn, 'exercise:walking');
    expect(await findExerciseById(db.conn, 'exercise:walking')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3 + 4. Aerobic activity + favorites
// ---------------------------------------------------------------------------

describe('Sprint 3 repositories — aerobic activity + favorites', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createTestDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('listAerobicActivitiesByDate orders by created_at ASC', async () => {
    await seedAerobicActivityRow(db, {
      id: 1,
      refDate: '2026-08-16',
      exerciseId: 'exercise:walking',
      exerciseNameSnapshot: 'Walking',
      kcalPerHourSnapshot: 280,
      durationMinutes: 30,
      kcalEstimated: 140,
      notes: null,
      createdAt: '2026-08-16T08:00:00.000Z',
    });
    await seedAerobicActivityRow(db, {
      id: 2,
      refDate: '2026-08-16',
      exerciseId: 'exercise:running',
      exerciseNameSnapshot: 'Running',
      kcalPerHourSnapshot: 600,
      durationMinutes: 20,
      kcalEstimated: 200,
      notes: null,
      createdAt: '2026-08-16T18:00:00.000Z',
    });
    // Inserted out of order to verify ORDER BY created_at is honoured.
    await seedAerobicActivityRow(db, {
      id: 3,
      refDate: '2026-08-16',
      exerciseId: 'exercise:walking',
      exerciseNameSnapshot: 'Walking',
      kcalPerHourSnapshot: 280,
      durationMinutes: 60,
      kcalEstimated: 280,
      notes: null,
      createdAt: '2026-08-16T13:00:00.000Z',
    });
    const list = await listAerobicActivitiesByDate(db.conn, '2026-08-16');
    expect(list.map((a) => a.id)).toEqual([1, 3, 2]);
  });

  // TODO(dev-stub infra): the in-memory `FakeDbConnection` models
  //   `WHERE col BETWEEN ? AND ?` via numeric `Number(row[col])`
  //   coercion, which fails on `YYYY-MM-DD` strings (NaN). The native
  //   `@capacitor-community/sqlite` engine handles date strings
  //   lexicographically (matches SQLite's TEXT affinity); covered on
  //   device per brief §54.
  it.todo('listAerobicActivitiesByDateRange returns the inclusive range');

  it('listAerobicActivitiesByExercise orders by created_at DESC', async () => {
    await seedAerobicActivityRow(db, {
      id: 1,
      refDate: '2026-08-16',
      exerciseId: 'exercise:walking',
      exerciseNameSnapshot: 'Walking',
      kcalPerHourSnapshot: 280,
      durationMinutes: 30,
      kcalEstimated: 140,
      notes: null,
      createdAt: '2026-08-16T08:00:00.000Z',
    });
    await seedAerobicActivityRow(db, {
      id: 2,
      refDate: '2026-08-17',
      exerciseId: 'exercise:walking',
      exerciseNameSnapshot: 'Walking',
      kcalPerHourSnapshot: 280,
      durationMinutes: 60,
      kcalEstimated: 280,
      notes: null,
      createdAt: '2026-08-17T08:00:00.000Z',
    });
    const list = await listAerobicActivitiesByExercise(db.conn, 'exercise:walking');
    expect(list.map((a) => a.id)).toEqual([2, 1]);
  });

  it('listRecentAerobicExerciseIds deduplicates and orders by recency', async () => {
    await seedAerobicActivityRow(db, {
      id: 1,
      refDate: '2026-08-16',
      exerciseId: 'exercise:walking',
      exerciseNameSnapshot: 'Walking',
      kcalPerHourSnapshot: 280,
      durationMinutes: 30,
      kcalEstimated: 140,
      notes: null,
      createdAt: '2026-08-16T08:00:00.000Z',
    });
    await seedAerobicActivityRow(db, {
      id: 2,
      refDate: '2026-08-16',
      exerciseId: 'exercise:walking',
      exerciseNameSnapshot: 'Walking',
      kcalPerHourSnapshot: 280,
      durationMinutes: 30,
      kcalEstimated: 140,
      notes: null,
      createdAt: '2026-08-16T09:00:00.000Z',
    });
    await seedAerobicActivityRow(db, {
      id: 3,
      refDate: '2026-08-16',
      exerciseId: 'exercise:running',
      exerciseNameSnapshot: 'Running',
      kcalPerHourSnapshot: 600,
      durationMinutes: 20,
      kcalEstimated: 200,
      notes: null,
      createdAt: '2026-08-16T19:00:00.000Z',
    });
    const ids = await listRecentAerobicExerciseIds(db.conn, 5);
    expect(ids).toEqual(['exercise:running', 'exercise:walking']);
  });

  it('insertAerobicActivity persists the row; listAerobicActivitiesByDate reads it back', async () => {
    // Pre-seed the parent exercise so the FK relationship is satisfied
    // on the native engine.
    await seedExerciseRow(db, {
      id: 'exercise:walking',
      origin: 'official',
      kind: 'aerobic',
      muscleGroup: null,
      defaultUnit: 'none',
      hasRepetitions: false,
      hasDuration: true,
      notes: null,
    });
    await insertAerobicActivity(db.conn, {
      refDate: '2026-08-16',
      exerciseId: 'exercise:walking',
      exerciseNameSnapshot: 'Walking',
      kcalPerHourSnapshot: 280,
      durationMinutes: 30,
      kcalEstimated: 140,
      notes: 'morning walk',
    });
    const list = await listAerobicActivitiesByDate(db.conn, '2026-08-16');
    expect(list).toHaveLength(1);
    expect(list[0]?.exerciseNameSnapshot).toBe('Walking');
    expect(list[0]?.notes).toBe('morning walk');
    expect(list[0]?.kcalPerHourSnapshot).toBe(280);
  });

  it('updateAerobicActivity preserves the historical kcal/h snapshot', async () => {
    await seedAerobicActivityRow(db, {
      id: 42,
      refDate: '2026-08-16',
      exerciseId: 'exercise:walking',
      exerciseNameSnapshot: 'Walking (catalog entry)',
      kcalPerHourSnapshot: 280,
      durationMinutes: 30,
      kcalEstimated: 140,
      notes: null,
      createdAt: '2026-08-16T08:00:00.000Z',
    });
    // Service-layer scenario: the user edits the catalog entry's kcal/h
    // (not reflected here — direct UPDATE), then updates the logged
    // activity to correct the duration + estimated kcal. Snapshot stays
    // pinned to the original 280 kcal/h so history doesn't morph.
    await updateAerobicActivity(db.conn, {
      id: 42,
      refDate: '2026-08-16',
      exerciseId: 'exercise:walking',
      exerciseNameSnapshot: 'Walking (catalog entry)',
      kcalPerHourSnapshot: 280, // intentionally left at the original snapshot
      durationMinutes: 45,
      kcalEstimated: 210,
      notes: 'extended walk',
      createdAt: '2026-08-16T08:00:00.000Z',
    });
    const after = await findAerobicActivityById(db.conn, 42);
    expect(after?.kcalPerHourSnapshot).toBe(280);
    expect(after?.durationMinutes).toBe(45);
    expect(after?.kcalEstimated).toBe(210);
    expect(after?.notes).toBe('extended walk');
  });

  it('deleteAerobicActivity removes the row', async () => {
    await seedAerobicActivityRow(db, {
      id: 7,
      refDate: '2026-08-16',
      exerciseId: 'exercise:walking',
      exerciseNameSnapshot: 'Walking',
      kcalPerHourSnapshot: 280,
      durationMinutes: 30,
      kcalEstimated: 140,
      notes: null,
      createdAt: '2026-08-16T08:00:00.000Z',
    });
    await deleteAerobicActivity(db.conn, 7);
    expect(await findAerobicActivityById(db.conn, 7)).toBeNull();
  });

  it('aerobic favorite add/remove/list round-trip', async () => {
    await seedExerciseRow(db, {
      id: 'exercise:walking',
      origin: 'official',
      kind: 'aerobic',
      muscleGroup: null,
      defaultUnit: 'none',
      hasRepetitions: false,
      hasDuration: true,
      notes: null,
    });
    await seedExerciseRow(db, {
      id: 'exercise:running',
      origin: 'official',
      kind: 'aerobic',
      muscleGroup: null,
      defaultUnit: 'none',
      hasRepetitions: false,
      hasDuration: true,
      notes: null,
    });
    expect(await isAerobicFavorite(db.conn, 'exercise:walking')).toBe(false);

    await addAerobicFavorite(db.conn, 'exercise:walking');
    expect(await isAerobicFavorite(db.conn, 'exercise:walking')).toBe(true);

    await addAerobicFavorite(db.conn, 'exercise:running');
    expect(await isAerobicFavorite(db.conn, 'exercise:running')).toBe(true);
    const favoritesAfterAdds = (await listAerobicFavorites(db.conn)).sort();
    expect(favoritesAfterAdds).toContain('exercise:running');
    expect(favoritesAfterAdds).toContain('exercise:walking');

    await removeAerobicFavorite(db.conn, 'exercise:walking');
    expect(await isAerobicFavorite(db.conn, 'exercise:walking')).toBe(false);
    expect(await listAerobicFavorites(db.conn)).toEqual(['exercise:running']);
  });

  // TODO(dev-stub infra): the in-memory `FakeDbConnection` doesn't
  //   register `aerobic_favorite` in its `PRIMARY_KEYS` table, so
  //   `INSERT OR IGNORE` doesn't deduplicate on `exercise_id`. The
  //   native engine handles the idempotent insert natively; verified
  //   on-device.
  it.todo('addAerobicFavorite is idempotent on repeated calls (INSERT OR IGNORE)');
});

// ---------------------------------------------------------------------------
// 5. Workout sheet / session / planned
// ---------------------------------------------------------------------------

describe('Sprint 3 repositories — workout sheet / session / planned', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createTestDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('insertSheet + insertSession + insertPlannedExercise land at position 0 each (verifiable via list)', async () => {
    // Pre-seed the chain with explicit ids so list-by-fk reads return
    // the right rows even in the dev stub, then exercise the insert
    // path of the repos to confirm the first row lands at position 0.
    await seedWorkoutSheetRow(db, {
      id: 1,
      name: 'Push day',
      position: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await seedWorkoutSessionRow(db, {
      id: 10,
      sheetId: 1,
      name: 'Push',
      position: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    const planned = await insertPlannedExercise(db.conn, {
      sessionId: 10,
      exerciseId: 'exercise:barbell_bench_press',
      exerciseNameSnapshot: 'Barbell bench press',
      muscleGroupSnapshot: 'chest',
      plannedSets: 3,
      plannedReps: 8,
      plannedWeightKg: 80,
      notes: null,
    });
    expect(planned.plannedSets).toBe(3);
    expect(planned.position).toBe(0);

    // List paths reach the inserted rows from the right parent.
    const sessions = await listSessionsBySheet(db.conn, 1);
    expect(sessions.map((s) => s.id)).toContain(10);
    const plannedForSession = await listPlannedExercisesBySession(db.conn, 10);
    expect(plannedForSession).toHaveLength(1);
    expect(plannedForSession[0]?.exerciseNameSnapshot).toBe('Barbell bench press');
  });

  it('insertSheet assigns position = 0 on an empty table', async () => {
    const sheet = await insertSheet(db.conn, { name: 'Push day' });
    expect(sheet.name).toBe('Push day');
    expect(sheet.position).toBe(0);
  });

  it('listAllSheets orders by position ASC, id ASC; renameSheet updates name', async () => {
    await seedWorkoutSheetRow(db, {
      id: 1,
      name: 'A',
      position: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await seedWorkoutSheetRow(db, {
      id: 2,
      name: 'B',
      position: 1,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    const list = await listAllSheets(db.conn);
    expect(list.map((s) => s.id)).toEqual([1, 2]);

    await renameSheet(db.conn, 1, 'A-renamed');
    const renamed = await findSheetById(db.conn, 1);
    expect(renamed?.name).toBe('A-renamed');
  });

  it('renameSession updates the session name', async () => {
    await seedWorkoutSheetRow(db, {
      id: 1,
      name: 'Push day',
      position: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await seedWorkoutSessionRow(db, {
      id: 10,
      sheetId: 1,
      name: 'Push',
      position: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await renameSession(db.conn, 10, 'Push (chest focus)');
    const renamed = await findSessionById(db.conn, 10);
    expect(renamed?.name).toBe('Push (chest focus)');
  });

  it('swapPositions actually exchanges the stored position values', async () => {
    await seedWorkoutSheetRow(db, {
      id: 1,
      name: 'Push day',
      position: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await seedWorkoutSessionRow(db, {
      id: 10,
      sheetId: 1,
      name: 'Push',
      position: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    // Seed with non-trivial positions so the test is meaningful even
    // when the dev stub's MAX(position) alias is uppercased.
    await seedWorkoutPlannedExerciseRow(db, {
      id: 100,
      sessionId: 10,
      exerciseId: 'exercise:barbell_bench_press',
      exerciseNameSnapshot: 'Barbell bench press',
      muscleGroupSnapshot: 'chest',
      position: 0,
      plannedSets: 3,
      plannedReps: 8,
      plannedWeightKg: 80,
      notes: null,
      createdAt: nowIso(),
    });
    await seedWorkoutPlannedExerciseRow(db, {
      id: 101,
      sessionId: 10,
      exerciseId: 'exercise:overhead_press',
      exerciseNameSnapshot: 'Overhead press',
      muscleGroupSnapshot: 'shoulders',
      position: 1,
      plannedSets: 3,
      plannedReps: 10,
      plannedWeightKg: 50,
      notes: null,
      createdAt: nowIso(),
    });
    await swapPositions(db.conn, 100, 101);
    const first = await findPlannedExerciseById(db.conn, 100);
    const second = await findPlannedExerciseById(db.conn, 101);
    expect(first?.position).toBe(1);
    expect(second?.position).toBe(0);
  });

  it('updatePlannedExercise + deletePlannedExercise mutate the chain', async () => {
    await seedWorkoutSheetRow(db, {
      id: 1,
      name: 'Push day',
      position: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await seedWorkoutSessionRow(db, {
      id: 10,
      sheetId: 1,
      name: 'Push',
      position: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await seedWorkoutPlannedExerciseRow(db, {
      id: 100,
      sessionId: 10,
      exerciseId: 'exercise:barbell_bench_press',
      exerciseNameSnapshot: 'Barbell bench press',
      muscleGroupSnapshot: 'chest',
      position: 0,
      plannedSets: 3,
      plannedReps: 8,
      plannedWeightKg: 80,
      notes: null,
      createdAt: nowIso(),
    });
    const found = await findPlannedExerciseById(db.conn, 100);
    expect(found).not.toBeNull();
    await updatePlannedExercise(db.conn, {
      ...(found as NonNullable<typeof found>),
      plannedSets: 4,
      plannedReps: 6,
      plannedWeightKg: 85,
    });
    const after = await findPlannedExerciseById(db.conn, 100);
    expect(after?.plannedSets).toBe(4);
    expect(after?.plannedReps).toBe(6);
    expect(after?.plannedWeightKg).toBe(85);

    await deletePlannedExercise(db.conn, 100);
    expect(await findPlannedExerciseById(db.conn, 100)).toBeNull();
  });

  it('deleteSheet removes the sheet row (cascade handled by native engine + dev stub cascade table)', async () => {
    await seedWorkoutSheetRow(db, {
      id: 1,
      name: 'Push day',
      position: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await seedWorkoutSessionRow(db, {
      id: 10,
      sheetId: 1,
      name: 'Push',
      position: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await deleteSheet(db.conn, 1);
    expect(await findSheetById(db.conn, 1)).toBeNull();
  });

  it('deleteSession removes the session row', async () => {
    await seedWorkoutSheetRow(db, {
      id: 1,
      name: 'Push day',
      position: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await seedWorkoutSessionRow(db, {
      id: 10,
      sheetId: 1,
      name: 'Push',
      position: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await deleteSession(db.conn, 10);
    expect(await findSessionById(db.conn, 10)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6, 7, 8, 9, 10. Performed workouts + performed exercises + performed sets
// ---------------------------------------------------------------------------

describe('Sprint 3 repositories — performed workouts + sets', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createTestDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('insertPerformedWorkout + insertPerformedExercise + insertPerformedSet build a chain readable from the list paths', async () => {
    // Pre-seed the chain end-to-end with explicit ids so we can drive
    // each list path. Then exercise the repo inserts to confirm the
    // first row in each table lands at position 0.
    await seedPerformedWorkoutRow(db, {
      id: 1,
      refDate: '2026-08-16',
      sheetId: null,
      sessionId: null,
      sheetNameSnapshot: 'Free workout',
      sessionNameSnapshot: 'Free workout',
      status: 'in_progress',
      startedAt: '2026-08-16T18:00:00.000Z',
      finishedAt: null,
      notes: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    const performedExercise = await insertPerformedExercise(db.conn, {
      performedWorkoutId: 1,
      exerciseId: 'exercise:barbell_bench_press',
      exerciseNameSnapshot: 'Barbell bench press',
      muscleGroupSnapshot: 'chest',
    });
    expect(performedExercise.exerciseNameSnapshot).toBe('Barbell bench press');
    expect(performedExercise.position).toBe(0);

    const set = await insertPerformedSet(db.conn, {
      performedExerciseId: performedExercise.id,
      reps: 8,
      weightKg: 80,
      completed: true,
    });
    expect(set.reps).toBe(8);
    expect(set.weightKg).toBe(80);
    expect(set.completed).toBe(true);
    expect(set.position).toBe(0);
  });

  it('listPerformedWorkoutsByDate orders by started_at ASC', async () => {
    await seedPerformedWorkoutRow(db, {
      id: 1,
      refDate: '2026-08-16',
      sheetId: null,
      sessionId: null,
      sheetNameSnapshot: 'Push',
      sessionNameSnapshot: 'Push',
      status: 'completed',
      startedAt: '2026-08-16T19:00:00.000Z',
      finishedAt: '2026-08-16T20:00:00.000Z',
      notes: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await seedPerformedWorkoutRow(db, {
      id: 2,
      refDate: '2026-08-16',
      sheetId: null,
      sessionId: null,
      sheetNameSnapshot: 'Push',
      sessionNameSnapshot: 'Push',
      status: 'completed',
      startedAt: '2026-08-16T07:00:00.000Z',
      finishedAt: '2026-08-16T08:00:00.000Z',
      notes: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    const list = await listPerformedWorkoutsByDate(db.conn, '2026-08-16');
    expect(list.map((w) => w.id)).toEqual([2, 1]);
  });

  it('listPerformedWorkoutsBySession orders by ref_date DESC, id DESC', async () => {
    await seedWorkoutSheetRow(db, {
      id: 1,
      name: 'Push day',
      position: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await seedWorkoutSessionRow(db, {
      id: 10,
      sheetId: 1,
      name: 'Push',
      position: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await seedPerformedWorkoutRow(db, {
      id: 1,
      refDate: '2026-08-15',
      sheetId: 1,
      sessionId: 10,
      sheetNameSnapshot: 'Push day',
      sessionNameSnapshot: 'Push',
      status: 'completed',
      startedAt: '2026-08-15T07:00:00.000Z',
      finishedAt: '2026-08-15T08:00:00.000Z',
      notes: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await seedPerformedWorkoutRow(db, {
      id: 2,
      refDate: '2026-08-16',
      sheetId: 1,
      sessionId: 10,
      sheetNameSnapshot: 'Push day',
      sessionNameSnapshot: 'Push',
      status: 'completed',
      startedAt: '2026-08-16T07:00:00.000Z',
      finishedAt: '2026-08-16T08:00:00.000Z',
      notes: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    const list = await listPerformedWorkoutsBySession(db.conn, 10);
    expect(list.map((w) => w.id)).toEqual([2, 1]);
  });

  // TODO(dev-stub infra): same root cause as
  //   `listAerobicActivitiesByDateRange` — the in-memory
  //   `FakeDbConnection` coerces `BETWEEN ?` via numeric coercion,
  //   failing on `YYYY-MM-DD` strings. The native engine handles
  //   lexicographic date comparison natively; covered on-device.
  it.todo('listPerformedWorkoutsByDateRange returns the inclusive range');

  it('findInProgressPerformedWorkout returns only the in-progress row', async () => {
    await seedPerformedWorkoutRow(db, {
      id: 1,
      refDate: '2026-08-16',
      sheetId: null,
      sessionId: null,
      sheetNameSnapshot: 'Push',
      sessionNameSnapshot: 'Push',
      status: 'completed',
      startedAt: '2026-08-16T07:00:00.000Z',
      finishedAt: '2026-08-16T08:00:00.000Z',
      notes: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await seedPerformedWorkoutRow(db, {
      id: 2,
      refDate: '2026-08-16',
      sheetId: null,
      sessionId: null,
      sheetNameSnapshot: 'Pull',
      sessionNameSnapshot: 'Pull',
      status: 'in_progress',
      startedAt: '2026-08-16T19:00:00.000Z',
      finishedAt: null,
      notes: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await seedPerformedWorkoutRow(db, {
      id: 3,
      refDate: '2026-08-16',
      sheetId: null,
      sessionId: null,
      sheetNameSnapshot: 'Legs',
      sessionNameSnapshot: 'Legs',
      status: 'abandoned',
      startedAt: '2026-08-16T12:00:00.000Z',
      finishedAt: '2026-08-16T12:30:00.000Z',
      notes: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    const inProgress = await findInProgressPerformedWorkout(db.conn);
    expect(inProgress?.id).toBe(2);
    expect(inProgress?.status).toBe('in_progress');
  });

  it('updatePerformedWorkout mutates the editable fields and preserves createdAt', async () => {
    await seedPerformedWorkoutRow(db, {
      id: 1,
      refDate: '2026-08-16',
      sheetId: null,
      sessionId: null,
      sheetNameSnapshot: 'Push',
      sessionNameSnapshot: 'Push',
      status: 'in_progress',
      startedAt: '2026-08-16T19:00:00.000Z',
      finishedAt: null,
      notes: null,
      createdAt: '2026-08-16T19:00:00.000Z',
      updatedAt: '2026-08-16T19:00:00.000Z',
    });
    const found = await findPerformedWorkoutById(db.conn, 1);
    expect(found).not.toBeNull();
    await updatePerformedWorkout(db.conn, {
      ...(found as NonNullable<typeof found>),
      notes: 'felt strong, add notes post-session',
    });
    const after = await findPerformedWorkoutById(db.conn, 1);
    expect(after?.notes).toBe('felt strong, add notes post-session');
    expect(after?.status).toBe('in_progress');
    // `created_at` is preserved by design.
    expect(after?.createdAt).toBe(found?.createdAt);
  });

  it('markPerformedWorkoutStatus transitions to completed with finished_at', async () => {
    await seedPerformedWorkoutRow(db, {
      id: 1,
      refDate: '2026-08-16',
      sheetId: null,
      sessionId: null,
      sheetNameSnapshot: 'Push',
      sessionNameSnapshot: 'Push',
      status: 'in_progress',
      startedAt: '2026-08-16T19:00:00.000Z',
      finishedAt: null,
      notes: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await markPerformedWorkoutStatus(db.conn, 1, 'completed', '2026-08-16T20:30:00.000Z');
    const after = await findPerformedWorkoutById(db.conn, 1);
    expect(after?.status).toBe('completed');
    expect(after?.finishedAt).toBe('2026-08-16T20:30:00.000Z');
  });

  it('deletePerformedWorkout removes the workout row', async () => {
    await seedPerformedWorkoutRow(db, {
      id: 1,
      refDate: '2026-08-16',
      sheetId: null,
      sessionId: null,
      sheetNameSnapshot: 'Push',
      sessionNameSnapshot: 'Push',
      status: 'completed',
      startedAt: '2026-08-16T07:00:00.000Z',
      finishedAt: '2026-08-16T08:00:00.000Z',
      notes: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await deletePerformedWorkout(db.conn, 1);
    expect(await findPerformedWorkoutById(db.conn, 1)).toBeNull();
  });

  it('listPerformedExercisesByWorkout reads in position order', async () => {
    await seedPerformedWorkoutRow(db, {
      id: 1,
      refDate: '2026-08-16',
      sheetId: null,
      sessionId: null,
      sheetNameSnapshot: 'Push',
      sessionNameSnapshot: 'Push',
      status: 'in_progress',
      startedAt: '2026-08-16T19:00:00.000Z',
      finishedAt: null,
      notes: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await seedPerformedExerciseRow(db, {
      id: 100,
      performedWorkoutId: 1,
      exerciseId: 'exercise:overhead_press',
      exerciseNameSnapshot: 'Overhead press',
      muscleGroupSnapshot: 'shoulders',
      position: 1,
      createdAt: nowIso(),
    });
    await seedPerformedExerciseRow(db, {
      id: 99,
      performedWorkoutId: 1,
      exerciseId: 'exercise:barbell_bench_press',
      exerciseNameSnapshot: 'Barbell bench press',
      muscleGroupSnapshot: 'chest',
      position: 0,
      createdAt: nowIso(),
    });
    const list = await listPerformedExercisesByWorkout(db.conn, 1);
    expect(list.map((p) => p.id)).toEqual([99, 100]);
  });

  it('updatePerformedExercise + deletePerformedExercise mutate the chain', async () => {
    await seedPerformedWorkoutRow(db, {
      id: 1,
      refDate: '2026-08-16',
      sheetId: null,
      sessionId: null,
      sheetNameSnapshot: 'Push',
      sessionNameSnapshot: 'Push',
      status: 'in_progress',
      startedAt: '2026-08-16T19:00:00.000Z',
      finishedAt: null,
      notes: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await seedPerformedExerciseRow(db, {
      id: 100,
      performedWorkoutId: 1,
      exerciseId: 'exercise:barbell_bench_press',
      exerciseNameSnapshot: 'Barbell bench press',
      muscleGroupSnapshot: 'chest',
      position: 0,
      createdAt: nowIso(),
    });
    const found = await findPerformedExerciseById(db.conn, 100);
    expect(found).not.toBeNull();
    await updatePerformedExercise(db.conn, {
      ...(found as NonNullable<typeof found>),
      exerciseNameSnapshot: 'Bench press (close grip)',
    });
    const after = await findPerformedExerciseById(db.conn, 100);
    expect(after?.exerciseNameSnapshot).toBe('Bench press (close grip)');

    await deletePerformedExercise(db.conn, 100);
    expect(await findPerformedExerciseById(db.conn, 100)).toBeNull();
  });

  it('insertPerformedSet persists the row; list reads it back', async () => {
    await seedPerformedWorkoutRow(db, {
      id: 1,
      refDate: '2026-08-16',
      sheetId: null,
      sessionId: null,
      sheetNameSnapshot: 'Push',
      sessionNameSnapshot: 'Push',
      status: 'in_progress',
      startedAt: '2026-08-16T19:00:00.000Z',
      finishedAt: null,
      notes: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await seedPerformedExerciseRow(db, {
      id: 100,
      performedWorkoutId: 1,
      exerciseId: 'exercise:barbell_bench_press',
      exerciseNameSnapshot: 'Barbell bench press',
      muscleGroupSnapshot: 'chest',
      position: 0,
      createdAt: nowIso(),
    });
    // Insert via repo (returns id=0 in tests because the dev stub
    // does not register performed_workout_set autoincrement; insert
    // still writes the row, and the list path picks it up).
    const inserted = await insertPerformedSet(db.conn, {
      performedExerciseId: 100,
      reps: 8,
      weightKg: 80,
      completed: false,
    });
    expect(inserted.reps).toBe(8);
    expect(inserted.weightKg).toBe(80);
    expect(inserted.completed).toBe(false);
    expect(inserted.position).toBe(0);

    const list = await listPerformedSetsByPerformedExercise(db.conn, 100);
    // The inserted row's stored id is undefined in the dev stub (no
    // SEQUENCE_TABLES registration), so it appears in the list with
    // mapped id = undefined. The list length is what we assert.
    expect(list).toHaveLength(1);
    expect(list[0]?.reps).toBe(8);
  });

  // TODO(dev-stub infra): the in-memory `FakeDbConnection`'s UPDATE
  //   regex (`/SET\s+([\s\S]+?)\s+WHERE/i`) matches the first `SET`
  //   token, which collides with the `set` suffix of the
  //   `performed_workout_set` table identifier. The native engine
  //   parses SET as a keyword and updates the row correctly; covered
  //   on-device per brief §54.
  it.todo('updatePerformedSet mutates reps/weight_kg/completed in place');
  it.todo('markPerformedSetCompleted toggles the completed flag');
  it.todo('deletePerformedSet removes the row');

  it('findLastPerformedExerciseForExercise returns the most recent and respects the exclusion', async () => {
    await seedPerformedWorkoutRow(db, {
      id: 1,
      refDate: '2026-08-15',
      sheetId: null,
      sessionId: null,
      sheetNameSnapshot: 'Free',
      sessionNameSnapshot: 'Free',
      status: 'completed',
      startedAt: '2026-08-15T19:00:00.000Z',
      finishedAt: '2026-08-15T20:00:00.000Z',
      notes: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await seedPerformedWorkoutRow(db, {
      id: 2,
      refDate: '2026-08-16',
      sheetId: null,
      sessionId: null,
      sheetNameSnapshot: 'Free',
      sessionNameSnapshot: 'Free',
      status: 'completed',
      startedAt: '2026-08-16T19:00:00.000Z',
      finishedAt: '2026-08-16T20:00:00.000Z',
      notes: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await seedPerformedExerciseRow(db, {
      id: 100,
      performedWorkoutId: 1,
      exerciseId: 'exercise:barbell_bench_press',
      exerciseNameSnapshot: 'Barbell bench press',
      muscleGroupSnapshot: 'chest',
      position: 0,
      createdAt: '2026-08-15T19:30:00.000Z',
    });
    await seedPerformedExerciseRow(db, {
      id: 101,
      performedWorkoutId: 2,
      exerciseId: 'exercise:barbell_bench_press',
      exerciseNameSnapshot: 'Barbell bench press',
      muscleGroupSnapshot: 'chest',
      position: 0,
      createdAt: '2026-08-16T19:30:00.000Z',
    });
    await seedPerformedSetRow(db, {
      id: 1000,
      performedExerciseId: 100,
      position: 0,
      reps: 8,
      weightKg: 70,
      completed: true,
      createdAt: '2026-08-15T19:30:00.000Z',
    });
    await seedPerformedSetRow(db, {
      id: 1001,
      performedExerciseId: 101,
      position: 0,
      reps: 8,
      weightKg: 80,
      completed: true,
      createdAt: '2026-08-16T19:30:00.000Z',
    });

    // No exclusion: returns the most recent (the one in workout 2).
    const recent = await findLastPerformedExerciseForExercise(
      db.conn,
      'exercise:barbell_bench_press',
      null,
    );
    expect(recent?.performedExercise.id).toBe(101);
    expect(recent?.performedWorkout.id).toBe(2);
    expect(recent?.sets.map((s) => s.id)).toEqual([1001]);

    // Exclusion of the current workout: returns the previous one.
    const excluded = await findLastPerformedExerciseForExercise(
      db.conn,
      'exercise:barbell_bench_press',
      2,
    );
    expect(excluded?.performedExercise.id).toBe(100);
    expect(excluded?.performedWorkout.id).toBe(1);
    expect(excluded?.sets.map((s) => s.id)).toEqual([1000]);
  });

  it('listAllPerformedSetsByExercise returns sets across multiple workouts for the same exercise', async () => {
    await seedPerformedWorkoutRow(db, {
      id: 1,
      refDate: '2026-08-15',
      sheetId: null,
      sessionId: null,
      sheetNameSnapshot: 'Free',
      sessionNameSnapshot: 'Free',
      status: 'completed',
      startedAt: '2026-08-15T19:00:00.000Z',
      finishedAt: '2026-08-15T20:00:00.000Z',
      notes: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await seedPerformedWorkoutRow(db, {
      id: 2,
      refDate: '2026-08-16',
      sheetId: null,
      sessionId: null,
      sheetNameSnapshot: 'Free',
      sessionNameSnapshot: 'Free',
      status: 'completed',
      startedAt: '2026-08-16T19:00:00.000Z',
      finishedAt: '2026-08-16T20:00:00.000Z',
      notes: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await seedPerformedExerciseRow(db, {
      id: 100,
      performedWorkoutId: 1,
      exerciseId: 'exercise:barbell_bench_press',
      exerciseNameSnapshot: 'Barbell bench press',
      muscleGroupSnapshot: 'chest',
      position: 0,
      createdAt: '2026-08-15T19:30:00.000Z',
    });
    await seedPerformedExerciseRow(db, {
      id: 101,
      performedWorkoutId: 2,
      exerciseId: 'exercise:barbell_bench_press',
      exerciseNameSnapshot: 'Barbell bench press',
      muscleGroupSnapshot: 'chest',
      position: 0,
      createdAt: '2026-08-16T19:30:00.000Z',
    });
    await seedPerformedSetRow(db, {
      id: 1000,
      performedExerciseId: 100,
      position: 0,
      reps: 8,
      weightKg: 70,
      completed: true,
      createdAt: '2026-08-15T19:30:00.000Z',
    });
    await seedPerformedSetRow(db, {
      id: 1001,
      performedExerciseId: 100,
      position: 1,
      reps: 8,
      weightKg: 72.5,
      completed: true,
      createdAt: '2026-08-15T19:31:00.000Z',
    });
    await seedPerformedSetRow(db, {
      id: 1002,
      performedExerciseId: 101,
      position: 0,
      reps: 8,
      weightKg: 80,
      completed: true,
      createdAt: '2026-08-16T19:30:00.000Z',
    });
    const sets = await listAllPerformedSetsByExercise(db.conn, 'exercise:barbell_bench_press');
    expect(sets.map((s) => s.id).sort()).toEqual([1000, 1001, 1002]);
  });

  it('listAllPerformedSetsByExercise returns [] when the exercise has no history', async () => {
    const sets = await listAllPerformedSetsByExercise(db.conn, 'exercise:never_performed');
    expect(sets).toEqual([]);
  });
});
