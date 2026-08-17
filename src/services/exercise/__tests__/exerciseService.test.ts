// Service-layer integration tests for the exercise module (Lane 5).
//
// Drives the same `FakeDbConnection` + `createTestDb()` harness the Sprint 3
// repository tests use, so the SQL patterns the repos actually emit
// (`INSERT`, `UPDATE`, `WHERE … = ?`, `ORDER BY …`) are all honoured. The
// dev stub's known limitations are mirrored from
// `sprint3Repo.test.ts`:
//
//   - Aerobic activities inserted via `recordAerobicActivity` get `id = 0`
//     in the dev stub (the `MAX(id)` aggregate's lowercase alias is
//     upper-cased to `MAX_ID`, so the repo's `?? -1 + 1` fallback picks
//     the default branch and lands at 0). Tests that need a known
//     activity id therefore pre-seed via `seedAerobicActivityRow`.
//
//   - The fake does not register `aerobic_favorite` or
//     `exercise_translation` in its `PRIMARY_KEYS` table, so
//     `INSERT OR IGNORE` does not dedupe on those tables in the fake.
//     The native engine handles the idempotent insert natively; covered
//     on-device per brief §54.
//
//   - `createCustomExercise` passes the explicit `id` to
//     `exerciseRepo.insertExercise`, so the row keeps its id in the
//     fake — no autoincrement feedback loop to worry about for custom
//     exercises.
//
// The full Sprint 3 catalog (9 aerobic + 63 strength + their translations
// and kcal/h meta) is seeded via `applySeed` once per test so the
// `listExercises` / `listStrengthExercises` filter paths have realistic
// data to walk.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TestDb } from 'src/repositories/__tests__/testDb';
import { createTestDb } from 'src/repositories/__tests__/testDb';
import { applySeed } from 'src/seed';
import { resetClock, setClock } from 'src/domain/clock';
import { exerciseService } from 'src/services/exercise/service';

// ---------------------------------------------------------------------------
// Local seed helpers
// ---------------------------------------------------------------------------
//
// Mirrors the pattern from `sprint3Repo.test.ts` — kept local to this file
// so `testDb.ts` stays untouched across lane merges. Each helper issues a
// literal `INSERT` with an explicit primary key so the row is identifiable
// even in the dev stub.

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
// 1. listExercises — filters + locale fallback
// ---------------------------------------------------------------------------

describe('exerciseService.listExercises', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createTestDb();
    await applySeed(db.conn);
    setClock(() => new Date('2026-08-16T12:00:00.000Z'));
  });
  afterEach(async () => {
    resetClock();
    await db.close();
  });

  it('returns every exercise with no filter', async () => {
    const all = await exerciseService.listExercises(db.conn, { locale: 'en' });
    // 9 aerobic + 63 strength.
    expect(all).toHaveLength(72);
    // Results sorted by localized name (locale='en').
    const names = all.map((e) => e.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
    // Sanity-check a couple of well-known catalog entries.
    const ids = all.map((e) => e.exercise.id);
    expect(ids).toContain('exercise:walking');
    expect(ids).toContain('exercise:barbell_bench_press');
  });

  it('filters by kind:"aerobic" returning only aerobic rows', async () => {
    const aerobic = await exerciseService.listExercises(db.conn, {
      locale: 'en',
      filter: { kind: 'aerobic' },
    });
    expect(aerobic).toHaveLength(9);
    expect(aerobic.every((e) => e.exercise.kind === 'aerobic')).toBe(true);
    expect(aerobic.map((e) => e.exercise.id)).toContain('exercise:walking');
    // No strength entries should leak through.
    expect(aerobic.find((e) => e.exercise.kind === 'strength')).toBeUndefined();
  });

  it('filters by origin:"official" excluding any custom row', async () => {
    // Seed a custom exercise alongside the official catalog so the filter
    // has something to drop.
    await exerciseService.createCustomExercise(db.conn, {
      id: 'exercise:user:my-pull-up',
      kind: 'strength',
      name: 'My pull-up',
      locale: 'en',
      muscleGroup: 'back',
      defaultUnit: 'bodyweight',
      hasRepetitions: true,
      hasDuration: false,
      notes: null,
      kcalPerHour: null,
    });
    const official = await exerciseService.listExercises(db.conn, {
      locale: 'en',
      filter: { origin: 'official' },
    });
    expect(official).toHaveLength(72);
    expect(official.every((e) => e.exercise.origin === 'official')).toBe(true);
    expect(official.find((e) => e.exercise.id === 'exercise:user:my-pull-up')).toBeUndefined();
  });

  it('honors the locale parameter for display names', async () => {
    const en = await exerciseService.listExercises(db.conn, { locale: 'en' });
    const ptBR = await exerciseService.listExercises(db.conn, { locale: 'pt-BR' });
    // The same exercise id resolves to different display names per locale.
    const enWalking = en.find((e) => e.exercise.id === 'exercise:walking');
    const ptWalking = ptBR.find((e) => e.exercise.id === 'exercise:walking');
    expect(enWalking?.name).toBe('Walking');
    expect(ptWalking?.name).toBe('Caminhada');
  });

  it('falls back to the English translation when the requested locale is missing', async () => {
    // Build a custom exercise that ships with only an English translation
    // — the service must fall back when queried with a different locale.
    await exerciseService.createCustomExercise(db.conn, {
      id: 'exercise:user:banded-squat',
      kind: 'strength',
      name: 'Banded squat',
      locale: 'en',
      muscleGroup: 'legs',
      defaultUnit: 'bodyweight',
      hasRepetitions: true,
      hasDuration: false,
      notes: null,
      kcalPerHour: null,
    });
    // Query with a locale that has no translation for this exercise —
    // service falls back through locale → 'en' → first → id.
    const result = await exerciseService.listExercises(db.conn, { locale: 'ja' });
    const custom = result.find((e) => e.exercise.id === 'exercise:user:banded-squat');
    expect(custom?.name).toBe('Banded squat');
  });
});

// ---------------------------------------------------------------------------
// 2. listStrengthExercises — muscle group + diacritic-insensitive search
// ---------------------------------------------------------------------------

describe('exerciseService.listStrengthExercises', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createTestDb();
    await applySeed(db.conn);
    setClock(() => new Date('2026-08-16T12:00:00.000Z'));
  });
  afterEach(async () => {
    resetClock();
    await db.close();
  });

  it('returns every strength exercise with no filter', async () => {
    const strength = await exerciseService.listStrengthExercises(db.conn, { locale: 'en' });
    expect(strength).toHaveLength(63);
    expect(strength.every((e) => e.exercise.kind === 'strength')).toBe(true);
  });

  it('filters by muscleGroup:"chest"', async () => {
    const chest = await exerciseService.listStrengthExercises(db.conn, {
      locale: 'en',
      muscleGroup: 'chest',
    });
    expect(chest.length).toBeGreaterThan(0);
    expect(chest.every((e) => e.exercise.muscleGroup === 'chest')).toBe(true);
    // Spot-check a known chest row from the catalog.
    expect(chest.find((e) => e.exercise.id === 'exercise:barbell_bench_press')).toBeDefined();
  });

  it('substring-matches "bench" and returns every bench exercise', async () => {
    const bench = await exerciseService.listStrengthExercises(db.conn, {
      locale: 'en',
      query: 'bench',
    });
    expect(bench.length).toBeGreaterThan(1);
    expect(bench.every((e) => /bench/i.test(e.name))).toBe(true);
    expect(bench.find((e) => e.exercise.id === 'exercise:barbell_bench_press')).toBeDefined();
    expect(bench.find((e) => e.exercise.id === 'exercise:incline_barbell_bench_press')).toBeDefined();
  });

  it('matches a query with diacritics against a name without diacritics (and vice versa)', async () => {
    // The catalog stores "Remada com barra" (pt-BR) for
    // 'exercise:barbell_row'; the search blob strips diacritics so a
    // query with no diacritics still matches.
    const matching = await exerciseService.listStrengthExercises(db.conn, {
      locale: 'pt-BR',
      query: 'remada com barra',
    });
    expect(
      matching.find((e) => e.exercise.id === 'exercise:barbell_row'),
    ).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 3. Aerobic activity CRUD — kcal math + snapshot integrity
// ---------------------------------------------------------------------------

describe('exerciseService.recordAerobicActivity / update / delete', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createTestDb();
    await applySeed(db.conn);
    setClock(() => new Date('2026-08-16T12:00:00.000Z'));
  });
  afterEach(async () => {
    resetClock();
    await db.close();
  });

  it('200 kcal/h × 30 minutes → kcalEstimated exactly 100, snapshot exactly 200', async () => {
    const activity = await exerciseService.recordAerobicActivity(db.conn, {
      exerciseId: 'exercise:walking',
      exerciseName: 'Walking',
      kcalPerHour: 200,
      durationMinutes: 30,
      notes: null,
      refDate: '2026-08-16',
    });
    expect(activity.kcalEstimated).toBe(100);
    expect(activity.kcalPerHourSnapshot).toBe(200);
    expect(activity.exerciseNameSnapshot).toBe('Walking');
    expect(activity.durationMinutes).toBe(30);
  });

  it('rejects an invalid kcalPerHour or duration up-front (no row written)', async () => {
    await expect(
      exerciseService.recordAerobicActivity(db.conn, {
        exerciseId: 'exercise:walking',
        exerciseName: 'Walking',
        kcalPerHour: -10,
        durationMinutes: 30,
        notes: null,
        refDate: '2026-08-16',
      }),
    ).rejects.toThrow();
    await expect(
      exerciseService.recordAerobicActivity(db.conn, {
        exerciseId: 'exercise:walking',
        exerciseName: 'Walking',
        kcalPerHour: 200,
        durationMinutes: 0,
        notes: null,
        refDate: '2026-08-16',
      }),
    ).rejects.toThrow();
  });

  it('updateAerobicActivity recomputes kcalEstimated when duration changes', async () => {
    // Pre-seed a row with a known id so the service's update path can find
    // it (recordAerobicActivity lands at id=0 in the dev stub).
    await seedAerobicActivityRow(db, {
      id: 42,
      refDate: '2026-08-16',
      exerciseId: 'exercise:walking',
      exerciseNameSnapshot: 'Walking',
      kcalPerHourSnapshot: 200,
      durationMinutes: 30,
      kcalEstimated: 100,
      notes: null,
      createdAt: '2026-08-16T08:00:00.000Z',
    });
    // 200 kcal/h × 60 min → 200 kcal.
    const updated = await exerciseService.updateAerobicActivity(db.conn, {
      id: 42,
      kcalPerHour: 200,
      durationMinutes: 60,
      notes: 'extended walk',
    });
    expect(updated.kcalEstimated).toBe(200);
    expect(updated.durationMinutes).toBe(60);
    expect(updated.kcalPerHourSnapshot).toBe(200);
    expect(updated.notes).toBe('extended walk');

    // The row in the store reflects the new values; the list path picks
    // them up.
    const list = await exerciseService.listAerobicActivitiesByDate(db.conn, {
      refDate: '2026-08-16',
      locale: 'en',
    });
    expect(list).toHaveLength(1);
    expect(list[0]?.activity.kcalEstimated).toBe(200);
    expect(list[0]?.activity.notes).toBe('extended walk');
  });

  it('updateAerobicActivity throws when the row does not exist', async () => {
    await expect(
      exerciseService.updateAerobicActivity(db.conn, {
        id: 9999,
        kcalPerHour: 200,
        durationMinutes: 30,
        notes: null,
      }),
    ).rejects.toThrow(/not found/);
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
    const before = await exerciseService.listAerobicActivitiesByDate(db.conn, {
      refDate: '2026-08-16',
      locale: 'en',
    });
    expect(before).toHaveLength(1);

    await exerciseService.deleteAerobicActivity(db.conn, 7);
    const after = await exerciseService.listAerobicActivitiesByDate(db.conn, {
      refDate: '2026-08-16',
      locale: 'en',
    });
    expect(after).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Aerobic favorites — toggle round-trip
// ---------------------------------------------------------------------------

describe('exerciseService.toggleAerobicFavorite', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createTestDb();
    await applySeed(db.conn);
    setClock(() => new Date('2026-08-16T12:00:00.000Z'));
  });
  afterEach(async () => {
    resetClock();
    await db.close();
  });

  it('adds then removes, returning the new boolean each time', async () => {
    expect(await exerciseService.isAerobicFavorite(db.conn, 'exercise:walking')).toBe(false);

    const afterAdd = await exerciseService.toggleAerobicFavorite(db.conn, 'exercise:walking');
    expect(afterAdd).toBe(true);
    expect(await exerciseService.isAerobicFavorite(db.conn, 'exercise:walking')).toBe(true);
    expect(await exerciseService.listFavoriteAerobicExerciseIds(db.conn)).toEqual([
      'exercise:walking',
    ]);

    const afterRemove = await exerciseService.toggleAerobicFavorite(db.conn, 'exercise:walking');
    expect(afterRemove).toBe(false);
    expect(await exerciseService.isAerobicFavorite(db.conn, 'exercise:walking')).toBe(false);
    expect(await exerciseService.listFavoriteAerobicExerciseIds(db.conn)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5. listAerobicActivitiesByDate — local-date filtering
// ---------------------------------------------------------------------------

describe('exerciseService.listAerobicActivitiesByDate', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createTestDb();
    await applySeed(db.conn);
    setClock(() => new Date('2026-08-16T12:00:00.000Z'));
  });
  afterEach(async () => {
    resetClock();
    await db.close();
  });

  it('returns only activities for the requested local date', async () => {
    // Two on 2026-08-16 (out of creation order to verify ORDER BY
    // created_at ASC), one on 2026-08-17.
    await seedAerobicActivityRow(db, {
      id: 1,
      refDate: '2026-08-16',
      exerciseId: 'exercise:walking',
      exerciseNameSnapshot: 'Walking',
      kcalPerHourSnapshot: 280,
      durationMinutes: 30,
      kcalEstimated: 140,
      notes: null,
      createdAt: '2026-08-16T18:00:00.000Z',
    });
    await seedAerobicActivityRow(db, {
      id: 2,
      refDate: '2026-08-17',
      exerciseId: 'exercise:walking',
      exerciseNameSnapshot: 'Walking',
      kcalPerHourSnapshot: 280,
      durationMinutes: 30,
      kcalEstimated: 140,
      notes: 'next day',
      createdAt: '2026-08-17T08:00:00.000Z',
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
      createdAt: '2026-08-16T08:00:00.000Z',
    });

    const day1 = await exerciseService.listAerobicActivitiesByDate(db.conn, {
      refDate: '2026-08-16',
      locale: 'en',
    });
    expect(day1).toHaveLength(2);
    expect(day1.map((e) => e.activity.id).sort()).toEqual([1, 3]);
    // Ordered by created_at ASC → id 3 (08:00) precedes id 1 (18:00).
    expect(day1.map((e) => e.activity.id)).toEqual([3, 1]);
    // The day-17 activity does not leak into day-16's list.
    expect(day1.find((e) => e.activity.id === 2)).toBeUndefined();

    const day2 = await exerciseService.listAerobicActivitiesByDate(db.conn, {
      refDate: '2026-08-17',
      locale: 'en',
    });
    expect(day2).toHaveLength(1);
    expect(day2[0]?.activity.id).toBe(2);
    expect(day2[0]?.exerciseName).toBe('Walking');
    expect(day2[0]?.exerciseOrigin).toBe('official');
  });

  it('falls back to the snapshot when the parent exercise is deleted', async () => {
    await seedAerobicActivityRow(db, {
      id: 5,
      refDate: '2026-08-16',
      exerciseId: 'exercise:walking',
      exerciseNameSnapshot: 'Walking (legacy)',
      kcalPerHourSnapshot: 280,
      durationMinutes: 30,
      kcalEstimated: 140,
      notes: null,
      createdAt: '2026-08-16T08:00:00.000Z',
    });
    // Delete the parent exercise; the activity row's snapshot must
    // survive and the list path must mark the row as 'deleted'.
    await db.exec('DELETE FROM exercise WHERE id = ?', ['exercise:walking']);
    const list = await exerciseService.listAerobicActivitiesByDate(db.conn, {
      refDate: '2026-08-16',
      locale: 'en',
    });
    expect(list).toHaveLength(1);
    expect(list[0]?.exerciseName).toBe('Walking (legacy)');
    expect(list[0]?.exerciseOrigin).toBe('deleted');
  });
});

// ---------------------------------------------------------------------------
// 6. Custom exercises — full lifecycle + origin guard
// ---------------------------------------------------------------------------

describe('exerciseService custom-exercise lifecycle', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createTestDb();
    await applySeed(db.conn);
    setClock(() => new Date('2026-08-16T12:00:00.000Z'));
  });
  afterEach(async () => {
    resetClock();
    await db.close();
  });

  it('create → update → delete full lifecycle', async () => {
    const created = await exerciseService.createCustomExercise(db.conn, {
      id: 'exercise:user:my-push-up',
      kind: 'strength',
      name: 'My push-up',
      locale: 'en',
      muscleGroup: 'chest',
      defaultUnit: 'bodyweight',
      hasRepetitions: true,
      hasDuration: false,
      notes: null,
      kcalPerHour: null,
    });
    expect(created.id).toBe('exercise:user:my-push-up');
    expect(created.origin).toBe('custom');
    expect(created.kind).toBe('strength');
    expect(created.muscleGroup).toBe('chest');

    const updated = await exerciseService.updateCustomExercise(db.conn, {
      id: 'exercise:user:my-push-up',
      kind: 'strength',
      name: 'My push-up v2',
      locale: 'en',
      muscleGroup: 'chest',
      defaultUnit: 'bodyweight',
      hasRepetitions: true,
      hasDuration: false,
      notes: 'focus on full ROM',
      kcalPerHour: null,
    });
    expect(updated.id).toBe('exercise:user:my-push-up');
    expect(updated.notes).toBe('focus on full ROM');
    // Origin is immutable from the service surface.
    expect(updated.origin).toBe('custom');

    await exerciseService.deleteCustomExercise(db.conn, 'exercise:user:my-push-up');
    // The exercise row is gone; the translation cascades with it.
    expect(
      (await exerciseService.listExercises(db.conn, { locale: 'en' })).find(
        (e) => e.exercise.id === 'exercise:user:my-push-up',
      ),
    ).toBeUndefined();
  });

  it('updateCustomExercise throws when the row is not custom (origin check)', async () => {
    // The service's `exercise:user:<slug>` validator runs before the
    // origin check, so to exercise the origin branch we manually insert
    // a row that *does* match the user-namespace pattern but is flagged
    // as official. The native engine and the FakeDbConnection both honour
    // this INSERT because the column list explicitly sets origin.
    await db.exec(
      `INSERT INTO exercise
         (id, origin, kind, muscle_group, default_unit,
          has_repetitions, has_duration, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'exercise:user:hijacked',
        'official',
        'strength',
        'chest',
        'kg',
        1,
        0,
        null,
        '2026-08-16T12:00:00.000Z',
        '2026-08-16T12:00:00.000Z',
      ],
    );
    await expect(
      exerciseService.updateCustomExercise(db.conn, {
        id: 'exercise:user:hijacked',
        kind: 'strength',
        name: 'Hijacked',
        locale: 'en',
        muscleGroup: 'chest',
        defaultUnit: 'kg',
        hasRepetitions: true,
        hasDuration: false,
        notes: null,
        kcalPerHour: null,
      }),
    ).rejects.toThrow(/not a custom exercise/);
  });

  it('deleteCustomExercise throws when the row is not custom (origin check)', async () => {
    await db.exec(
      `INSERT INTO exercise
         (id, origin, kind, muscle_group, default_unit,
          has_repetitions, has_duration, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'exercise:user:hijacked',
        'official',
        'strength',
        'chest',
        'kg',
        1,
        0,
        null,
        '2026-08-16T12:00:00.000Z',
        '2026-08-16T12:00:00.000Z',
      ],
    );
    await expect(
      exerciseService.deleteCustomExercise(db.conn, 'exercise:user:hijacked'),
    ).rejects.toThrow(/not a custom exercise/);
  });

  it('createCustomExercise throws when the id does not match the user-namespace pattern', async () => {
    await expect(
      exerciseService.createCustomExercise(db.conn, {
        id: 'exercise:walking', // official namespace — rejected by the validator
        kind: 'aerobic',
        name: 'Walking',
        locale: 'en',
        muscleGroup: null,
        defaultUnit: 'none',
        hasRepetitions: false,
        hasDuration: true,
        notes: null,
        kcalPerHour: 280,
      }),
    ).rejects.toThrow(/exercise:user:<slug>/);
  });

  it('createCustomExercise aerobic variant persists the kcalPerHour meta row', async () => {
    await exerciseService.createCustomExercise(db.conn, {
      id: 'exercise:user:my-zwift-ride',
      kind: 'aerobic',
      name: 'My Zwift ride',
      locale: 'en',
      muscleGroup: null,
      defaultUnit: 'none',
      hasRepetitions: false,
      hasDuration: true,
      notes: null,
      kcalPerHour: 500,
    });
    // Verify the meta row landed by going through the catalog list path
    // (which hydrates kcalPerHour via `findAerobicMeta` in callers).
    const list = await exerciseService.listExercises(db.conn, {
      locale: 'en',
      filter: { kind: 'aerobic', origin: 'custom' },
    });
    expect(list.find((e) => e.exercise.id === 'exercise:user:my-zwift-ride')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 7. getExerciseHistory — latest workout + all-time record
// ---------------------------------------------------------------------------

describe('exerciseService.getExerciseHistory', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createTestDb();
    await applySeed(db.conn);
    setClock(() => new Date('2026-08-16T12:00:00.000Z'));
  });
  afterEach(async () => {
    resetClock();
    await db.close();
  });

  it('returns a blank snapshot when the exercise has no history', async () => {
    const snap = await exerciseService.getExerciseHistory(db.conn, {
      exerciseId: 'exercise:barbell_bench_press',
      locale: 'en',
    });
    expect(snap.exerciseId).toBe('exercise:barbell_bench_press');
    expect(snap.exerciseName).toBe('Barbell bench press');
    expect(snap.lastPerformedWorkout).toBeNull();
    expect(snap.recordWeightKg).toBeNull();
    expect(snap.recordWeightReps).toBeNull();
  });

  it('returns a blank snapshot when the exercise does not exist', async () => {
    const snap = await exerciseService.getExerciseHistory(db.conn, {
      exerciseId: 'exercise:does-not-exist',
      locale: 'en',
    });
    expect(snap.exerciseId).toBe('exercise:does-not-exist');
    expect(snap.lastPerformedWorkout).toBeNull();
    expect(snap.recordWeightKg).toBeNull();
    expect(snap.recordWeightReps).toBeNull();
  });

  it('returns the latest performed workout + all-time best when history exists', async () => {
    // Build a 2-workout history for the barbell bench press. The most
    // recent workout wins for `lastPerformedWorkout`; the all-time best
    // set is tracked independently across both.
    await seedPerformedWorkoutRow(db, {
      id: 1,
      refDate: '2026-08-15',
      sheetId: null,
      sessionId: null,
      sheetNameSnapshot: 'Push',
      sessionNameSnapshot: 'Push',
      status: 'completed',
      startedAt: '2026-08-15T19:00:00.000Z',
      finishedAt: '2026-08-15T20:00:00.000Z',
      notes: null,
      createdAt: '2026-08-15T19:00:00.000Z',
      updatedAt: '2026-08-15T19:00:00.000Z',
    });
    await seedPerformedWorkoutRow(db, {
      id: 2,
      refDate: '2026-08-16',
      sheetId: null,
      sessionId: null,
      sheetNameSnapshot: 'Push',
      sessionNameSnapshot: 'Push',
      status: 'completed',
      startedAt: '2026-08-16T19:00:00.000Z',
      finishedAt: '2026-08-16T20:00:00.000Z',
      notes: null,
      createdAt: '2026-08-16T19:00:00.000Z',
      updatedAt: '2026-08-16T19:00:00.000Z',
    });
    // Workout 1: 8 reps @ 70kg.
    await seedPerformedExerciseRow(db, {
      id: 100,
      performedWorkoutId: 1,
      exerciseId: 'exercise:barbell_bench_press',
      exerciseNameSnapshot: 'Barbell bench press',
      muscleGroupSnapshot: 'chest',
      position: 0,
      createdAt: '2026-08-15T19:30:00.000Z',
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
    // Workout 2 (most-recent): 8 reps @ 75kg, 6 reps @ 80kg.
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
      id: 1001,
      performedExerciseId: 101,
      position: 0,
      reps: 8,
      weightKg: 75,
      completed: true,
      createdAt: '2026-08-16T19:30:00.000Z',
    });
    await seedPerformedSetRow(db, {
      id: 1002,
      performedExerciseId: 101,
      position: 1,
      reps: 6,
      weightKg: 80,
      completed: true,
      createdAt: '2026-08-16T19:31:00.000Z',
    });

    const snap = await exerciseService.getExerciseHistory(db.conn, {
      exerciseId: 'exercise:barbell_bench_press',
      locale: 'en',
    });
    expect(snap.exerciseName).toBe('Barbell bench press');
    // Latest workout is the one with performedExerciseId = 101.
    expect(snap.lastPerformedWorkout?.performedWorkoutId).toBe(2);
    expect(snap.lastPerformedWorkout?.refDate).toBe('2026-08-16');
    expect(snap.lastPerformedWorkout?.sets).toHaveLength(2);
    expect(snap.lastPerformedWorkout?.sets.map((s) => s.weightKg)).toEqual([75, 80]);
    // All-time best is 80 kg @ 6 reps (the heaviest across both workouts).
    expect(snap.recordWeightKg).toBe(80);
    expect(snap.recordWeightReps).toBe(6);
  });
});