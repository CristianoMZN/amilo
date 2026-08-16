// Lightweight tests for the foodFavorite repo.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addFavorite,
  isFavorite,
  listFavoriteFoodIds,
  listFavoriteFoods,
  removeFavorite,
} from 'src/repositories/foodFavorite';
import { insertFoodRow, insertFoodTranslationRow, type SeedFood, type TestDb, createTestDb } from './testDb';

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

const OATS: SeedFood = {
  id: 'food:oats',
  origin: 'official',
  baseAmountG: 100,
  baseUnit: 'g',
  kcal: 389,
  proteinG: 16.9,
  carbsG: 66,
  fatG: 6.9,
  fiberG: 10.6,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

async function seedFood(db: TestDb, food: SeedFood): Promise<void> {
  await insertFoodRow(db, food);
  await insertFoodTranslationRow(db, food.id, 'en', food.id, food.id);
}

describe('foodFavorite repo', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createTestDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('isFavorite returns false when nothing is favorited', async () => {
    expect(await isFavorite(db.conn, 'food:rice_white')).toBe(false);
  });

  it('addFavorite makes the food a favorite; isFavorite returns true', async () => {
    await addFavorite(db.conn, 'food:rice_white');
    expect(await isFavorite(db.conn, 'food:rice_white')).toBe(true);
  });

  it('addFavorite is idempotent (INSERT OR IGNORE on PK)', async () => {
    await addFavorite(db.conn, 'food:rice_white');
    await addFavorite(db.conn, 'food:rice_white');
    expect(await listFavoriteFoodIds(db.conn)).toEqual(['food:rice_white']);
  });

  it('removeFavorite deletes the row', async () => {
    await addFavorite(db.conn, 'food:rice_white');
    await removeFavorite(db.conn, 'food:rice_white');
    expect(await isFavorite(db.conn, 'food:rice_white')).toBe(false);
  });

  it('listFavoriteFoodIds returns every favorited id', async () => {
    await seedFood(db, RICE);
    await seedFood(db, OATS);
    await addFavorite(db.conn, 'food:rice_white');
    await addFavorite(db.conn, 'food:oats');
    const ids = await listFavoriteFoodIds(db.conn);
    expect(ids.sort()).toEqual(['food:oats', 'food:rice_white']);
  });

  it('listFavoriteFoods joins the localized name and full Food shape', async () => {
    await seedFood(db, RICE);
    await insertFoodTranslationRow(db, 'food:rice_white', 'pt-BR', 'Arroz', 'arroz');
    await addFavorite(db.conn, 'food:rice_white');
    const result = await listFavoriteFoods(db.conn, 'pt-BR');
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('food:rice_white');
    expect(result[0]?.name).toBe('Arroz');
    expect(result[0]?.kcal).toBe(130);
    expect(result[0]?.baseUnit).toBe('g');
  });

  it('listFavoriteFoods falls back to any translation if the locale is missing', async () => {
    await seedFood(db, RICE);
    // Only an 'en' translation exists.
    await addFavorite(db.conn, 'food:rice_white');
    const result = await listFavoriteFoods(db.conn, 'ja');
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('food:rice_white');
  });
});
