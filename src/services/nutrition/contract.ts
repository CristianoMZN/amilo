// Public service contract for the Amilio food module.
//
// Vue components and Pinia stores depend on this TypeScript interface
// (not on the implementation). One real implementation lives in
// `./service.ts`. Adding a new operation means: append to this interface,
// implement in `./service.ts`. TypeScript will refuse to compile
// otherwise — keeping the surfaces in sync.
//
// Conventions:
//   - every operation is async, takes `conn: DbConnection` first
//   - `locale` is always passed explicitly (no implicit `i18n` reads)
//   - snapshots are re-derived via `domain/nutrition.createSnapshot` so
//     editing an item reflects the *current* food values (per design §26)
//   - return IDs and entities the caller can use to update local state
//     without re-fetching the whole day's data

import type {
  Food,
  FoodBaseUnit,
  Meal,
  MealTypeId,
  MealItem,
  NutritionTargets,
  SavedMeal,
  SavedMealItem,
  SupportedLocale,
  UserProfile,
} from 'src/domain/types';
import type { DbConnection } from 'src/database/connection';
import type { MealWithItems } from 'src/repositories/meal';

export interface MealItemInput {
  foodId: string;
  foodName: string; // localized at consumption time
  amount: number; // canonical amount (g or ml matching food.baseUnit)
  unit: FoodBaseUnit; // matches food.baseUnit for the MVP
}

export interface SavedMealItemInput {
  foodId: string;
  foodName: string;
  amount: number;
  unit: FoodBaseUnit;
}

export interface RepeatMealResult {
  /** The destination meal that received the new items. */
  destination: Meal;
  /** Source items that were skipped (food id null) — see Risk 7 fallback. */
  skippedItemIds: number[];
}

export interface DailyPanelData {
  refDate: string;
  meals: MealWithItems[];
  targets: NutritionTargets | null;
}

export interface MealTypeChip {
  id: MealTypeId;
  name: string;
}

export interface CreateCustomFoodInput {
  id: string; // caller-supplied stable id, e.g. 'food:user:<uuid>'
  name: string; // name is created in the active locale only
  locale: SupportedLocale;
  baseAmountG: number;
  baseUnit: FoodBaseUnit;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
}

export type UpdateCustomFoodInput = CreateCustomFoodInput;

/**
 * The full surface of the food module's high-level operations. Every entry
 * is a method on the `NutritionService` instance — keep them here, never
 * inline in components.
 */
export interface NutritionService {
  // ----- Day-level reads -----

  getDailyPanel(
    conn: DbConnection,
    args: { refDate: string; locale: SupportedLocale },
  ): Promise<DailyPanelData>;

  listMealTypeChips(conn: DbConnection, args: { locale: SupportedLocale }): Promise<MealTypeChip[]>;

  // ----- Food library reads -----

  searchFoods(
    conn: DbConnection,
    args: { locale: SupportedLocale; query: string; limit?: number },
  ): Promise<Array<Food & { name: string }>>;

  listRecentFoods(
    conn: DbConnection,
    args: { locale: SupportedLocale; limit?: number },
  ): Promise<Array<Food & { name: string }>>;

  listFavoriteFoods(
    conn: DbConnection,
    args: { locale: SupportedLocale },
  ): Promise<Array<Food & { name: string }>>;

  listCustomFoods(
    conn: DbConnection,
    args: { locale: SupportedLocale },
  ): Promise<Array<Food & { name: string }>>;

  toggleFavorite(conn: DbConnection, args: { foodId: string }): Promise<boolean>;

  // ----- Custom food CRUD -----

  createCustomFood(conn: DbConnection, args: CreateCustomFoodInput): Promise<Food>;

  updateCustomFood(conn: DbConnection, args: UpdateCustomFoodInput): Promise<void>;

  deleteCustomFood(conn: DbConnection, args: { id: string }): Promise<void>;

  // ----- Add / edit / remove meal items -----

  ensureMealAndAddItem(
    conn: DbConnection,
    args: {
      refDate: string;
      mealTypeId: MealTypeId;
      customName: string | null;
      item: MealItemInput;
    },
  ): Promise<{ meal: Meal; item: MealItem }>;

  updateMealItemAmount(
    conn: DbConnection,
    args: { mealId: number; itemId: number; amount: number },
  ): Promise<MealItem>;

  removeMealItem(conn: DbConnection, args: { itemId: number }): Promise<void>;

  // ----- Saved meals -----

  listSavedMealTemplates(
    conn: DbConnection,
    args: { locale: SupportedLocale },
  ): Promise<Array<SavedMeal & { itemCount: number }>>;

  getSavedMealTemplate(
    conn: DbConnection,
    args: { id: number; locale: SupportedLocale },
  ): Promise<{ savedMeal: SavedMeal; items: SavedMealItem[] } | null>;

  saveMealAsTemplate(
    conn: DbConnection,
    args: { name: string; locale: SupportedLocale; sourceMealId: number },
  ): Promise<SavedMeal>;

  addSavedMealToDay(
    conn: DbConnection,
    args: {
      savedMealId: number;
      refDate: string;
      mealTypeId: MealTypeId;
      customName: string | null;
      locale: SupportedLocale;
    },
  ): Promise<{ meal: Meal; items: MealItem[] }>;

  renameSavedMeal(conn: DbConnection, args: { id: number; name: string }): Promise<void>;

  deleteSavedMeal(conn: DbConnection, args: { id: number }): Promise<void>;

  // ----- Repeat / duplicate -----

  repeatMealToToday(
    conn: DbConnection,
    args: {
      sourceMealId: number;
      targetRefDate: string;
      targetMealTypeId: MealTypeId;
      targetCustomName: string | null;
    },
  ): Promise<RepeatMealResult>;

  // ----- Targets -----

  getTargets(conn: DbConnection): Promise<NutritionTargets | null>;

  setTargets(
    conn: DbConnection,
    args: {
      kcalTarget: number;
      proteinGTarget: number;
      carbsGTarget: number;
      fatGTarget: number;
    },
  ): Promise<NutritionTargets>;

  /**
   * Initial targets suggestion derived from the user's profile. Note the
   * domain helper that powers this lives in `domain/nutrition/targets.ts`.
   */
  suggestTargets(conn: DbConnection, args: { profile: UserProfile }): Promise<NutritionTargets>;
}
