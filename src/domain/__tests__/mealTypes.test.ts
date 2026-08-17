import { describe, expect, it } from 'vitest';
import {
  BUILTIN_MEAL_TYPE_IDS,
  CUSTOM_MEAL_TYPE_ID,
  DEFAULT_MEAL_TYPE_ORDER,
  isBuiltinMealType,
  isMealTypeId,
} from 'src/domain/mealTypes';

describe('BUILTIN_MEAL_TYPE_IDS', () => {
  it('contains the five canonical slots in display order', () => {
    expect(BUILTIN_MEAL_TYPE_IDS).toEqual(['breakfast', 'lunch', 'snack', 'dinner', 'supper']);
  });

  it('does not include the custom slot', () => {
    expect(BUILTIN_MEAL_TYPE_IDS).not.toContain('custom');
  });
});

describe('CUSTOM_MEAL_TYPE_ID', () => {
  it('is the literal "custom"', () => {
    expect(CUSTOM_MEAL_TYPE_ID).toBe('custom');
  });
});

describe('DEFAULT_MEAL_TYPE_ORDER', () => {
  it('orders built-ins 0..4 and pushes custom to the end', () => {
    expect(DEFAULT_MEAL_TYPE_ORDER.breakfast).toBe(0);
    expect(DEFAULT_MEAL_TYPE_ORDER.lunch).toBe(1);
    expect(DEFAULT_MEAL_TYPE_ORDER.snack).toBe(2);
    expect(DEFAULT_MEAL_TYPE_ORDER.dinner).toBe(3);
    expect(DEFAULT_MEAL_TYPE_ORDER.supper).toBe(4);
    expect(DEFAULT_MEAL_TYPE_ORDER.custom).toBeGreaterThan(DEFAULT_MEAL_TYPE_ORDER.supper);
  });

  it('has an entry for every MealTypeId value', () => {
    const expected = new Set(['breakfast', 'lunch', 'snack', 'dinner', 'supper', 'custom']);
    const keys = Object.keys(DEFAULT_MEAL_TYPE_ORDER);
    expect(keys).toHaveLength(expected.size);
    for (const key of keys) {
      expect(expected.has(key)).toBe(true);
    }
  });
});

describe('isBuiltinMealType', () => {
  it('returns true for every built-in id', () => {
    expect(isBuiltinMealType('breakfast')).toBe(true);
    expect(isBuiltinMealType('lunch')).toBe(true);
    expect(isBuiltinMealType('snack')).toBe(true);
    expect(isBuiltinMealType('dinner')).toBe(true);
    expect(isBuiltinMealType('supper')).toBe(true);
  });

  it('returns false for the custom id', () => {
    expect(isBuiltinMealType('custom')).toBe(false);
  });

  it('returns false for unknown ids', () => {
    expect(isBuiltinMealType('brunch')).toBe(false);
    expect(isBuiltinMealType('')).toBe(false);
    expect(isBuiltinMealType('BREAKFAST')).toBe(false);
  });

  it('narrows the type so the custom id is excluded', () => {
    const id: string = 'lunch';
    if (isBuiltinMealType(id)) {
      // The narrowed type excludes 'custom' but includes the other five.
      const narrowed: 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'supper' = id;
      expect(narrowed).toBe('lunch');
    } else {
      throw new Error('expected lunch to be a built-in meal type');
    }
  });
});

describe('isMealTypeId', () => {
  it('returns true for every MealTypeId value', () => {
    expect(isMealTypeId('breakfast')).toBe(true);
    expect(isMealTypeId('lunch')).toBe(true);
    expect(isMealTypeId('snack')).toBe(true);
    expect(isMealTypeId('dinner')).toBe(true);
    expect(isMealTypeId('supper')).toBe(true);
    expect(isMealTypeId('custom')).toBe(true);
  });

  it('returns false for unknown strings', () => {
    expect(isMealTypeId('brunch')).toBe(false);
    expect(isMealTypeId('')).toBe(false);
    expect(isMealTypeId('BREAKFAST')).toBe(false);
  });

  it('returns false for non-string inputs', () => {
    expect(isMealTypeId(0)).toBe(false);
    expect(isMealTypeId(null)).toBe(false);
    expect(isMealTypeId(undefined)).toBe(false);
    expect(isMealTypeId({})).toBe(false);
    expect(isMealTypeId([])).toBe(false);
  });
});
