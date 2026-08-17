// Pure aggregation helpers for meal items. No Vue, Pinia, Capacitor or
// Quasar imports.
//
// Aggregations are intentionally permissive about fiber: only items that
// actually contribute a fiber value are summed. If no item provides fiber
// data, the result is `null` (absence of information) rather than `0`.

import type { MealItem } from './types';
import type { NutritionSnapshot } from './nutrition';

type ItemSnapshot = Pick<
  MealItem,
  'kcalSnapshot' | 'proteinGSnapshot' | 'carbsGSnapshot' | 'fatGSnapshot' | 'fiberGSnapshot'
>;

/**
 * Sum a flat list of item snapshots into a single `NutritionSnapshot`.
 *
 * `fiberG` is summed only over non-null entries. If the input is empty or
 * no item contributes fiber, the result's `fiberG` is `null`.
 */
export function aggregateItems(items: ReadonlyArray<ItemSnapshot>): NutritionSnapshot {
  let kcal = 0;
  let proteinG = 0;
  let carbsG = 0;
  let fatG = 0;
  let fiberG: number | null = null;
  for (const item of items) {
    kcal += item.kcalSnapshot;
    proteinG += item.proteinGSnapshot;
    carbsG += item.carbsGSnapshot;
    fatG += item.fatGSnapshot;
    if (item.fiberGSnapshot !== null) {
      fiberG = (fiberG ?? 0) + item.fiberGSnapshot;
    }
  }
  return { kcal, proteinG, carbsG, fatG, fiberG };
}

/**
 * Sum a nested list of meals (each containing items) into a single
 * `NutritionSnapshot`. Equivalent to flattening the items and calling
 * `aggregateItems`.
 */
export function aggregateMeals(
  meals: ReadonlyArray<{ items: ReadonlyArray<Parameters<typeof aggregateItems>[0][number]> }>,
): NutritionSnapshot {
  const allItems: Array<Parameters<typeof aggregateItems>[0][number]> = [];
  for (const meal of meals) {
    for (const item of meal.items) {
      allItems.push(item);
    }
  }
  return aggregateItems(allItems);
}
