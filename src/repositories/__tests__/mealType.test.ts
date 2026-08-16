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

describe('mealType repo', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createTestDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('listMealTypes returns rows sorted by sortOrder', async () => {
    await insertMealTypeRow(db, 'lunch', 1, true);
    await insertMealTypeRow(db, 'breakfast', 0, true);
    await insertMealTypeRow(db, 'dinner', 3, true);
    const list = await listMealTypes(db.conn);
    expect(list.map((t) => t.id)).toEqual(['breakfast', 'lunch', 'dinner']);
  });

  it('findMealType returns a single row by id', async () => {
    await insertMealTypeRow(db, 'breakfast', 0, true);
    const mt = await findMealType(db.conn, 'breakfast');
    expect(mt).toEqual({ id: 'breakfast', sortOrder: 0, builtin: true });
  });

  it('findMealType returns null for unknown ids', async () => {
    // Cast to `MealTypeId` deliberately — the repo's type guard would
    // reject unknown ids at runtime, but the test simulates a stale row.
    expect(await findMealType(db.conn, 'brunch' as 'breakfast')).toBeNull();
  });

  it('findMealTypeTranslation returns the localized name', async () => {
    await insertMealTypeRow(db, 'breakfast', 0, true);
    await insertMealTypeTranslationRow(db, 'breakfast', 'pt-BR', 'Café da manhã');
    const tr = await findMealTypeTranslation(db.conn, 'breakfast', 'pt-BR');
    expect(tr?.name).toBe('Café da manhã');
  });

  it('listMealTypesWithTranslations drops rows without a translation', async () => {
    await insertMealTypeRow(db, 'breakfast', 0, true);
    await insertMealTypeRow(db, 'lunch', 1, true);
    await insertMealTypeTranslationRow(db, 'breakfast', 'en', 'Breakfast');
    const list = await listMealTypesWithTranslations(db.conn, 'en');
    expect(list.map((t) => t.id)).toEqual(['breakfast']);
  });

  it('seedMealTypeIfMissing is idempotent', async () => {
    await seedMealTypeIfMissing(db.conn, { id: 'breakfast', sortOrder: 0, builtin: true });
    await seedMealTypeIfMissing(db.conn, { id: 'breakfast', sortOrder: 99, builtin: false });
    const mt = await findMealType(db.conn, 'breakfast');
    // First row wins (INSERT OR IGNORE).
    expect(mt?.sortOrder).toBe(0);
    expect(mt?.builtin).toBe(true);
  });

  it('seedMealTypeTranslationIfMissing is idempotent', async () => {
    await insertMealTypeRow(db, 'breakfast', 0, true);
    await seedMealTypeTranslationIfMissing(db.conn, {
      mealTypeId: 'breakfast',
      locale: 'en',
      name: 'Breakfast',
    });
    await seedMealTypeTranslationIfMissing(db.conn, {
      mealTypeId: 'breakfast',
      locale: 'en',
      name: 'Other',
    });
    const tr = await findMealTypeTranslation(db.conn, 'breakfast', 'en');
    expect(tr?.name).toBe('Breakfast');
  });
});
