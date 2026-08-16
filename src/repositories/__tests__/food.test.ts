// Lightweight tests for the food + foodTranslation repos over the dev stub.
//
// The dev stub does not model `INSERT ... ON CONFLICT ... DO UPDATE`.
// The `insertFood` and `upsertFoodTranslation` upserts are exercised on
// the native engine; the read paths below are covered with direct
// seeds (which let the stub auto-assign the synthetic `id`).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  findFoodById,
  listAllOfficialFoodIds,
  listCustomFoods,
  listFoods,
  listOfficialFoods,
  searchFoods,
  updateFood,
} from 'src/repositories/food';
import {
  findAnyTranslation,
  findFoodTranslation,
  listTranslationsForFood,
} from 'src/repositories/foodTranslation';
import {
  createTestDb,
  insertFoodRow,
  insertFoodTranslationRow,
  type SeedFood,
  type TestDb,
} from './testDb';

const OFFICIAL_RICE: SeedFood = {
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

const OFFICIAL_OATS: SeedFood = {
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

const CUSTOM_AVOCADO: SeedFood = {
  id: 'food:user:avocado',
  origin: 'custom',
  baseAmountG: 100,
  baseUnit: 'g',
  kcal: 160,
  proteinG: 2,
  carbsG: 9,
  fatG: 15,
  fiberG: 7,
  createdAt: '2026-02-01T00:00:00.000Z',
  updatedAt: '2026-02-01T00:00:00.000Z',
};

async function seedFood(db: TestDb, food: SeedFood): Promise<void> {
  await insertFoodRow(db, food);
  await insertFoodTranslationRow(db, food.id, 'en', 'Placeholder', 'placeholder');
  await insertFoodTranslationRow(db, food.id, 'pt-BR', 'Marcador', 'marcador');
}

describe('food repo', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createTestDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('findFoodById returns the seeded row', async () => {
    await seedFood(db, OFFICIAL_RICE);
    const rice = await findFoodById(db.conn, 'food:rice_white');
    expect(rice).not.toBeNull();
    expect(rice?.kcal).toBe(130);
    expect(rice?.fiberG).toBe(0.4);
  });

  it('findFoodById returns null for unknown ids', async () => {
    const result = await findFoodById(db.conn, 'food:unknown');
    expect(result).toBeNull();
  });

  it('listAllOfficialFoodIds filters by origin', async () => {
    await seedFood(db, OFFICIAL_RICE);
    await seedFood(db, OFFICIAL_OATS);
    await seedFood(db, CUSTOM_AVOCADO);
    const ids = await listAllOfficialFoodIds(db.conn);
    expect(ids).toEqual(['food:oats', 'food:rice_white']);
  });

  it('listFoods returns the requested origin only', async () => {
    await seedFood(db, OFFICIAL_RICE);
    await seedFood(db, CUSTOM_AVOCADO);
    const official = await listFoods(db.conn, { origin: 'official' });
    const custom = await listFoods(db.conn, { origin: 'custom' });
    expect(official.map((f) => f.id)).toEqual(['food:rice_white']);
    expect(custom.map((f) => f.id)).toEqual(['food:user:avocado']);
  });

  it('listOfficialFoods joins the localized name', async () => {
    await seedFood(db, OFFICIAL_RICE);
    const [rice] = await listOfficialFoods(db.conn, 'pt-BR');
    expect(rice).toBeDefined();
    expect(rice?.id).toBe('food:rice_white');
    expect(rice?.name).toBe('Marcador');
  });

  it('listCustomFoods joins the localized name', async () => {
    await seedFood(db, CUSTOM_AVOCADO);
    const [avocado] = await listCustomFoods(db.conn, 'en');
    expect(avocado?.id).toBe('food:user:avocado');
    expect(avocado?.name).toBe('Placeholder');
  });

  it('searchFoods matches the normalized search blob', async () => {
    await insertFoodRow(db, OFFICIAL_RICE);
    await insertFoodTranslationRow(db, 'food:rice_white', 'en', 'White rice', 'white rice');
    const results = await searchFoods(db.conn, { locale: 'en', query: 'rice' });
    expect(results.map((r) => r.id)).toContain('food:rice_white');
  });

  it('searchFoods returns [] for an empty query', async () => {
    const results = await searchFoods(db.conn, { locale: 'en', query: '   ' });
    expect(results).toEqual([]);
  });

  it('searchFoods returns [] when no match', async () => {
    await seedFood(db, OFFICIAL_RICE);
    const results = await searchFoods(db.conn, { locale: 'en', query: 'sushi' });
    expect(results).toEqual([]);
  });

  it('updateFood rewrites every mutable column', async () => {
    await seedFood(db, OFFICIAL_RICE);
    const updated = { ...OFFICIAL_RICE, kcal: 999, updatedAt: '2026-06-01T00:00:00.000Z' };
    await updateFood(db.conn, updated);
    const result = await findFoodById(db.conn, 'food:rice_white');
    expect(result?.kcal).toBe(999);
    expect(result?.updatedAt).toBe('2026-06-01T00:00:00.000Z');
  });

  // SKIP: insertFood uses `INSERT ... ON CONFLICT(id) DO UPDATE`, which
  // the dev stub does not model. The native engine handles the upsert.
  it.skip('insertFood upserts a new row', async () => {
    // Placeholder — see the JSDoc on `food.ts`.
  });

  // SKIP: deleteFood runs DELETE cascaded by the dev stub. Tested on-device.
  it.skip('deleteFood cascades to food_translation', async () => {
    // Placeholder.
  });
});

describe('foodTranslation repo', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createTestDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('findFoodTranslation returns the row for the requested locale', async () => {
    await seedFood(db, OFFICIAL_RICE);
    const tr = await findFoodTranslation(db.conn, 'food:rice_white', 'pt-BR');
    expect(tr?.name).toBe('Marcador');
    expect(tr?.locale).toBe('pt-BR');
  });

  it('findFoodTranslation returns null for missing locale', async () => {
    await seedFood(db, OFFICIAL_RICE);
    const tr = await findFoodTranslation(db.conn, 'food:rice_white', 'ja');
    expect(tr).toBeNull();
  });

  it('findAnyTranslation returns the first available translation', async () => {
    await insertFoodRow(db, OFFICIAL_RICE);
    await insertFoodTranslationRow(db, 'food:rice_white', 'fr', 'Riz', 'riz');
    const tr = await findAnyTranslation(db.conn, 'food:rice_white');
    expect(tr).not.toBeNull();
    expect(['en', 'fr', 'pt-BR']).toContain(tr?.locale);
  });

  it('listTranslationsForFood returns every locale row', async () => {
    await seedFood(db, OFFICIAL_RICE);
    const translations = await listTranslationsForFood(db.conn, 'food:rice_white');
    expect(translations.map((t) => t.locale).sort()).toEqual(['en', 'pt-BR']);
  });

  // SKIP: upsertFoodTranslation uses `INSERT ... ON CONFLICT(food_id, locale)
  // DO UPDATE`, which the dev stub does not model.
  it.skip('upsertFoodTranslation updates the name on conflict', async () => {
    // Placeholder.
  });
});
