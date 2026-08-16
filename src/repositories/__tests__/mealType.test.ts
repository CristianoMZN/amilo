// Lightweight tests for the mealType repo.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  findMealType,
  findMealTypeTranslation,
  listMealTypes,
  listMealTypesWithTranslations,
  seedMealTypeIfMissing,
  seedMealTypeTranslationIfMissing,
} from 'src/repositories/mealType';
import {
  createTestDb,
  insertMealTypeRow,
  insertMealTypeTranslationRow,
  type TestDb,
} from './testDb';

async function seedStandardMealTypes(db: TestDb): Promise<void> {
  await insertMealTypeRow(db, 'breakfast', 0, true);
  await insertMealTypeRow(db, 'lunch', 1, true);
  await insertMealTypeRow(db, 'snack', 2, true);
  await insertMealTypeRow(db, 'dinner', 3, true);
  await insertMealTypeRow(db, 'supper', 4, true);
  await insertMealTypeRow(db, 'custom', 5, false);
  await insertMealTypeTranslationRow(db, 'breakfast', 'en', 'Breakfast');
  await insertMealTypeTranslationRow(db, 'breakfast', 'pt-BR', 'Café da manhã');
  await insertMealTypeTranslationRow(db, 'lunch', 'en', 'Lunch');
  await insertMealTypeTranslationRow(db, 'dinner', 'en', 'Dinner');
}

describe('mealType repo', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createTestDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('listMealTypes returns rows in sort_order', async () => {
    await seedStandardMealTypes(db);
    const types = await listMealTypes(db.conn);
    expect(types.map((t) => t.id)).toEqual([
      'breakfast',
      'lunch',
      'snack',
      'dinner',
      'supper',
      'custom',
    ]);
    expect(types[0]?.builtin).toBe(true);
    expect(types[5]?.builtin).toBe(false);
  });

  it('findMealType returns the requested row', async () => {
    await insertMealTypeRow(db, 'breakfast', 0, true);
    const mt = await findMealType(db.conn, 'breakfast');
    expect(mt?.id).toBe('breakfast');
    expect(mt?.sortOrder).toBe(0);
  });

  it('findMealType returns null for unknown ids', async () => {
    // Cast to a sentinel — the repo should never see a real id that is
    // not in the MealTypeId union, but we still want a null result.
    expect(await findMealType(db.conn, 'unknown' as 'breakfast')).toBeNull();
  });

  it('findMealTypeTranslation returns the localised row', async () => {
    await insertMealTypeRow(db, 'breakfast', 0, true);
    await insertMealTypeTranslationRow(db, 'breakfast', 'pt-BR', 'Café da manhã');
    const tr = await findMealTypeTranslation(db.conn, 'breakfast', 'pt-BR');
    expect(tr?.name).toBe('Café da manhã');
  });

  it('listMealTypesWithTranslations skips ids missing in the locale', async () => {
    await seedStandardMealTypes(db);
    const rows = await listMealTypesWithTranslations(db.conn, 'en');
    // Only 'breakfast', 'lunch', 'dinner' have an 'en' translation in the seed.
    expect(rows.map((r) => r.id).sort()).toEqual(['breakfast', 'dinner', 'lunch']);
    expect(rows[0]?.name).toBe('Breakfast');
  });

  it('seedMealTypeIfMissing is idempotent (INSERT OR IGNORE on PK)', async () => {
    await seedMealTypeIfMissing(db.conn, { id: 'breakfast', sortOrder: 0, builtin: true });
    await seedMealTypeIfMissing(db.conn, { id: 'breakfast', sortOrder: 99, builtin: false });
    const mt = await findMealType(db.conn, 'breakfast');
    // Second insert was ignored; sortOrder stays 0 and builtin stays true.
    expect(mt?.sortOrder).toBe(0);
    expect(mt?.builtin).toBe(true);
  });

  it('seedMealTypeTranslationIfMissing is idempotent (INSERT OR IGNORE on composite PK)', async () => {
    await insertMealTypeRow(db, 'breakfast', 0, true);
    await seedMealTypeTranslationIfMissing(db.conn, {
      mealTypeId: 'breakfast',
      locale: 'en',
      name: 'Breakfast',
    });
    await seedMealTypeTranslationIfMissing(db.conn, {
      mealTypeId: 'breakfast',
      locale: 'en',
      name: 'Different name',
    });
    const tr = await findMealTypeTranslation(db.conn, 'breakfast', 'en');
    expect(tr?.name).toBe('Breakfast');
  });
});
