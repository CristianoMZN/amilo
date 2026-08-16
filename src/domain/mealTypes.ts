// Pure meal-type constants + type guards. No Vue, Pinia, Capacitor or
// Quasar imports.

import type { MealTypeId } from './types';

/**
 * The five built-in meal slots. The synthetic `'custom'` id is intentionally
 * excluded — it is reserved for user-defined slots and is rendered via
 * `Meal.customName` rather than a translation.
 */
export const BUILTIN_MEAL_TYPE_IDS: readonly MealTypeId[] = [
  'breakfast',
  'lunch',
  'snack',
  'dinner',
  'supper',
] as const;

/** The synthetic meal-type id used for user-defined slots. */
export const CUSTOM_MEAL_TYPE_ID: MealTypeId = 'custom';

/**
 * Display ordering for meal types. Built-ins occupy slots 0..4 in the order
 * people typically eat through the day; the custom slot is pushed to the
 * end so the user-created entry never pushes a built-in off-screen.
 */
export const DEFAULT_MEAL_TYPE_ORDER: Readonly<Record<MealTypeId, number>> = {
  breakfast: 0,
  lunch: 1,
  snack: 2,
  dinner: 3,
  supper: 4,
  custom: 99,
} as const;

/**
 * Type guard narrowing to the built-in meal-type ids. The `'custom'` id is
 * deliberately excluded because it is not a real translation-backed slot.
 */
export function isBuiltinMealType(id: string): id is Exclude<MealTypeId, 'custom'> {
  return (
    id === 'breakfast' ||
    id === 'lunch' ||
    id === 'snack' ||
    id === 'dinner' ||
    id === 'supper'
  );
}

/**
 * Type guard for any `MealTypeId` (built-in + `'custom'`). Use this when
 * validating user input or DB rows before they cross the domain boundary.
 */
export function isMealTypeId(value: unknown): value is MealTypeId {
  return (
    typeof value === 'string' &&
    (value === 'breakfast' ||
      value === 'lunch' ||
      value === 'snack' ||
      value === 'dinner' ||
      value === 'supper' ||
      value === 'custom')
  );
}
