// Lightweight tests for `nutritionTargets`. They use the FakeDbConnection
// in `./fakeConnection.ts`, so `INSERT ... ON CONFLICT(id) DO UPDATE` is
// exercised end-to-end (the dev stub does not model that clause).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  findNutritionTargets,
  upsertNutritionTargets,
} from 'src/repositories/nutritionTargets';
import { nowIso } from 'src/util/dateDay';
import {
  createTestDb,
  type TestDb,
} from './testDb';

describe('nutritionTargets repo', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createTestDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('findNutritionTargets returns null when no row exists', async () => {
    const result = await findNutritionTargets(db.conn);
    expect(result).toBeNull();
  });

  it('upsertNutritionTargets inserts when missing', async () => {
    await upsertNutritionTargets(db.conn, {
      id: 1,
      kcalTarget: 2000,
      proteinGTarget: 120,
      carbsGTarget: 220,
      fatGTarget: 60,
      updatedAt: '2026-08-16T10:00:00.000Z',
    });
    const result = await findNutritionTargets(db.conn);
    expect(result).toEqual({
      id: 1,
      kcalTarget: 2000,
      proteinGTarget: 120,
      carbsGTarget: 220,
      fatGTarget: 60,
      updatedAt: '2026-08-16T10:00:00.000Z',
    });
  });

  it('upsertNutritionTargets overwrites existing targets (ON CONFLICT DO UPDATE)', async () => {
    await upsertNutritionTargets(db.conn, {
      id: 1,
      kcalTarget: 2000,
      proteinGTarget: 120,
      carbsGTarget: 220,
      fatGTarget: 60,
      updatedAt: '2026-08-16T10:00:00.000Z',
    });
    await upsertNutritionTargets(db.conn, {
      id: 1,
      kcalTarget: 1800,
      proteinGTarget: 130,
      carbsGTarget: 200,
      fatGTarget: 55,
      updatedAt: nowIso(),
    });
    const result = await findNutritionTargets(db.conn);
    expect(result?.kcalTarget).toBe(1800);
    expect(result?.proteinGTarget).toBe(130);
    // Id is a singleton — only one row.
    const rows = await db.query<unknown>('SELECT * FROM nutrition_targets');
    expect(rows).toHaveLength(1);
  });
});
