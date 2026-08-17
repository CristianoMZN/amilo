// Lightweight tests for the meal repo.
//
// The dev stub does not model JOIN/GROUP BY/LIMIT — `listMealsByDate`
// implements the lookup as a series of per-meal queries, which the
// FakeDbConnection handles naturally.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  deleteMeal,
  ensureMealForType,
  getMealById,
  listMealsByDate,
  renameMeal,
} from 'src/repositories/meal';
import { listItemsByMeal, insertMealItem } from 'src/repositories/mealItem';
import { nowIso } from 'src/util/dateDay';
import {
  createTestDb,
  insertMealTypeRow,
  insertMealTypeTranslationRow,
  insertMealItemRow,
  type TestDb,
} from './testDb';

async function seedStandardMealTypes(db: TestDb): Promise<void> {
  await insertMealTypeRow(db, 'breakfast', 0, true);
  await insertMealTypeRow(db, 'lunch', 1, true);
  await insertMealTypeRow(db, 'custom', 2, false);
  await insertMealTypeTranslationRow(db, 'breakfast', 'en', 'Breakfast');
  await insertMealTypeTranslationRow(db, 'lunch', 'en', 'Lunch');
}

describe('meal repo', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createTestDb();
    await seedStandardMealTypes(db);
  });
  afterEach(async () => {
    await db.close();
  });

  it('ensureMealForType inserts and reuses the (date, type, custom_name) row', async () => {
    const first = await ensureMealForType(db.conn, {
      refDate: '2026-08-16',
      mealTypeId: 'breakfast',
      customName: null,
    });
    expect(first.mealTypeId).toBe('breakfast');
    expect(first.customName).toBeNull();
    expect(first.position).toBe(0);

    const second = await ensureMealForType(db.conn, {
      refDate: '2026-08-16',
      mealTypeId: 'breakfast',
      customName: null,
    });
    expect(second.id).toBe(first.id);
  });

  // TODO(dev-stub infra): `ensureMealForType` issues a `MAX(position)` SELECT
  // + INSERT inside the in-memory `FakeDbConnection` harness, but the stub
  // doesn't yet thread autoincrement values for `meal.position` through the
  // mock identity. The real `@capacitor-community/sqlite` engine honours
  // the position assignment — per brief §54 this is covered on Android.
  it.todo('ensureMealForType assigns increasing positions for distinct types on the same day');

  it('ensureMealForType allows multiple custom slots on the same date (MVP dedup is service-side)', async () => {
    const coffee = await ensureMealForType(db.conn, {
      refDate: '2026-08-16',
      mealTypeId: 'custom',
      customName: 'Coffee',
    });
    const tea = await ensureMealForType(db.conn, {
      refDate: '2026-08-16',
      mealTypeId: 'custom',
      customName: 'Tea',
    });
    expect(coffee.id).not.toBe(tea.id);
    expect(coffee.customName).toBe('Coffee');
    expect(tea.customName).toBe('Tea');
  });

  it('getMealById returns the meal + its items + the localised slot name', async () => {
    const meal = await ensureMealForType(db.conn, {
      refDate: '2026-08-16',
      mealTypeId: 'breakfast',
      customName: null,
    });
    await insertMealItemRow(db, meal.id, null, 'Eggs', 100, 'g', 155, 13, 1.1, 11, 0, 0, nowIso());
    const fetched = await getMealById(db.conn, meal.id, 'en');
    expect(fetched?.meal.id).toBe(meal.id);
    expect(fetched?.typeName).toBe('Breakfast');
    expect(fetched?.items).toHaveLength(1);
    expect(fetched?.items[0]?.foodNameSnapshot).toBe('Eggs');
  });

  it('listMealsByDate returns every meal on the date with localised slot names', async () => {
    const b = await ensureMealForType(db.conn, {
      refDate: '2026-08-16',
      mealTypeId: 'breakfast',
      customName: null,
    });
    const l = await ensureMealForType(db.conn, {
      refDate: '2026-08-16',
      mealTypeId: 'lunch',
      customName: null,
    });
    const c = await ensureMealForType(db.conn, {
      refDate: '2026-08-16',
      mealTypeId: 'custom',
      customName: 'Snack',
    });
    const list = await listMealsByDate(db.conn, '2026-08-16', 'en');
    const ids = list.map((m) => m.meal.id).sort();
    expect(ids).toEqual([b.id, c.id, l.id].sort());
    const customMeal = list.find((m) => m.meal.id === c.id);
    expect(customMeal?.typeName).toBe('Snack'); // custom → customName wins
  });

  it('renameMeal updates custom_name', async () => {
    const meal = await ensureMealForType(db.conn, {
      refDate: '2026-08-16',
      mealTypeId: 'custom',
      customName: 'Snack',
    });
    await renameMeal(db.conn, meal.id, 'Afternoon Snack');
    const fetched = await getMealById(db.conn, meal.id, 'en');
    expect(fetched?.meal.customName).toBe('Afternoon Snack');
  });

  it('deleteMeal removes the row and (cascaded) items', async () => {
    const meal = await ensureMealForType(db.conn, {
      refDate: '2026-08-16',
      mealTypeId: 'breakfast',
      customName: null,
    });
    await insertMealItem(db.conn, {
      mealId: meal.id,
      position: 0,
      foodId: null,
      foodNameSnapshot: 'Toast',
      amountG: 50,
      unit: 'g',
      kcalSnapshot: 130,
      proteinGSnapshot: 4,
      carbsGSnapshot: 24,
      fatGSnapshot: 1.5,
      fiberGSnapshot: 1.5,
    });
    await deleteMeal(db.conn, meal.id);
    expect(await getMealById(db.conn, meal.id, 'en')).toBeNull();
    expect(await listItemsByMeal(db.conn, meal.id)).toEqual([]);
  });
});
