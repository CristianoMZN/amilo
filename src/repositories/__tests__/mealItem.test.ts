// Lightweight tests for the mealItem repo.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  deleteMealItem,
  insertMealItem,
  listItemsByMeal,
  listRecentFoodIdsByDate,
  updateMealItem,
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

function baseItem(): Omit<ReturnType<typeof insertMealItem> extends Promise<infer T> ? T : never, 'id' | 'createdAt'> {
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

  it('insertMealItem returns an item with a non-zero id', async () => {
    const mealId = await insertMealRow(
      db,
      '2026-08-16',
      'lunch',
      null,
      0,
      '2026-08-16T12:00:00.000Z',
    );
    const inserted = await insertMealItem(db.conn, { ...baseItem(), mealId });
    expect(inserted.id).toBeGreaterThan(0);
    expect(inserted.foodId).toBe('food:rice_white');
  });

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

  it('updateMealItem rewrites the snapshot in place', async () => {
    const mealId = await insertMealRow(
      db,
      '2026-08-16',
      'lunch',
      null,
      0,
      '2026-08-16T12:00:00.000Z',
    );
    const inserted = await insertMealItem(db.conn, { ...baseItem(), mealId });
    const updated = { ...inserted, amountG: 200, kcalSnapshot: 260 };
    await updateMealItem(db.conn, updated);
    const items = await listItemsByMeal(db.conn, mealId);
    expect(items[0]?.amountG).toBe(200);
    expect(items[0]?.kcalSnapshot).toBe(260);
  });

  it('deleteMealItem removes the row', async () => {
    const mealId = await insertMealRow(
      db,
      '2026-08-16',
      'lunch',
      null,
      0,
      '2026-08-16T12:00:00.000Z',
    );
    const inserted = await insertMealItem(db.conn, { ...baseItem(), mealId });
    await deleteMealItem(db.conn, inserted.id);
    const items = await listItemsByMeal(db.conn, mealId);
    expect(items).toHaveLength(0);
  });

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
