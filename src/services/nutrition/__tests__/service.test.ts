import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nutritionService } from 'src/services/nutrition';
import { createTestDb, insertFoodRow, insertFoodTranslationRow, type TestDb } from 'src/repositories/__tests__/testDb';

const OFF_CEREAL = {
  source: 'open_food_facts' as const,
  externalId: '7622210449283',
  barcode: '7622210449283',
  name: 'Cereal',
  brand: 'Nesfit',
  baseAmountG: 100,
  baseUnit: 'g' as const,
  kcal: 389,
  proteinG: 8,
  carbsG: 78,
  fatG: 5,
  fiberG: 7,
};

const LOCAL_RICE = {
  id: 'food:rice_white',
  origin: 'official' as const,
  barcode: '7891234567890',
  baseAmountG: 100,
  baseUnit: 'g' as const,
  kcal: 130,
  proteinG: 2.7,
  carbsG: 28.2,
  fatG: 0.3,
  fiberG: 0.4,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('nutritionService Open Food Facts helpers', () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  afterEach(async () => {
    await db.close();
  });

  it('imports an external food only once by barcode/external id', async () => {
    const first = await nutritionService.importExternalFood(db.conn, {
      food: OFF_CEREAL,
      locale: 'en',
    });
    const second = await nutritionService.importExternalFood(db.conn, {
      food: OFF_CEREAL,
      locale: 'en',
    });

    expect(first.id).toBe(second.id);
    const foods = await db.query<{ id: string }>('SELECT id FROM food ORDER BY id ASC');
    expect(foods).toHaveLength(1);
    const translations = await db.query<{ food_id: string }>('SELECT food_id FROM food_translation');
    expect(translations).toHaveLength(1);
  });

  it('resolves a local barcode without touching the network', async () => {
    await insertFoodRow(db, LOCAL_RICE);
    await insertFoodTranslationRow(db, LOCAL_RICE.id, 'en', 'White rice', 'white rice');

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await nutritionService.resolveFoodByBarcode(db.conn, {
      barcode: LOCAL_RICE.barcode,
      locale: 'en',
    });

    expect(result?.id).toBe(LOCAL_RICE.id);
    expect(result?.name).toBe('White rice');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
