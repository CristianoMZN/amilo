// Service-layer integration tests for the workout module (Lane 6).
//
// Drives the same `FakeDbConnection` + `createTestDb()` harness the Sprint 3
// repository tests use. The dev stub's known limitations — every Sprint 3
// table is missing from `STUB_COLUMNS` / `SEQUENCE_TABLES`, so the
// autoincrement feedback loop returns undefined / `MAX_POS` — mean
// service-inserted rows do not surface a usable id through the return
// value. Tests that need a known id therefore pre-seed parent rows with
// explicit ids (mirroring `sprint3Repo.test.ts`); tests that exercise
// position auto-assignment go through `it.todo` because the fake's
// aggregate-alias upper-casing makes `MAX(position)` always read as
// undefined.
//
// The full Sprint 3 catalog is seeded via `applySeed` once per test so
// `startWorkoutFromSession` has real exercise rows to clone.
//
// `FakeDbConnection` caveats the tests work around (owned by the test
// infrastructure, not the repos):
//
//   - Aggregate aliases are upper-cased (`MAX_POS` not `max_pos`), so the
//     repo's `?? -1 + 1` fallback picks the default branch and *every*
//     `MAX(position)` insert lands at position 0. Sequential-position
//     behaviour is verified on-device per brief §54.
//
//   - Sprint 3 tables are not registered for autoincrement; the repo's
//     `SELECT MAX(id) … ORDER BY id DESC` returns rows without an `id`
//     field, so service-inserted rows do not surface a usable id. Tests
//     that need ids pre-seed via the local seed helpers.
//
//   - `FakeDbConnection`'s UPDATE regex collides with the `set` suffix
//     of the `performed_workout_set` table — the SET clause of UPDATE
//     statements for that table is misparsed. `updatePerformedSet` /
//     `markPerformedSetCompleted` are covered by the repo's `it.todo`
//     notes; here we exercise the service against pre-seeded rows so
//     the assertion path does not depend on the broken UPDATE either.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TestDb } from 'src/repositories/__tests__/testDb';
import { createTestDb } from 'src/repositories/__tests__/testDb';
import { applySeed } from 'src/seed';
import { resetClock, setClock } from 'src/domain/clock';
import { workoutService } from 'src/services/workout/service';

// ---------------------------------------------------------------------------
// Local seed helpers — kept local so `testDb.ts` stays untouched across
// lane merges. Each helper issues a literal `INSERT` with an explicit
// primary key so the row carries a stable id in the dev stub.
// ---------------------------------------------------------------------------

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
// 1. Sheet lifecycle — create / list / rename / delete
// ---------------------------------------------------------------------------

describe('workoutService sheet lifecycle', () => {
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

  it('createSheet returns a row with the requested name and a default position', async () => {
    const sheet = await workoutService.createSheet(db.conn, { name: 'Push day' });
    expect(sheet.name).toBe('Push day');
    // Dev stub: aggregate alias is uppercased, so the very first insert
    // lands at position 0 (the `?? -1 + 1` fallback path). Verified on
    // device per brief §54.
    expect(sheet.position).toBe(0);
  });

  it('listSheets includes every created sheet', async () => {
    await workoutService.createSheet(db.conn, { name: 'Push day' });
    await workoutService.createSheet(db.conn, { name: 'Pull day' });
    const list = await workoutService.listSheets(db.conn);
    const names = list.map((s) => s.name);
    expect(names).toContain('Push day');
    expect(names).toContain('Pull day');
  });

  it('listSheetsWithSessions nests sessions under each sheet', async () => {
    await seedWorkoutSheetRow(db, {
      id: 1,
      name: 'Push day',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await seedWorkoutSessionRow(db, {
      id: 10,
      sheetId: 1,
      name: 'Push',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    const sheets = await workoutService.listSheetsWithSessions(db.conn);
    const push = sheets.find((s) => s.sheet.id === 1);
    expect(push?.sessions.map((s) => s.session.name)).toEqual(['Push']);
  });

  it('renameSheet updates the sheet name', async () => {
    await seedWorkoutSheetRow(db, {
      id: 1,
      name: 'Push day',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await workoutService.renameSheet(db.conn, { id: 1, name: 'Push day v2' });
    const list = await workoutService.listSheets(db.conn);
    const renamed = list.find((s) => s.id === 1);
    expect(renamed?.name).toBe('Push day v2');
  });

  it('renameSheet throws on an empty name', async () => {
    await seedWorkoutSheetRow(db, {
      id: 1,
      name: 'Push day',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await expect(
      workoutService.renameSheet(db.conn, { id: 1, name: '   ' }),
    ).rejects.toThrow(/sheet name required/);
  });

  it('deleteSheet removes the sheet row', async () => {
    await seedWorkoutSheetRow(db, {
      id: 1,
      name: 'Push day',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await workoutService.deleteSheet(db.conn, 1);
    const list = await workoutService.listSheets(db.conn);
    expect(list.find((s) => s.id === 1)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2. Session lifecycle — create / list / rename / delete
// ---------------------------------------------------------------------------

describe('workoutService session lifecycle', () => {
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

  it('createSession returns a row with the requested name and a default position', async () => {
    await seedWorkoutSheetRow(db, {
      id: 1,
      name: 'Push day',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    const session = await workoutService.createSession(db.conn, {
      sheetId: 1,
      name: 'Push',
    });
    expect(session.name).toBe('Push');
    expect(session.sheetId).toBe(1);
    // Dev-stub caveat: the first session lands at position 0 in tests
    // (see sprint3Repo test header). Production engine assigns 0 for the
    // first row in a sheet.
    expect(session.position).toBe(0);
  });

  it('multiple sessions in a sheet are all returned by findSheet', async () => {
    await seedWorkoutSheetRow(db, {
      id: 1,
      name: 'Push day',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    // Pre-seed with explicit positions so the assertions don't depend on
    // the dev-stub position alias caveat.
    await seedWorkoutSessionRow(db, {
      id: 10,
      sheetId: 1,
      name: 'Push',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await seedWorkoutSessionRow(db, {
      id: 11,
      sheetId: 1,
      name: 'Pull',
      position: 1,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await seedWorkoutSessionRow(db, {
      id: 12,
      sheetId: 1,
      name: 'Legs',
      position: 2,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    const sheet = await workoutService.findSheet(db.conn, 1);
    expect(sheet?.sessions.map((s) => s.session.name)).toEqual(['Push', 'Pull', 'Legs']);
    expect(sheet?.sessions.map((s) => s.session.position)).toEqual([0, 1, 2]);
  });

  // TODO(dev-stub infra): the in-memory `FakeDbConnection` upper-cases
  //   aggregate aliases, so `SELECT MAX(position) AS max_pos` returns
  //   `[{ MAX_POS: <n> }]` and the repo reads `max_pos` as undefined.
  //   The `?? -1 + 1` fallback therefore picks the default branch and
  //   every consecutive insert lands at position 0 — sequential
  //   position assignment cannot be exercised in the dev stub. The
  //   native engine honours `MAX(position)` lexicographically; covered
  //   on-device per brief §54.
  it.todo('multiple consecutive createSession calls assign sequential positions');

  it('renameSession updates the session name', async () => {
    await seedWorkoutSheetRow(db, {
      id: 1,
      name: 'Push day',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await seedWorkoutSessionRow(db, {
      id: 10,
      sheetId: 1,
      name: 'Push',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await workoutService.renameSession(db.conn, { id: 10, name: 'Push (chest focus)' });
    const sheet = await workoutService.findSheet(db.conn, 1);
    expect(sheet?.sessions[0]?.session.name).toBe('Push (chest focus)');
  });

  it('deleteSession removes the session row', async () => {
    await seedWorkoutSheetRow(db, {
      id: 1,
      name: 'Push day',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await seedWorkoutSessionRow(db, {
      id: 10,
      sheetId: 1,
      name: 'Push',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await workoutService.deleteSession(db.conn, 10);
    const sheet = await workoutService.findSheet(db.conn, 1);
    expect(sheet?.sessions).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. Planned exercise lifecycle — add / update / delete + position moves
// ---------------------------------------------------------------------------

describe('workoutService planned-exercise lifecycle + position moves', () => {
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

  it('addPlannedExercise returns a row with the requested fields', async () => {
    await seedWorkoutSheetRow(db, {
      id: 1,
      name: 'Push day',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await seedWorkoutSessionRow(db, {
      id: 10,
      sheetId: 1,
      name: 'Push',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    const planned = await workoutService.addPlannedExercise(db.conn, {
      sessionId: 10,
      exerciseId: 'exercise:barbell_bench_press',
      name: 'Barbell bench press',
      muscleGroup: 'chest',
      plannedSets: 3,
      plannedReps: 8,
      plannedWeightKg: 80,
      notes: null,
    });
    expect(planned.sessionId).toBe(10);
    expect(planned.exerciseId).toBe('exercise:barbell_bench_press');
    expect(planned.exerciseNameSnapshot).toBe('Barbell bench press');
    expect(planned.plannedSets).toBe(3);
    expect(planned.plannedReps).toBe(8);
    expect(planned.plannedWeightKg).toBe(80);
  });

  it('listPlannedExercisesBySession returns the planned rows in position order', async () => {
    await seedWorkoutSheetRow(db, {
      id: 1,
      name: 'Push day',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await seedWorkoutSessionRow(db, {
      id: 10,
      sheetId: 1,
      name: 'Push',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
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
      createdAt: '2026-08-16T12:00:00.000Z',
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
      createdAt: '2026-08-16T12:00:00.000Z',
    });
    const list = await workoutService.listPlannedExercisesBySession(db.conn, 10);
    expect(list.map((p) => p.planned.exerciseNameSnapshot)).toEqual([
      'Barbell bench press',
      'Overhead press',
    ]);
  });

  it('updatePlannedExercise mutates the planned-sets/reps/weight fields', async () => {
    await seedWorkoutSheetRow(db, {
      id: 1,
      name: 'Push day',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await seedWorkoutSessionRow(db, {
      id: 10,
      sheetId: 1,
      name: 'Push',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
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
      createdAt: '2026-08-16T12:00:00.000Z',
    });
    await workoutService.updatePlannedExercise(db.conn, {
      id: 100,
      plannedSets: 4,
      plannedReps: 6,
      plannedWeightKg: 85,
      notes: 'heavy day',
    });
    const list = await workoutService.listPlannedExercisesBySession(db.conn, 10);
    expect(list[0]?.planned.plannedSets).toBe(4);
    expect(list[0]?.planned.plannedReps).toBe(6);
    expect(list[0]?.planned.plannedWeightKg).toBe(85);
    expect(list[0]?.planned.notes).toBe('heavy day');
  });

  it('deletePlannedExercise removes the row', async () => {
    await seedWorkoutSheetRow(db, {
      id: 1,
      name: 'Push day',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await seedWorkoutSessionRow(db, {
      id: 10,
      sheetId: 1,
      name: 'Push',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
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
      createdAt: '2026-08-16T12:00:00.000Z',
    });
    await workoutService.deletePlannedExercise(db.conn, 100);
    const list = await workoutService.listPlannedExercisesBySession(db.conn, 10);
    expect(list).toEqual([]);
  });

  it('movePlannedExerciseUp swaps with the previous position', async () => {
    await seedWorkoutSheetRow(db, {
      id: 1,
      name: 'Push day',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await seedWorkoutSessionRow(db, {
      id: 10,
      sheetId: 1,
      name: 'Push',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    // Three planned exercises at positions 0, 1, 2. Move the middle one
    // (id=101, position=1) up — expected: 100<->101 swap, new positions
    // [101, 100, 102].
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
      createdAt: '2026-08-16T12:00:00.000Z',
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
      createdAt: '2026-08-16T12:00:00.000Z',
    });
    await seedWorkoutPlannedExerciseRow(db, {
      id: 102,
      sessionId: 10,
      exerciseId: 'exercise:dips',
      exerciseNameSnapshot: 'Dips',
      muscleGroupSnapshot: 'chest',
      position: 2,
      plannedSets: 3,
      plannedReps: 10,
      plannedWeightKg: null,
      notes: null,
      createdAt: '2026-08-16T12:00:00.000Z',
    });
    await workoutService.movePlannedExerciseUp(db.conn, 10, 101);
    const list = await workoutService.listPlannedExercisesBySession(db.conn, 10);
    expect(list.map((p) => p.planned.id)).toEqual([101, 100, 102]);
  });

  it('movePlannedExerciseDown swaps with the next position', async () => {
    await seedWorkoutSheetRow(db, {
      id: 1,
      name: 'Push day',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await seedWorkoutSessionRow(db, {
      id: 10,
      sheetId: 1,
      name: 'Push',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
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
      createdAt: '2026-08-16T12:00:00.000Z',
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
      createdAt: '2026-08-16T12:00:00.000Z',
    });
    await seedWorkoutPlannedExerciseRow(db, {
      id: 102,
      sessionId: 10,
      exerciseId: 'exercise:dips',
      exerciseNameSnapshot: 'Dips',
      muscleGroupSnapshot: 'chest',
      position: 2,
      plannedSets: 3,
      plannedReps: 10,
      plannedWeightKg: null,
      notes: null,
      createdAt: '2026-08-16T12:00:00.000Z',
    });
    await workoutService.movePlannedExerciseDown(db.conn, 10, 101);
    const list = await workoutService.listPlannedExercisesBySession(db.conn, 10);
    expect(list.map((p) => p.planned.id)).toEqual([100, 102, 101]);
  });

  it('movePlannedExerciseUp is a no-op at the top of the list', async () => {
    await seedWorkoutSheetRow(db, {
      id: 1,
      name: 'Push day',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await seedWorkoutSessionRow(db, {
      id: 10,
      sheetId: 1,
      name: 'Push',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
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
      createdAt: '2026-08-16T12:00:00.000Z',
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
      createdAt: '2026-08-16T12:00:00.000Z',
    });
    await workoutService.movePlannedExerciseUp(db.conn, 10, 100);
    const list = await workoutService.listPlannedExercisesBySession(db.conn, 10);
    expect(list.map((p) => p.planned.id)).toEqual([100, 101]);
  });

  it('movePlannedExerciseDown is a no-op at the bottom of the list', async () => {
    await seedWorkoutSheetRow(db, {
      id: 1,
      name: 'Push day',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await seedWorkoutSessionRow(db, {
      id: 10,
      sheetId: 1,
      name: 'Push',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
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
      createdAt: '2026-08-16T12:00:00.000Z',
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
      createdAt: '2026-08-16T12:00:00.000Z',
    });
    await workoutService.movePlannedExerciseDown(db.conn, 10, 101);
    const list = await workoutService.listPlannedExercisesBySession(db.conn, 10);
    expect(list.map((p) => p.planned.id)).toEqual([100, 101]);
  });
});

// ---------------------------------------------------------------------------
// 4. Performed workout lifecycle — start from session, add exercise, sets,
//    finish / abandon, find in-progress.
// ---------------------------------------------------------------------------

describe('workoutService performed-workout lifecycle', () => {
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

  it('startWorkoutFromSession clones planned exercises into performed rows with name snapshots', async () => {
    await seedWorkoutSheetRow(db, {
      id: 1,
      name: 'Push day',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await seedWorkoutSessionRow(db, {
      id: 10,
      sheetId: 1,
      name: 'Push',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
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
      createdAt: '2026-08-16T12:00:00.000Z',
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
      createdAt: '2026-08-16T12:00:00.000Z',
    });
    const w = await workoutService.startWorkoutFromSession(db.conn, {
      sheetId: 1,
      sessionId: 10,
      refDate: '2026-08-16',
    });
    expect(w.performedWorkout.sheetId).toBe(1);
    expect(w.performedWorkout.sessionId).toBe(10);
    expect(w.performedWorkout.sheetNameSnapshot).toBe('Push day');
    expect(w.performedWorkout.sessionNameSnapshot).toBe('Push');
    expect(w.performedWorkout.status).toBe('in_progress');
    expect(w.performedWorkout.refDate).toBe('2026-08-16');
    // Two performed exercises cloned in plan order.
    expect(w.exercises).toHaveLength(2);
    expect(w.exercises.map((e) => e.performedExercise.exerciseNameSnapshot)).toEqual([
      'Barbell bench press',
      'Overhead press',
    ]);
    expect(w.exercises[0]?.exercise?.id).toBe('exercise:barbell_bench_press');
    expect(w.exercises[1]?.exercise?.id).toBe('exercise:overhead_press');
    // Each performed exercise starts with no sets.
    expect(w.exercises.every((e) => e.sets.length === 0)).toBe(true);
  });

  it('startWorkoutFromSession throws when the sheet/session link is broken', async () => {
    await seedWorkoutSheetRow(db, {
      id: 1,
      name: 'Push day',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    // Session belongs to a different sheet (id=99).
    await seedWorkoutSessionRow(db, {
      id: 10,
      sheetId: 99,
      name: 'Push',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await expect(
      workoutService.startWorkoutFromSession(db.conn, {
        sheetId: 1,
        sessionId: 10,
        refDate: '2026-08-16',
      }),
    ).rejects.toThrow(/does not belong to sheet/);
  });

  it('addPerformedExercise adds a new exercise to an in-progress workout', async () => {
    await seedWorkoutSheetRow(db, {
      id: 1,
      name: 'Push day',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await seedWorkoutSessionRow(db, {
      id: 10,
      sheetId: 1,
      name: 'Push',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await seedPerformedWorkoutRow(db, {
      id: 1,
      refDate: '2026-08-16',
      sheetId: 1,
      sessionId: 10,
      sheetNameSnapshot: 'Push day',
      sessionNameSnapshot: 'Push',
      status: 'in_progress',
      startedAt: '2026-08-16T19:00:00.000Z',
      finishedAt: null,
      notes: null,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    const peId = await workoutService.addPerformedExercise(db.conn, {
      performedWorkoutId: 1,
      exerciseId: 'exercise:dips',
      exerciseName: 'Dips',
      muscleGroup: 'chest',
    });
    // The id-feedback loop returns 0 in the dev stub, but the row exists
    // and the workout now lists one performed exercise.
    expect(peId).toBe(0);
    const workout = await workoutService.getPerformedWorkout(db.conn, 1);
    expect(workout?.exercises).toHaveLength(1);
    expect(workout?.exercises[0]?.performedExercise.exerciseNameSnapshot).toBe('Dips');
    expect(workout?.exercises[0]?.performedExercise.exerciseId).toBe('exercise:dips');
  });

  it('addPerformedExercise supports ad-hoc custom exercises (no catalog link)', async () => {
    await seedPerformedWorkoutRow(db, {
      id: 1,
      refDate: '2026-08-16',
      sheetId: null,
      sessionId: null,
      sheetNameSnapshot: 'Free',
      sessionNameSnapshot: 'Free',
      status: 'in_progress',
      startedAt: '2026-08-16T19:00:00.000Z',
      finishedAt: null,
      notes: null,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await workoutService.addPerformedExercise(db.conn, {
      performedWorkoutId: 1,
      exerciseId: null,
      exerciseName: 'Sled push',
      muscleGroup: 'legs',
    });
    const workout = await workoutService.getPerformedWorkout(db.conn, 1);
    expect(workout?.exercises[0]?.performedExercise.exerciseId).toBeNull();
    expect(workout?.exercises[0]?.performedExercise.exerciseNameSnapshot).toBe('Sled push');
    expect(workout?.exercises[0]?.exercise).toBeNull();
  });

  it('deletePerformedExercise removes the performed row from the workout', async () => {
    await seedPerformedWorkoutRow(db, {
      id: 1,
      refDate: '2026-08-16',
      sheetId: null,
      sessionId: null,
      sheetNameSnapshot: 'Free',
      sessionNameSnapshot: 'Free',
      status: 'in_progress',
      startedAt: '2026-08-16T19:00:00.000Z',
      finishedAt: null,
      notes: null,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await seedPerformedExerciseRow(db, {
      id: 100,
      performedWorkoutId: 1,
      exerciseId: 'exercise:dips',
      exerciseNameSnapshot: 'Dips',
      muscleGroupSnapshot: 'chest',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
    });
    await workoutService.deletePerformedExercise(db.conn, 100);
    const workout = await workoutService.getPerformedWorkout(db.conn, 1);
    expect(workout?.exercises).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5. Set lifecycle — record / update / markCompleted / delete
// ---------------------------------------------------------------------------

describe('workoutService set lifecycle', () => {
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

  it('recordSet inserts an uncompleted set and list path picks it up', async () => {
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
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await seedPerformedExerciseRow(db, {
      id: 100,
      performedWorkoutId: 1,
      exerciseId: 'exercise:barbell_bench_press',
      exerciseNameSnapshot: 'Barbell bench press',
      muscleGroupSnapshot: 'chest',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
    });
    const set = await workoutService.recordSet(db.conn, {
      performedExerciseId: 100,
      reps: 8,
      weightKg: 80,
    });
    expect(set.reps).toBe(8);
    expect(set.weightKg).toBe(80);
    expect(set.completed).toBe(false);

    const workout = await workoutService.getPerformedWorkout(db.conn, 1);
    expect(workout?.exercises[0]?.sets).toHaveLength(1);
    expect(workout?.exercises[0]?.sets[0]?.reps).toBe(8);
  });

  it('recordSet validates negative reps and weight', async () => {
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
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await seedPerformedExerciseRow(db, {
      id: 100,
      performedWorkoutId: 1,
      exerciseId: 'exercise:barbell_bench_press',
      exerciseNameSnapshot: 'Barbell bench press',
      muscleGroupSnapshot: 'chest',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
    });
    await expect(
      workoutService.recordSet(db.conn, {
        performedExerciseId: 100,
        reps: -1,
        weightKg: 80,
      }),
    ).rejects.toThrow();
    await expect(
      workoutService.recordSet(db.conn, {
        performedExerciseId: 100,
        reps: 8,
        weightKg: -10,
      }),
    ).rejects.toThrow();
  });

  // TODO(dev-stub infra): `FakeDbConnection`'s UPDATE regex
  //   (`/SET\s+([\s\S]+?)\s+WHERE/i`) greedily matches the first `SET`
  //   token and collides with the `set` suffix of the
  //   `performed_workout_set` table identifier, misparsing the SET clause.
  //   `updateSet` / `markSetCompleted` / `deleteSet` are exercised on
  //   device per brief §54.
  it.todo('updateSet mutates reps / weight / completed on a recorded set');
  it.todo('markSetCompleted toggles the completed flag');
  it.todo('deleteSet removes the set row');
});

// ---------------------------------------------------------------------------
// 6. Workout status transitions — finish / abandon / find-in-progress
// ---------------------------------------------------------------------------

describe('workoutService status transitions', () => {
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

  it('finishWorkout sets status="completed" and stamps finishedAt', async () => {
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
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await workoutService.finishWorkout(db.conn, {
      id: 1,
      finishedAt: '2026-08-16T20:30:00.000Z',
    });
    const w = await workoutService.getPerformedWorkout(db.conn, 1);
    expect(w?.performedWorkout.status).toBe('completed');
    expect(w?.performedWorkout.finishedAt).toBe('2026-08-16T20:30:00.000Z');
  });

  it('abandonWorkout sets status="abandoned"', async () => {
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
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await workoutService.abandonWorkout(db.conn, { id: 1 });
    const w = await workoutService.getPerformedWorkout(db.conn, 1);
    expect(w?.performedWorkout.status).toBe('abandoned');
    // finishedAt is stamped from the clock (nowIso()) by the service.
    expect(w?.performedWorkout.finishedAt).toBe('2026-08-16T12:00:00.000Z');
  });

  it('findInProgressWorkout returns the in-progress row, null after finish', async () => {
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
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await seedPerformedWorkoutRow(db, {
      id: 2,
      refDate: '2026-08-16',
      sheetId: null,
      sessionId: null,
      sheetNameSnapshot: 'Pull',
      sessionNameSnapshot: 'Pull',
      status: 'completed',
      startedAt: '2026-08-16T08:00:00.000Z',
      finishedAt: '2026-08-16T09:00:00.000Z',
      notes: null,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });

    const inProgress = await workoutService.findInProgressWorkout(db.conn);
    expect(inProgress?.performedWorkout.id).toBe(1);
    expect(inProgress?.performedWorkout.status).toBe('in_progress');

    await workoutService.finishWorkout(db.conn, {
      id: 1,
      finishedAt: '2026-08-16T20:30:00.000Z',
    });
    const afterFinish = await workoutService.findInProgressWorkout(db.conn);
    expect(afterFinish).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 7. Snapshot isolation — performed workouts survive sheet/session rename
// ---------------------------------------------------------------------------

describe('workoutService snapshot isolation', () => {
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

  it('renameSheet after a workout leaves performed_workout.sheet_name_snapshot intact', async () => {
    await seedWorkoutSheetRow(db, {
      id: 1,
      name: 'Push day',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await seedWorkoutSessionRow(db, {
      id: 10,
      sheetId: 1,
      name: 'Push',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
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
      createdAt: '2026-08-16T12:00:00.000Z',
    });
    await seedPerformedWorkoutRow(db, {
      id: 1,
      refDate: '2026-08-16',
      sheetId: 1,
      sessionId: 10,
      sheetNameSnapshot: 'Push day',
      sessionNameSnapshot: 'Push',
      status: 'completed',
      startedAt: '2026-08-16T19:00:00.000Z',
      finishedAt: '2026-08-16T20:00:00.000Z',
      notes: null,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });

    // Rename the parent sheet and session *after* the workout was logged.
    await workoutService.renameSheet(db.conn, { id: 1, name: 'Push day v2' });
    await workoutService.renameSession(db.conn, { id: 10, name: 'Push (heavy)' });

    const workout = await workoutService.getPerformedWorkout(db.conn, 1);
    // Snapshots stay pinned to the original labels.
    expect(workout?.performedWorkout.sheetNameSnapshot).toBe('Push day');
    expect(workout?.performedWorkout.sessionNameSnapshot).toBe('Push');
    // The live plan rows reflect the rename.
    const live = await workoutService.findSheet(db.conn, 1);
    expect(live?.sheet.name).toBe('Push day v2');
    expect(live?.sessions[0]?.session.name).toBe('Push (heavy)');
  });

  it('deleteSheet does NOT cascade to performed_workout rows', async () => {
    await seedWorkoutSheetRow(db, {
      id: 1,
      name: 'Push day',
      position: 0,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await seedPerformedWorkoutRow(db, {
      id: 1,
      refDate: '2026-08-16',
      sheetId: 1,
      sessionId: null,
      sheetNameSnapshot: 'Push day',
      sessionNameSnapshot: 'Push day',
      status: 'completed',
      startedAt: '2026-08-16T19:00:00.000Z',
      finishedAt: '2026-08-16T20:00:00.000Z',
      notes: null,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await workoutService.deleteSheet(db.conn, 1);
    // The plan row is gone…
    expect(await workoutService.findSheet(db.conn, 1)).toBeNull();
    // …but the performed workout survives, frozen with its snapshot name.
    const survived = await workoutService.getPerformedWorkout(db.conn, 1);
    expect(survived?.performedWorkout.sheetNameSnapshot).toBe('Push day');
    expect(survived?.performedWorkout.status).toBe('completed');
  });
});

// ---------------------------------------------------------------------------
// 8. getExerciseComparison — current vs previous workout progression
// ---------------------------------------------------------------------------

describe('workoutService.getExerciseComparison', () => {
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

  it('returns null progression when there is no history', async () => {
    const result = await workoutService.getExerciseComparison(db.conn, {
      exerciseId: 'exercise:barbell_bench_press',
      locale: 'en',
    });
    expect(result.exerciseId).toBe('exercise:barbell_bench_press');
    // When there is no history the service short-circuits and returns
    // the id as the display name (it skips the translation lookup).
    expect(result.exerciseName).toBe('exercise:barbell_bench_press');
    expect(result.currentSets).toEqual([]);
    expect(result.previousSets).toBeNull();
    expect(result.progression).toEqual({
      weightDeltaKg: null,
      repsDelta: null,
      volumeDeltaKg: null,
    });
    expect(result.recordWeightKg).toBeNull();
    expect(result.recordWeightReps).toBeNull();
  });

  it('returns null progression when only one workout exists (no previous to compare)', async () => {
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
      createdAt: '2026-08-15T12:00:00.000Z',
      updatedAt: '2026-08-15T12:00:00.000Z',
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
    await seedPerformedSetRow(db, {
      id: 1000,
      performedExerciseId: 100,
      position: 0,
      reps: 8,
      weightKg: 70,
      completed: true,
      createdAt: '2026-08-15T19:30:00.000Z',
    });
    const result = await workoutService.getExerciseComparison(db.conn, {
      exerciseId: 'exercise:barbell_bench_press',
      locale: 'en',
    });
    expect(result.currentSets).toEqual([{ reps: 8, weightKg: 70 }]);
    expect(result.previousSets).toBeNull();
    // No previous workout → weight + reps deltas stay null.
    expect(result.progression.weightDeltaKg).toBeNull();
    expect(result.progression.repsDelta).toBeNull();
    // The single set is the all-time record.
    expect(result.recordWeightKg).toBe(70);
    expect(result.recordWeightReps).toBe(8);
  });

  it('returns deltas when a previous workout exists for the same exercise', async () => {
    // Older workout (id=1).
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
      createdAt: '2026-08-15T12:00:00.000Z',
      updatedAt: '2026-08-15T12:00:00.000Z',
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
    await seedPerformedSetRow(db, {
      id: 1000,
      performedExerciseId: 100,
      position: 0,
      reps: 8,
      weightKg: 70,
      completed: true,
      createdAt: '2026-08-15T19:30:00.000Z',
    });
    // Newer workout (id=2) — 8 reps @ 75kg + 6 reps @ 80kg.
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
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
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

    const result = await workoutService.getExerciseComparison(db.conn, {
      exerciseId: 'exercise:barbell_bench_press',
      locale: 'en',
    });
    // Current = workout 2 (most-recent). Previous = workout 1.
    expect(result.currentSets.map((s) => s.weightKg)).toEqual([75, 80]);
    expect(result.previousSets?.map((s) => s.weightKg)).toEqual([70]);
    // Top-set weights: prev=70, curr=80 → +10kg delta.
    expect(result.progression.weightDeltaKg).toBe(10);
    // Top-set reps: prev=8, curr=6 → -2 delta.
    expect(result.progression.repsDelta).toBe(-2);
    // Volume: prev = 8*70 = 560; curr = 8*75 + 6*80 = 600 + 480 = 1080;
    // delta = +520.
    expect(result.progression.volumeDeltaKg).toBe(520);
    // All-time best is the heaviest set across both workouts.
    expect(result.recordWeightKg).toBe(80);
    expect(result.recordWeightReps).toBe(6);
  });

  it('treats the most-recent performed_workout as "current" across multiple workouts', async () => {
    // Three workouts — middle one (id=2) is the most recent.
    await seedPerformedWorkoutRow(db, {
      id: 1,
      refDate: '2026-08-14',
      sheetId: null,
      sessionId: null,
      sheetNameSnapshot: 'Push',
      sessionNameSnapshot: 'Push',
      status: 'completed',
      startedAt: '2026-08-14T19:00:00.000Z',
      finishedAt: '2026-08-14T20:00:00.000Z',
      notes: null,
      createdAt: '2026-08-14T12:00:00.000Z',
      updatedAt: '2026-08-14T12:00:00.000Z',
    });
    await seedPerformedExerciseRow(db, {
      id: 100,
      performedWorkoutId: 1,
      exerciseId: 'exercise:barbell_bench_press',
      exerciseNameSnapshot: 'Barbell bench press',
      muscleGroupSnapshot: 'chest',
      position: 0,
      createdAt: '2026-08-14T19:30:00.000Z',
    });
    await seedPerformedSetRow(db, {
      id: 1000,
      performedExerciseId: 100,
      position: 0,
      reps: 8,
      weightKg: 60,
      completed: true,
      createdAt: '2026-08-14T19:30:00.000Z',
    });
    await seedPerformedWorkoutRow(db, {
      id: 2,
      refDate: '2026-08-15',
      sheetId: null,
      sessionId: null,
      sheetNameSnapshot: 'Push',
      sessionNameSnapshot: 'Push',
      status: 'completed',
      startedAt: '2026-08-15T19:00:00.000Z',
      finishedAt: '2026-08-15T20:00:00.000Z',
      notes: null,
      createdAt: '2026-08-15T12:00:00.000Z',
      updatedAt: '2026-08-15T12:00:00.000Z',
    });
    await seedPerformedExerciseRow(db, {
      id: 101,
      performedWorkoutId: 2,
      exerciseId: 'exercise:barbell_bench_press',
      exerciseNameSnapshot: 'Barbell bench press',
      muscleGroupSnapshot: 'chest',
      position: 0,
      createdAt: '2026-08-15T19:30:00.000Z',
    });
    await seedPerformedSetRow(db, {
      id: 1001,
      performedExerciseId: 101,
      position: 0,
      reps: 8,
      weightKg: 70,
      completed: true,
      createdAt: '2026-08-15T19:30:00.000Z',
    });
    await seedPerformedWorkoutRow(db, {
      id: 3,
      refDate: '2026-08-16',
      sheetId: null,
      sessionId: null,
      sheetNameSnapshot: 'Push',
      sessionNameSnapshot: 'Push',
      status: 'completed',
      startedAt: '2026-08-16T19:00:00.000Z',
      finishedAt: '2026-08-16T20:00:00.000Z',
      notes: null,
      createdAt: '2026-08-16T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    });
    await seedPerformedExerciseRow(db, {
      id: 102,
      performedWorkoutId: 3,
      exerciseId: 'exercise:barbell_bench_press',
      exerciseNameSnapshot: 'Barbell bench press',
      muscleGroupSnapshot: 'chest',
      position: 0,
      createdAt: '2026-08-16T19:30:00.000Z',
    });
    await seedPerformedSetRow(db, {
      id: 1002,
      performedExerciseId: 102,
      position: 0,
      reps: 8,
      weightKg: 80,
      completed: true,
      createdAt: '2026-08-16T19:30:00.000Z',
    });

    const result = await workoutService.getExerciseComparison(db.conn, {
      exerciseId: 'exercise:barbell_bench_press',
      locale: 'en',
    });
    // The dev stub groups by performed_workout_id; with id=3 the highest
    // performed_exercise id is 102 (workout 3 wins as "current").
    expect(result.currentSets).toEqual([{ reps: 8, weightKg: 80 }]);
    // Previous = workout 2 (id=2 → performed_exercise id=101).
    expect(result.previousSets).toEqual([{ reps: 8, weightKg: 70 }]);
    // Top-set weights: prev=70, curr=80 → +10kg.
    expect(result.progression.weightDeltaKg).toBe(10);
    // All-time best is 80kg across all three workouts.
    expect(result.recordWeightKg).toBe(80);
  });
});