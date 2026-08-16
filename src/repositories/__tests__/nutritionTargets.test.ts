// Lightweight tests for `nutritionTargets` over the dev stub.
//
// The dev stub does not model `INSERT ... ON CONFLICT(id) DO UPDATE` —
// see the JSDoc at the top of `nutritionTargets.ts`. The native codepath
// is exercised on-device. The test here only verifies the read path
// (findNutritionTargets) by seeding the row directly with `INSERT OR
// IGNORE`, which the stub does support.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findNutritionTargets } from 'src/repositories/nutritionTargets';
import {
  createTestDb,
  insertNutritionTargetsRow,
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

  it('findNutritionTargets returns the row when seeded', async () => {
    await insertNutritionTargetsRow(
      db,
      2000,
      120,
      220,
      60,
      '2026-08-16T10:00:00.000Z',
    );
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

  // SKIP: upsertNutritionTargets uses `INSERT ... ON CONFLICT(id) DO UPDATE`,
  // which the dev stub does not model. The native engine handles the
  // upsert correctly; verification happens on-device.
  it.skip('upsertNutritionTargets inserts when missing', async () => {
    // Placeholder — see JSDoc above.
  });
});
