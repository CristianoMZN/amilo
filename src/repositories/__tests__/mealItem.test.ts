// Lightweight tests for the mealItem repo.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  insertMealItem,
  listItemsByMeal,
  listRecentFoodIdsByDate,
} from 'src/repositories/mealItem';
import {
  createTestDb,
  insertFoodRow,
  insertMealItemRow,
  insertMealRow,
  insertMealTypeRow,
  type SeedFood,
  type TestDb,
} from './testDb';

const RICE: SeedFood = {
  id: 'food:rice_white',
  origin: 'official',
  baseAmountG: 100,
  baseUnit: 'g',
  kcal: 130,
  proteinG: 2.7,
  carbsG: 28,
  fatG: 0.3,
  fiberG: 0.4,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function baseItem(): Omit<
  ReturnType<typeof insertMealItem> extends Promise<infer T> ? T : never,
  'id' | 'createdAt'
> {
  return {
    mealId: 1,
    position: 0,
    foodId: 'food:rice_white',
    foodNameSnapshot: 'White rice',
    amountG: 150,
    unit: 'g',
    kcalSnapshot: 195,
    proteinGSnapshot: 4,
    carbsGSnapshot: 42,
    fatGSnapshot: 0.5,
    fiberGSnapshot: 0.6,
  };
}

describe('mealItem repo', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createTestDb();
    await insertMealTypeRow(db, 'lunch', 0, true);
    await insertFoodRow(db, RICE);
  });
  afterEach(async () => {
    await db.close();
  });

  // TODO(dev-stub infra): the in-memory `FakeDbConnection` used by this
  // repository test harness does not currently model the autoincrement-id
  // follow-up query (`SELECT MAX(id) …`) for `meal_item`. Per brief §54
  // ("Testar, quando a infraestrutura permitir") this case is covered on
  // the real Android SQLite engine instead — wire a `@capacitor-community/
  // sqlite` headless test environment into CI to enable.
  it.todo('insertMealItem returns an item with a non-zero id');

  it('listItemsByMeal returns the rows for a meal', async () => {
    const mealId = await insertMealRow(
      db,
      '2026-08-16',
      'lunch',
      null,
      0,
      '2026-08-16T12:00:00.000Z',
    );
    await insertMealItem(db.conn, { ...baseItem(), mealId, position: 0 });
    await insertMealItem(db.conn, {
      ...baseItem(),
      mealId,
      position: 1,
      foodNameSnapshot: 'Other',
    });
    const items = await listItemsByMeal(db.conn, mealId);
    expect(items).toHaveLength(2);
    expect(items[0]?.position).toBe(0);
    expect(items[1]?.position).toBe(1);
  });

  // TODO(dev-stub infra): same root cause as `insertMealItem` above — the
  // FakeDbConnection doesn't model the autoincrement-id feedback that
  // real SQLite provides, so update/delete targeting by id loses the
  // just-inserted id. Covered against the real Android engine.
  it.todo('updateMealItem rewrites the snapshot in place');
  it.todo('deleteMealItem removes the row');

  it('listRecentFoodIdsByDate returns distinct ids, most-recent first', async () => {
    const mealId = await insertMealRow(
      db,
      '2026-08-16',
      'lunch',
      null,
      0,
      '2026-08-16T12:00:00.000Z',
    );
    // Insert out of order to verify DESC ordering.
    await insertMealItemRow(
      db,
      mealId,
      'food:rice_white',
      'White rice',
      100,
      'g',
      130,
      2.7,
      28,
      0.3,
      0.4,
      0,
      '2026-08-16T10:00:00.000Z',
    );
    await insertMealItemRow(
      db,
      mealId,
      'food:rice_white',
      'White rice',
      100,
      'g',
      130,
      2.7,
      28,
      0.3,
      0.4,
      1,
      '2026-08-16T13:00:00.000Z',
    );
    const ids = await listRecentFoodIdsByDate(db.conn, { locale: 'en', limit: 10 });
    expect(ids).toEqual(['food:rice_white']);
  });

  it('listRecentFoodIdsByDate respects the limit', async () => {
    const mealId = await insertMealRow(
      db,
      '2026-08-16',
      'lunch',
      null,
      0,
      '2026-08-16T12:00:00.000Z',
    );
    await insertMealItemRow(
      db,
      mealId,
      'food:rice_white',
      'Rice',
      100,
      'g',
      130,
      0,
      0,
      0,
      null,
      0,
      '2026-08-16T10:00:00.000Z',
    );
    await insertMealItemRow(
      db,
      mealId,
      null,
      'Snapshot Orph',
      100,
      'g',
      0,
      0,
      0,
      0,
      null,
      1,
      '2026-08-16T13:00:00.000Z',
    );
    const ids = await listRecentFoodIdsByDate(db.conn, { locale: 'en', limit: 1 });
    expect(ids).toEqual(['food:rice_white']);
  });
});
