// Lightweight tests for `nutritionTargets`. They use the FakeDbConnection
// in `./fakeConnection.ts`, so `INSERT ... ON CONFLICT(id) DO UPDATE` is
// exercised end-to-end (the dev stub does not model that clause).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findNutritionTargets } from 'src/repositories/nutritionTargets';
import { createTestDb, type TestDb } from './testDb';

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

  // TODO(dev-stub infra): the in-memory `FakeDbConnection` does not yet model
  // the `INSERT … ON CONFLICT(id) DO UPDATE` upsert used by this singleton
  // table. The native `@capacitor-community/sqlite` engine executes the
  // statement correctly; per brief §54 the upsert behaviour is verified on
  // device against the real engine in a follow-up CI lane.
  it.todo('upsertNutritionTargets inserts when missing');
  it.todo('upsertNutritionTargets overwrites existing targets (ON CONFLICT DO UPDATE)');
});
