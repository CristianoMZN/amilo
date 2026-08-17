import { describe, expect, it } from 'vitest';
import { createSnapshot, emptySnapshot, scaleFromBase } from 'src/domain/nutrition';
import type { Food } from 'src/domain/types';

function makeFood(overrides: Partial<Food> = {}): Food {
  return {
    id: 'food:test',
    origin: 'official',
    baseAmountG: 100,
    baseUnit: 'g',
    kcal: 200,
    proteinG: 10,
    carbsG: 30,
    fatG: 5,
    fiberG: 3,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('scaleFromBase', () => {
  it('is identity when amount equals baseAmountG', () => {
    const food = makeFood({
      baseAmountG: 100,
      kcal: 250,
      proteinG: 12,
      carbsG: 40,
      fatG: 8,
      fiberG: 5,
    });
    const snap = scaleFromBase(food, 100);
    expect(snap.kcal).toBe(250);
    expect(snap.proteinG).toBe(12);
    expect(snap.carbsG).toBe(40);
    expect(snap.fatG).toBe(8);
    expect(snap.fiberG).toBe(5);
  });

  it('scales 1.5x for 150g against a 100g base', () => {
    const food = makeFood({
      baseAmountG: 100,
      kcal: 200,
      proteinG: 10,
      carbsG: 30,
      fatG: 5,
      fiberG: 3,
    });
    const snap = scaleFromBase(food, 150);
    expect(snap.kcal).toBe(300);
    expect(snap.proteinG).toBe(15);
    expect(snap.carbsG).toBe(45);
    expect(snap.fatG).toBeCloseTo(7.5, 10);
    expect(snap.fiberG).toBeCloseTo(4.5, 10);
  });

  it('scales 0.5x for 50g against a 100g base', () => {
    const food = makeFood({
      baseAmountG: 100,
      kcal: 200,
      proteinG: 10,
      carbsG: 30,
      fatG: 5,
      fiberG: 3,
    });
    const snap = scaleFromBase(food, 50);
    expect(snap.kcal).toBe(100);
    expect(snap.proteinG).toBe(5);
    expect(snap.carbsG).toBe(15);
    expect(snap.fatG).toBeCloseTo(2.5, 10);
    expect(snap.fiberG).toBeCloseTo(1.5, 10);
  });

  it('returns zero snapshot for amount=0', () => {
    const food = makeFood({ fiberG: 5 });
    const snap = scaleFromBase(food, 0);
    expect(snap.kcal).toBe(0);
    expect(snap.proteinG).toBe(0);
    expect(snap.carbsG).toBe(0);
    expect(snap.fatG).toBe(0);
    expect(snap.fiberG).toBe(0);
  });

  it('returns zero snapshot for negative amounts', () => {
    const food = makeFood({ fiberG: 5 });
    const snap = scaleFromBase(food, -10);
    expect(snap.kcal).toBe(0);
    expect(snap.proteinG).toBe(0);
    expect(snap.carbsG).toBe(0);
    expect(snap.fatG).toBe(0);
    expect(snap.fiberG).toBe(0);
  });

  it('keeps fiberG as null when the food has no fiber data, even at zero amount', () => {
    const food = makeFood({ fiberG: null });
    const snap = scaleFromBase(food, 0);
    expect(snap.fiberG).toBeNull();
  });

  it('keeps fiberG as null when the food has no fiber data, at any positive amount', () => {
    const food = makeFood({ fiberG: null });
    const snap = scaleFromBase(food, 150);
    expect(snap.fiberG).toBeNull();
    expect(snap.kcal).toBe(300);
  });

  it('scales proportionally for very large amounts (10 kg)', () => {
    const food = makeFood({ baseAmountG: 100, kcal: 200 });
    const snap = scaleFromBase(food, 10000);
    expect(snap.kcal).toBe(20000);
    expect(snap.proteinG).toBe(1000);
  });

  it('does not round intermediate values', () => {
    // 33 / 100 = 0.33 (exact); 2.5 * 0.33 = 0.825 should not be rounded.
    const food = makeFood({ baseAmountG: 100, fatG: 2.5 });
    const snap = scaleFromBase(food, 33);
    expect(snap.fatG).toBeCloseTo(0.825, 10);
  });

  it('works with a non-100 baseAmountG', () => {
    const food = makeFood({ baseAmountG: 50, kcal: 100, proteinG: 5 });
    // 100 kcal per 50g → 200 kcal per 100g. request 100g → 200 kcal.
    expect(scaleFromBase(food, 100).kcal).toBe(200);
    expect(scaleFromBase(food, 100).proteinG).toBe(10);
  });

  it('works with a ml-based food', () => {
    const food = makeFood({ baseAmountG: 100, baseUnit: 'ml', kcal: 50 });
    const snap = scaleFromBase(food, 200);
    expect(snap.kcal).toBe(100);
  });
});

describe('createSnapshot', () => {
  it('stores the supplied localized name and unit', () => {
    const food = makeFood({ baseUnit: 'g' });
    const snap = createSnapshot(food, 'Arroz Integral', 150);
    expect(snap.foodNameSnapshot).toBe('Arroz Integral');
    expect(snap.unit).toBe('g');
    expect(snap.amountG).toBe(150);
  });

  it('uses the food baseUnit even when the food is ml-based', () => {
    const food = makeFood({ baseUnit: 'ml' });
    const snap = createSnapshot(food, 'Leite', 250);
    expect(snap.unit).toBe('ml');
    expect(snap.amountG).toBe(250);
  });

  it('returns the same numeric values as scaleFromBase', () => {
    const food = makeFood({
      baseAmountG: 100,
      kcal: 200,
      proteinG: 10,
      carbsG: 30,
      fatG: 5,
      fiberG: 3,
    });
    const snap = createSnapshot(food, 'Test', 150);
    const scaled = scaleFromBase(food, 150);
    expect(snap.kcal).toBe(scaled.kcal);
    expect(snap.proteinG).toBe(scaled.proteinG);
    expect(snap.carbsG).toBe(scaled.carbsG);
    expect(snap.fatG).toBe(scaled.fatG);
    expect(snap.fiberG).toBe(scaled.fiberG);
  });

  it('round-trips a food unchanged at baseAmountG', () => {
    const food = makeFood({
      baseAmountG: 100,
      kcal: 350,
      proteinG: 20,
      carbsG: 50,
      fatG: 8,
      fiberG: 4,
    });
    const snap = createSnapshot(food, 'X', 100);
    expect(snap.kcal).toBe(food.kcal);
    expect(snap.proteinG).toBe(food.proteinG);
    expect(snap.carbsG).toBe(food.carbsG);
    expect(snap.fatG).toBe(food.fatG);
    expect(snap.fiberG).toBe(food.fiberG);
    expect(snap.unit).toBe(food.baseUnit);
    expect(snap.amountG).toBe(100);
  });
});

describe('emptySnapshot', () => {
  it('returns all-zero fields with fiberG null', () => {
    const snap = emptySnapshot();
    expect(snap.kcal).toBe(0);
    expect(snap.proteinG).toBe(0);
    expect(snap.carbsG).toBe(0);
    expect(snap.fatG).toBe(0);
    expect(snap.fiberG).toBeNull();
  });

  it('returns a fresh object on each call (no shared state)', () => {
    const a = emptySnapshot();
    const b = emptySnapshot();
    expect(a).not.toBe(b);
    a.kcal = 999;
    expect(b.kcal).toBe(0);
  });
});
