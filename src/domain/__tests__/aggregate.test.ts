import { describe, expect, it } from 'vitest';
import { aggregateItems, aggregateMeals } from 'src/domain/aggregate';

function item(overrides: {
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number | null;
}) {
  return {
    kcalSnapshot: overrides.kcal ?? 0,
    proteinGSnapshot: overrides.proteinG ?? 0,
    carbsGSnapshot: overrides.carbsG ?? 0,
    fatGSnapshot: overrides.fatG ?? 0,
    fiberGSnapshot: overrides.fiberG ?? null,
  };
}

describe('aggregateItems', () => {
  it('returns a zero snapshot with null fiber for an empty list', () => {
    const result = aggregateItems([]);
    expect(result.kcal).toBe(0);
    expect(result.proteinG).toBe(0);
    expect(result.carbsG).toBe(0);
    expect(result.fatG).toBe(0);
    expect(result.fiberG).toBeNull();
  });

  it('returns the single item unchanged when given one entry', () => {
    const only = item({ kcal: 420, proteinG: 32, carbsG: 50, fatG: 12, fiberG: 6 });
    expect(aggregateItems([only])).toEqual({
      kcal: 420,
      proteinG: 32,
      carbsG: 50,
      fatG: 12,
      fiberG: 6,
    });
  });

  it('sums multiple items across all macronutrients', () => {
    const a = item({ kcal: 100, proteinG: 10, carbsG: 20, fatG: 5, fiberG: 2 });
    const b = item({ kcal: 250, proteinG: 15, carbsG: 30, fatG: 8, fiberG: 4 });
    const c = item({ kcal: 75, proteinG: 5, carbsG: 10, fatG: 2, fiberG: 1 });
    const result = aggregateItems([a, b, c]);
    expect(result.kcal).toBe(425);
    expect(result.proteinG).toBe(30);
    expect(result.carbsG).toBe(60);
    expect(result.fatG).toBeCloseTo(15, 10);
    expect(result.fiberG).toBeCloseTo(7, 10);
  });

  it('keeps fiberG null when no item contributes a fiber value', () => {
    const a = item({ kcal: 100, fiberG: null });
    const b = item({ kcal: 200, fiberG: null });
    const result = aggregateItems([a, b]);
    expect(result.kcal).toBe(300);
    expect(result.fiberG).toBeNull();
  });

  it('skips null fiber entries and sums only non-null values', () => {
    const a = item({ kcal: 100, fiberG: 5 });
    const b = item({ kcal: 200, fiberG: null });
    const c = item({ kcal: 300, fiberG: 3 });
    const result = aggregateItems([a, b, c]);
    expect(result.kcal).toBe(600);
    expect(result.fiberG).toBe(8);
  });

  it('handles a single non-null fiber entry', () => {
    const only = item({ kcal: 100, fiberG: 4 });
    expect(aggregateItems([only]).fiberG).toBe(4);
  });
});

describe('aggregateMeals', () => {
  it('returns an empty snapshot for an empty meal list', () => {
    const result = aggregateMeals([]);
    expect(result.kcal).toBe(0);
    expect(result.fiberG).toBeNull();
  });

  it('sums items across multiple meals', () => {
    const meals = [
      {
        items: [
          item({ kcal: 200, proteinG: 10, carbsG: 30, fatG: 5, fiberG: 2 }),
          item({ kcal: 150, proteinG: 8, carbsG: 20, fatG: 3, fiberG: 1 }),
        ],
      },
      {
        items: [item({ kcal: 100, proteinG: 5, carbsG: 15, fatG: 2, fiberG: null })],
      },
    ];
    const result = aggregateMeals(meals);
    expect(result.kcal).toBe(450);
    expect(result.proteinG).toBe(23);
    expect(result.carbsG).toBe(65);
    expect(result.fatG).toBe(10);
    expect(result.fiberG).toBe(3);
  });

  it('handles meals with no items', () => {
    const meals = [{ items: [] }, { items: [item({ kcal: 100, fiberG: 2 })] }, { items: [] }];
    const result = aggregateMeals(meals);
    expect(result.kcal).toBe(100);
    expect(result.fiberG).toBe(2);
  });

  it('matches a flat aggregateItems call when items are flattened manually', () => {
    const meals = [
      { items: [item({ kcal: 100, fiberG: 1 }), item({ kcal: 200, fiberG: 2 })] },
      { items: [item({ kcal: 300, fiberG: 3 })] },
    ];
    const flat = meals.flatMap((m) => m.items);
    expect(aggregateMeals(meals)).toEqual(aggregateItems(flat));
  });
});
