// Concrete implementation of `NutritionService` over the SQLite repositories.
//
// Vue components import the singleton `nutritionService` here and never call
// repositories directly. Each method is responsible for:
//   - keeping the contract promises (idempotency, snapshot integrity, …);
//   - recording `createdAt` / `updatedAt` via the shared clock;
//   - converting repository rows to/from the rich domain shapes used by
//     the UI (Food with name, Meal with items + typeName, …).
//
// Concurrency note: this is an offline-only module. All methods assume a
// single-process user; there is no cross-process locking. Methods that
// mutate state ("ensureMealAndAddItem", "saveMealAsTemplate", …) should be
// called from a Vue action that immediately refreshes the affected panel.

import type {
  Food,
  FoodBaseUnit,
  MealItem,
  MealTypeId,
  NutritionTargets,
  SupportedLocale,
} from 'src/domain/types';
import { createSnapshot, scaleFromBase } from 'src/domain/nutrition';
import { suggestTargetsFromProfile } from 'src/domain/targets';
import { nowIso } from 'src/util/dateDay';
import { normalizeForSearch } from 'src/util/search';
import type { DbConnection } from 'src/database/connection';
import { openFoodFactsService } from 'src/services/openFoodFacts';
import type { ExternalFood } from 'src/services/openFoodFacts';

import type {
  MealTypeChip,
  NutritionService,
  RepeatMealResult,
  UpdateCustomFoodInput,
} from './contract';

import * as foodRepo from 'src/repositories/food';
import * as foodFavRepo from 'src/repositories/foodFavorite';
import * as mealTypeRepo from 'src/repositories/mealType';
import * as mealRepo from 'src/repositories/meal';
import * as mealItemRepo from 'src/repositories/mealItem';
import * as savedMealRepo from 'src/repositories/savedMeal';
import * as targetsRepo from 'src/repositories/nutritionTargets';

/** Resolve the display name for a meal type. Reserved for callers that
 * need to render a single meal without going through the daily panel
 * loader. Currently the `listMealsByDate` repository already returns a
 * `typeName` so this helper is unused at the service surface.
 */
function mealTypeDisplayName(
  mealTypeId: MealTypeId,
  customName: string | null,
  typeName: string,
): string {
  return mealTypeId === 'custom' ? (customName ?? typeName) : typeName || (customName ?? '');
}
void mealTypeDisplayName;

/** Lookup a (food, amount) by id and re-derive snapshot values via domain helper. */
async function snapshotForFood(
  conn: DbConnection,
  foodId: string,
  foodName: string,
  amount: number,
): Promise<{
  food: Food;
  unit: FoodBaseUnit;
  kcalSnapshot: number;
  proteinGSnapshot: number;
  carbsGSnapshot: number;
  fatGSnapshot: number;
  fiberGSnapshot: number | null;
}> {
  const food = await foodRepo.findFoodById(conn, foodId);
  if (!food) {
    throw new Error(`Food ${foodId} not found when computing snapshot`);
  }
  const snap = scaleFromBase(food, amount);
  const full = createSnapshot(food, foodName, amount);
  return {
    food,
    unit: full.unit,
    kcalSnapshot: snap.kcal,
    proteinGSnapshot: snap.proteinG,
    carbsGSnapshot: snap.carbsG,
    fatGSnapshot: snap.fatG,
    fiberGSnapshot: snap.fiberG,
  };
}

/** Pick the localized name for a food row, with 'en' fallback and a generic last resort. */
async function resolveFoodName(
  conn: DbConnection,
  foodId: string,
  locale: SupportedLocale,
): Promise<string> {
  const tr = await foodRepo.findFoodTranslation(conn, foodId, locale);
  if (tr) return tr.name;
  const fallback = await foodRepo.findAnyTranslation(conn, foodId);
  if (fallback) return fallback.name;
  return foodId;
}

void resolveFoodName; // keep exported-style helper in module for tests; suppress unused warning
void snapshotForFood;

function sanitizeFoodIdSegment(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function buildImportedFoodId(food: ExternalFood): string {
  const key = sanitizeFoodIdSegment(food.barcode ?? food.externalId);
  return key.length > 0 ? `food:off:${key}` : `food:off:${food.externalId}`;
}

// -----------------------------------------------------------------------
// NutritionService implementation
// -----------------------------------------------------------------------

export const nutritionService: NutritionService = {
  // ----- Day-level reads ----------------------------------------------

  async getDailyPanel(conn, args) {
    const meals = await mealRepo.listMealsByDate(conn, args.refDate, args.locale);
    const targets = await targetsRepo.findNutritionTargets(conn);
    return { refDate: args.refDate, meals, targets };
  },

  async listMealTypeChips(conn, args) {
    const types = await mealTypeRepo.listMealTypes(conn);
    const chips: MealTypeChip[] = [];
    for (const t of types) {
      if (t.id === 'custom') continue;
      const tr = await mealTypeRepo.findMealTypeTranslation(conn, t.id, args.locale);
      if (!tr) continue;
      chips.push({ id: t.id, name: tr.name });
    }
    return chips;
  },

  // ----- Food library reads -------------------------------------------

  async searchFoods(conn, args) {
    const opts: Parameters<typeof foodRepo.searchFoods>[1] = {
      locale: args.locale,
      query: args.query,
    };
    if (args.limit !== undefined) opts.limit = args.limit;
    return foodRepo.searchFoods(conn, opts);
  },

  async listRecentFoods(conn, args) {
    const ids = await mealItemRepo.listRecentFoodIdsByDate(conn, {
      locale: args.locale,
      limit: args.limit ?? 10,
    });
    const out: Array<Food & { name: string }> = [];
    for (const id of ids) {
      const food = await foodRepo.findFoodById(conn, id);
      if (!food) continue;
      const name = await resolveFoodName(conn, id, args.locale);
      out.push({ ...food, name });
    }
    return out;
  },

  async listFavoriteFoods(conn, args) {
    return foodFavRepo.listFavoriteFoods(conn, args.locale).then(async (rows) => {
      const out: Array<Food & { name: string }> = [];
      for (const r of rows) {
        const food = await foodRepo.findFoodById(conn, r.id);
        if (!food) continue;
        out.push({ ...food, name: r.name });
      }
      return out;
    });
  },

  async listCustomFoods(conn, args) {
    return foodRepo.listCustomFoods(conn, args.locale);
  },

  async toggleFavorite(conn, args) {
    const already = await foodFavRepo.isFavorite(conn, args.foodId);
    if (already) {
      await foodFavRepo.removeFavorite(conn, args.foodId);
      return false;
    }
    await foodFavRepo.addFavorite(conn, args.foodId);
    return true;
  },

  // ----- Custom food CRUD --------------------------------------------

  async createCustomFood(conn, args) {
    const food: Food = {
      id: args.id,
      origin: 'custom',
      externalSource: args.externalSource ?? null,
      externalId: args.externalId ?? null,
      barcode: args.barcode ?? null,
      brand: args.brand ?? null,
      baseAmountG: args.baseAmountG,
      baseUnit: args.baseUnit,
      kcal: args.kcal,
      proteinG: args.proteinG,
      carbsG: args.carbsG,
      fatG: args.fatG,
      fiberG: args.fiberG,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await foodRepo.insertFood(conn, food);
    await foodRepo.upsertFoodTranslation(conn, {
      foodId: args.id,
      locale: args.locale,
      name: args.name,
      search: normalizeForSearch(args.name),
    });
    return food;
  },

  async updateCustomFood(conn, args: UpdateCustomFoodInput) {
    const existing = await foodRepo.findFoodById(conn, args.id);
    if (!existing) {
      throw new Error(`updateCustomFood: ${args.id} not found`);
    }
    const updated: Food = {
      ...existing,
      externalSource: args.externalSource ?? existing.externalSource ?? null,
      externalId: args.externalId ?? existing.externalId ?? null,
      barcode: args.barcode ?? existing.barcode ?? null,
      brand: args.brand ?? existing.brand ?? null,
      baseAmountG: args.baseAmountG,
      baseUnit: args.baseUnit,
      kcal: args.kcal,
      proteinG: args.proteinG,
      carbsG: args.carbsG,
      fatG: args.fatG,
      fiberG: args.fiberG,
      updatedAt: nowIso(),
    };
    await foodRepo.insertFood(conn, updated);
    await foodRepo.upsertFoodTranslation(conn, {
      foodId: args.id,
      locale: args.locale,
      name: args.name,
      search: normalizeForSearch(args.name),
    });
  },

  async importExternalFood(conn, args) {
    const barcode = args.food.barcode?.trim();
    const existing =
      (barcode ? await foodRepo.findFoodByBarcode(conn, barcode) : null) ??
      (await foodRepo.findFoodByExternalIdentity(conn, args.food.source, args.food.externalId));
    if (existing) {
      await foodRepo.upsertFoodTranslation(conn, {
        foodId: existing.id,
        locale: args.locale,
        name: args.food.name,
        search: normalizeForSearch(args.food.name),
      });
      return existing;
    }

    const now = nowIso();
    const food: Food = {
      id: buildImportedFoodId(args.food),
      origin: 'custom',
      externalSource: args.food.source,
      externalId: args.food.externalId,
      barcode: args.food.barcode,
      brand: args.food.brand,
      baseAmountG: args.food.baseAmountG,
      baseUnit: args.food.baseUnit,
      kcal: args.food.kcal,
      proteinG: args.food.proteinG,
      carbsG: args.food.carbsG,
      fatG: args.food.fatG,
      fiberG: args.food.fiberG,
      createdAt: now,
      updatedAt: now,
    };
    await foodRepo.insertFood(conn, food);
    await foodRepo.upsertFoodTranslation(conn, {
      foodId: food.id,
      locale: args.locale,
      name: args.food.name,
      search: normalizeForSearch(args.food.name),
    });
    return food;
  },

  async resolveFoodByBarcode(conn, args) {
    const barcode = args.barcode.trim();
    if (barcode.length === 0) return null;
    const local = await foodRepo.findFoodByBarcode(conn, barcode);
    if (local) {
      const name = await resolveFoodName(conn, local.id, args.locale);
      return { ...local, name };
    }
    const external = await openFoodFactsService.findByBarcode({
      locale: args.locale,
      barcode,
    });
    if (!external) return null;
    const imported = await nutritionService.importExternalFood(conn, {
      food: external,
      locale: args.locale,
    });
    return { ...imported, name: external.name };
  },

  async deleteCustomFood(conn, args) {
    const existing = await foodRepo.findFoodById(conn, args.id);
    if (!existing || existing.origin !== 'custom') {
      throw new Error(`deleteCustomFood: ${args.id} is not a custom food`);
    }
    await foodRepo.deleteFood(conn, args.id);
  },

  // ----- Add / edit / remove meal items ------------------------------

  async ensureMealAndAddItem(conn, args) {
    const meal = await mealRepo.ensureMealForType(conn, {
      refDate: args.refDate,
      mealTypeId: args.mealTypeId,
      customName: args.customName,
    });
    const existingItems = await mealItemRepo.listItemsByMeal(conn, meal.id);
    const nextPosition = existingItems.length;
    const snap = await snapshotForFood(
      conn,
      args.item.foodId,
      args.item.foodName,
      args.item.amount,
    );
    const inserted = await mealItemRepo.insertMealItem(conn, {
      mealId: meal.id,
      position: nextPosition,
      foodId: snap.food.id,
      foodNameSnapshot: args.item.foodName,
      amountG: args.item.amount,
      unit: args.item.unit,
      kcalSnapshot: snap.kcalSnapshot,
      proteinGSnapshot: snap.proteinGSnapshot,
      carbsGSnapshot: snap.carbsGSnapshot,
      fatGSnapshot: snap.fatGSnapshot,
      fiberGSnapshot: snap.fiberGSnapshot,
    });
    return { meal, item: inserted };
  },

  async updateMealItemAmount(conn, args) {
    const items = await mealItemRepo.listItemsByMeal(conn, args.mealId);
    const target = items.find((it) => it.id === args.itemId);
    if (!target) {
      throw new Error(`updateMealItemAmount: item ${args.itemId} not found in meal ${args.mealId}`);
    }
    if (!target.foodId) {
      // Item has no live food (deleted custom). Editing amount without a
      // source of truth can't produce a fresh snapshot. Refuse so the UI
      // can prompt the user to either recreate or delete the item.
      throw new Error('updateMealItemAmount: cannot recompute snapshot for an orphaned item');
    }
    const food = await foodRepo.findFoodById(conn, target.foodId);
    if (!food) {
      throw new Error(`updateMealItemAmount: food ${target.foodId} no longer exists`);
    }
    const liveName = await resolveFoodName(
      conn,
      target.foodId,
      food.id.startsWith('food:user:') ? 'en' : 'en',
    );
    // For official foods with no live translation we keep the snapshot's name;
    // the live lookup is best-effort.
    const nameForSnapshot = liveName || target.foodNameSnapshot;
    const snap = scaleFromBase(food, args.amount);
    const full = createSnapshot(food, nameForSnapshot, args.amount);
    const updated: MealItem = {
      ...target,
      amountG: args.amount,
      unit: full.unit,
      foodNameSnapshot: nameForSnapshot,
      kcalSnapshot: snap.kcal,
      proteinGSnapshot: snap.proteinG,
      carbsGSnapshot: snap.carbsG,
      fatGSnapshot: snap.fatG,
      fiberGSnapshot: snap.fiberG,
    };
    await mealItemRepo.updateMealItem(conn, updated);
    return updated;
  },

  async removeMealItem(conn, args) {
    await mealItemRepo.deleteMealItem(conn, args.itemId);
  },

  // ----- Saved meals -------------------------------------------------

  async listSavedMealTemplates(conn, args) {
    return savedMealRepo.listSavedMeals(conn, args.locale);
  },

  async getSavedMealTemplate(conn, args) {
    return savedMealRepo.getSavedMealWithItems(conn, args.id, args.locale);
  },

  async saveMealAsTemplate(conn, args) {
    const source = await mealRepo.getMealById(conn, args.sourceMealId, args.locale);
    if (!source) {
      throw new Error(`saveMealAsTemplate: meal ${args.sourceMealId} not found`);
    }
    // Re-derive snapshot values from current food values so the saved
    // template stays faithful if the underlying food is corrected later.
    // (If a custom food has been deleted since the source meal was
    // recorded, fall back to the existing item snapshot.)
    const items = [];
    for (const it of source.items) {
      if (it.foodId) {
        const food = await foodRepo.findFoodById(conn, it.foodId);
        if (food) {
          const snap = scaleFromBase(food, it.amountG);
          items.push({
            position: items.length,
            foodId: food.id,
            foodNameSnapshot: it.foodNameSnapshot,
            amountG: it.amountG,
            unit: it.unit,
            kcalSnapshot: snap.kcal,
            proteinGSnapshot: snap.proteinG,
            carbsGSnapshot: snap.carbsG,
            fatGSnapshot: snap.fatG,
            fiberGSnapshot: snap.fiberG,
          });
          continue;
        }
      }
      items.push({
        position: items.length,
        foodId: it.foodId,
        foodNameSnapshot: it.foodNameSnapshot,
        amountG: it.amountG,
        unit: it.unit,
        kcalSnapshot: it.kcalSnapshot,
        proteinGSnapshot: it.proteinGSnapshot,
        carbsGSnapshot: it.carbsGSnapshot,
        fatGSnapshot: it.fatGSnapshot,
        fiberGSnapshot: it.fiberGSnapshot,
      });
    }
    return savedMealRepo.createSavedMeal(conn, {
      name: args.name,
      locale: args.locale,
      items,
    });
  },

  async addSavedMealToDay(conn, args) {
    const template = await savedMealRepo.getSavedMealWithItems(conn, args.savedMealId, args.locale);
    if (!template) {
      throw new Error(`addSavedMealToDay: saved meal ${args.savedMealId} not found`);
    }
    const meal = await mealRepo.ensureMealForType(conn, {
      refDate: args.refDate,
      mealTypeId: args.mealTypeId,
      customName: args.customName,
    });
    const items: MealItem[] = [];
    for (let i = 0; i < template.items.length; i++) {
      const tpl = template.items[i];
      if (!tpl) continue;
      if (!tpl.foodId) continue; // skip orphan snapshots (food deleted)
      const food = await foodRepo.findFoodById(conn, tpl.foodId);
      if (!food) continue; // skip if food no longer exists
      const inserted = await mealItemRepo.insertMealItem(conn, {
        mealId: meal.id,
        position: i,
        foodId: food.id,
        foodNameSnapshot: tpl.foodNameSnapshot,
        amountG: tpl.amountG,
        unit: tpl.unit,
        kcalSnapshot: tpl.kcalSnapshot,
        proteinGSnapshot: tpl.proteinGSnapshot,
        carbsGSnapshot: tpl.carbsGSnapshot,
        fatGSnapshot: tpl.fatGSnapshot,
        fiberGSnapshot: tpl.fiberGSnapshot,
      });
      items.push(inserted);
    }
    return { meal, items };
  },

  async renameSavedMeal(conn, args) {
    return savedMealRepo.renameSavedMeal(conn, args.id, args.name);
  },

  async deleteSavedMeal(conn, args) {
    return savedMealRepo.deleteSavedMeal(conn, args.id);
  },

  // ----- Repeat / duplicate -----------------------------------------

  async repeatMealToToday(conn, args): Promise<RepeatMealResult> {
    const source = await mealRepo.getMealById(conn, args.sourceMealId, 'en');
    if (!source) {
      throw new Error(`repeatMealToToday: source meal ${args.sourceMealId} not found`);
    }
    const meal = await mealRepo.ensureMealForType(conn, {
      refDate: args.targetRefDate,
      mealTypeId: args.targetMealTypeId,
      customName: args.targetCustomName,
    });
    const skipped: number[] = [];
    for (let i = 0; i < source.items.length; i++) {
      const item = source.items[i];
      if (!item) continue;
      if (!item.foodId) {
        // Per Oracle Risk 7 fallback (a): skip orphan snapshots. Caller can
        // show a toast with the skipped count.
        skipped.push(item.id);
        continue;
      }
      const food = await foodRepo.findFoodById(conn, item.foodId);
      if (!food) {
        skipped.push(item.id);
        continue;
      }
      // Re-derive from the *current* food values so corrections to the
      // underlying food propagate to today's repeat.
      const snap = scaleFromBase(food, item.amountG);
      const full = createSnapshot(food, item.foodNameSnapshot, item.amountG);
      await mealItemRepo.insertMealItem(conn, {
        mealId: meal.id,
        position: i,
        foodId: food.id,
        foodNameSnapshot: item.foodNameSnapshot,
        amountG: item.amountG,
        unit: full.unit,
        kcalSnapshot: snap.kcal,
        proteinGSnapshot: snap.proteinG,
        carbsGSnapshot: snap.carbsG,
        fatGSnapshot: snap.fatG,
        fiberGSnapshot: snap.fiberG,
      });
    }
    return { destination: meal, skippedItemIds: skipped };
  },

  // ----- Targets -----------------------------------------------------

  async getTargets(conn) {
    return targetsRepo.findNutritionTargets(conn);
  },

  async setTargets(conn, args): Promise<NutritionTargets> {
    const t: NutritionTargets = {
      id: 1,
      kcalTarget: args.kcalTarget,
      proteinGTarget: args.proteinGTarget,
      carbsGTarget: args.carbsGTarget,
      fatGTarget: args.fatGTarget,
      updatedAt: nowIso(),
    };
    await targetsRepo.upsertNutritionTargets(conn, t);
    return t;
  },

  async suggestTargets(conn, args) {
    void conn;
    await Promise.resolve();
    return suggestTargetsFromProfile(args.profile);
  },
};

// Re-export the contract types for convenience.
export type {
  MealItemInput,
  SavedMealItemInput,
  RepeatMealResult,
  DailyPanelData,
  MealTypeChip,
  CreateCustomFoodInput,
} from './contract';
export type { NutritionService } from './contract';
// Avoid a duplicate `FoodOrigin` re-export warning.
export {};
