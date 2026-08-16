// Bundled meal-type catalog.
//
// Sprint 2 introduces five built-in meal slots plus a synthetic `'custom'` id
// used for user-defined slots. This file owns the *persisted* representation
// (what ends up in `meal_type` and `meal_type_translation`). The display
// names intentionally mirror the `mealTypes.*` i18n keys so the catalog
// works even before vue-i18n has loaded — see `src/i18n/schema.ts`.
//
// The synthetic `'custom'` id is intentionally NOT seeded: it is rendered via
// `Meal.customName` instead of having its own translation row.

import type {
  MealType,
  MealTypeId,
  MealTypeTranslation,
  SupportedLocale,
} from 'src/domain/types';

/** All locales shipped in the app, in canonical order. */
const SUPPORTED_LOCALES: readonly SupportedLocale[] = [
  'en',
  'es',
  'pt-BR',
  'de',
  'fr',
  'ja',
  'ko',
  'it',
] as const;

/**
 * Built-in meal slot definitions. `builtin` is persisted as INTEGER (0/1) in
 * SQLite (see migration 002_nutrition.sql) but is exposed in domain types as
 * a boolean — the boolean→integer conversion happens in `applySeed`.
 */
export const OFFICIAL_MEAL_TYPES: readonly MealType[] = [
  { id: 'breakfast', sortOrder: 0, builtin: true },
  { id: 'lunch', sortOrder: 1, builtin: true },
  { id: 'snack', sortOrder: 2, builtin: true },
  { id: 'dinner', sortOrder: 3, builtin: true },
  { id: 'supper', sortOrder: 4, builtin: true },
] as const;

/**
 * Per-locale display names for the built-in slots. Keys are `MealTypeId`s
 * (excluding the synthetic `'custom'` id); values are the 8-locale name
 * matrix. Keeping this declarative makes structural tests trivial.
 */
const MEAL_TYPE_NAMES: Readonly<
  Record<Exclude<MealTypeId, 'custom'>, Readonly<Record<SupportedLocale, string>>>
> = {
  breakfast: {
    en: 'Breakfast',
    es: 'Desayuno',
    'pt-BR': 'Café da manhã',
    de: 'Frühstück',
    fr: 'Petit-déjeuner',
    ja: '朝食',
    ko: '아침',
    it: 'Colazione',
  },
  lunch: {
    en: 'Lunch',
    es: 'Comida',
    'pt-BR': 'Almoço',
    de: 'Mittagessen',
    fr: 'Déjeuner',
    ja: '昼食',
    ko: '점심',
    it: 'Pranzo',
  },
  snack: {
    en: 'Snack',
    es: 'Snack',
    'pt-BR': 'Lanche',
    de: 'Snack',
    fr: 'Collation',
    ja: 'おやつ',
    ko: '간식',
    it: 'Spuntino',
  },
  dinner: {
    en: 'Dinner',
    es: 'Cena',
    'pt-BR': 'Jantar',
    de: 'Abendessen',
    fr: 'Dîner',
    ja: '夕食',
    ko: '저녁',
    it: 'Cena',
  },
  supper: {
    en: 'Supper',
    es: 'Merienda',
    'pt-BR': 'Ceia',
    de: 'Spätmahlzeit',
    fr: 'Souper',
    ja: '夜食',
    ko: '야식',
    it: 'Cena tardiva',
  },
} as const;

function flattenMealTypeTranslations(): MealTypeTranslation[] {
  const out: MealTypeTranslation[] = [];
  // Fixed iteration order keeps the diff stable when names change.
  const ids: ReadonlyArray<Exclude<MealTypeId, 'custom'>> = [
    'breakfast',
    'lunch',
    'snack',
    'dinner',
    'supper',
  ];
  for (const id of ids) {
    const names = MEAL_TYPE_NAMES[id];
    for (const locale of SUPPORTED_LOCALES) {
      out.push({ mealTypeId: id, locale, name: names[locale] });
    }
  }
  return out;
}

/**
 * One row per (meal_type_id, locale). Built by flattening `MEAL_TYPE_NAMES`
 * at module load so the seed has no per-locale hand-written repetition.
 */
export const OFFICIAL_MEAL_TYPE_TRANSLATIONS: readonly MealTypeTranslation[] =
  flattenMealTypeTranslations();
