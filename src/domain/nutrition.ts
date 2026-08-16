// Pure nutrition math. No Vue, Pinia, Capacitor or Quasar imports.
//
// All functions are deterministic and side-effect-free. Numeric rounding is
// intentionally avoided inside the math — display-time rounding lives in
// `src/util/format.ts`.

import type { Food, FoodBaseUnit } from './types';

/**
 * Canonical nutritional snapshot for a portion of food.
 *
 * `fiberG` is `null` when the source food has no fiber data (intentional
 * absence of information, not a zero). Every other field is always numeric.
 */
export interface NutritionSnapshot {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
}

/**
 * A snapshot together with the metadata needed to persist it as a
 * `MealItem` / `SavedMealItem` row. The two extras are:
 *  - `foodNameSnapshot`: localized name at consumption time (so historical
 *     rows still display correctly even if the food is deleted or renamed).
 *  - `unit` + `amountG`: the canonical amount in the food's base unit
 *     (named `amountG` for historical reasons, but the value is in `g` or
 *     `ml` matching `unit`).
 */
export interface SnapshotFields extends NutritionSnapshot {
  foodNameSnapshot: string;
  unit: FoodBaseUnit;
  amountG: number;
}

/**
 * Linearly scale a food's nutrition values to a custom amount in the food's
 * base unit.
 *
 * @param food Source food. Nutritional values are expressed per
 *             `food.baseAmountG` (always 100 for shipped rows).
 * @param amountInBaseUnit Amount in the food's `baseUnit` ('g' or 'ml').
 *                         Must be `>= 0`; non-positive amounts return a
 *                         zero snapshot (with `fiberG` preserved as `null`
 *                         when the source food had no fiber data).
 *
 * No rounding is performed — the result is the exact linear interpolation.
 * Round at display time only.
 */
export function scaleFromBase(food: Food, amountInBaseUnit: number): NutritionSnapshot {
  if (amountInBaseUnit <= 0) {
    return {
      kcal: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      fiberG: food.fiberG === null ? null : 0,
    };
  }
  const factor = amountInBaseUnit / food.baseAmountG;
  return {
    kcal: food.kcal * factor,
    proteinG: food.proteinG * factor,
    carbsG: food.carbsG * factor,
    fatG: food.fatG * factor,
    fiberG: food.fiberG === null ? null : food.fiberG * factor,
  };
}

/**
 * Build a persistable snapshot for a consumed amount of food.
 *
 * Combines `scaleFromBase` with the localized name supplied by the caller.
 * The resulting `amountG` is the input amount verbatim — no rounding at
 * this boundary. Callers that need display precision should post-process
 * via `format.ts`.
 */
export function createSnapshot(food: Food, name: string, amount: number): SnapshotFields {
  const scaled = scaleFromBase(food, amount);
  return {
    ...scaled,
    foodNameSnapshot: name,
    unit: food.baseUnit,
    amountG: amount,
  };
}

/**
 * All-zero snapshot. `fiberG` is `null` (no data) rather than `0`.
 * Useful for empty meals, initial state, and tests.
 */
export function emptySnapshot(): NutritionSnapshot {
  return {
    kcal: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    fiberG: null,
  };
}
