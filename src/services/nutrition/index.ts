// Public entry point for the nutrition module's high-level operations.
//
// Components and the Pinia nutrition store import from here — never from
// the concrete implementation file directly. This indirection lets us
// swap the implementation (test double, in-memory cache, …) without
// touching call sites.

export { nutritionService } from './service';
export type {
  MealItemInput,
  SavedMealItemInput,
  RepeatMealResult,
  DailyPanelData,
  MealTypeChip,
  CreateCustomFoodInput,
  UpdateCustomFoodInput,
  NutritionService,
} from './contract';
