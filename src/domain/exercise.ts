// Pure helpers around exercises (catalog + per-locale translations).
// No Vue, Pinia, Capacitor or Quasar imports.
//
// All functions are stateless and side-effect-free. Translation matching
// is diacritic- and case-insensitive — see `src/util/search.ts`.

import type {
  Exercise,
  ExerciseTranslation,
  SupportedLocale,
} from './types';
import { matchesSearch } from 'src/util/search';

/**
 * Find the best translation row for a locale. Falls back to `'en'`, then to
 * the first available entry.
 *
 * @returns the matching `ExerciseTranslation`, or `undefined` when `translations` is empty.
 */
export function findTranslationForLocale(
  translations: ReadonlyArray<ExerciseTranslation>,
  locale: SupportedLocale,
): ExerciseTranslation | undefined {
  const match = translations.find((t) => t.locale === locale);
  if (match) return match;
  const enFallback = translations.find((t) => t.locale === 'en');
  if (enFallback) return enFallback;
  return translations[0];
}

/**
 * Resolve a displayable name for an exercise in the given locale, walking
 * through fallbacks in order:
 *
 *   1. exact `locale`
 *   2. `'en'`
 *   3. first available translation
 *   4. the exercise `id` (last-resort identifier, never empty)
 *
 * This guarantees the UI never shows an empty label.
 */
export function displayNameFor(
  exercise: Exercise,
  translations: ReadonlyArray<ExerciseTranslation>,
  locale: SupportedLocale,
): string {
  const target = translations.find((t) => t.locale === locale);
  if (target) return target.name;
  const en = translations.find((t) => t.locale === 'en');
  if (en) return en.name;
  const first = translations[0];
  if (first) return first.name;
  return exercise.id;
}

/**
 * Substring match of `query` against the exercise's localized search blob,
 * falling back to the `'en'` blob when the target locale is missing.
 *
 * The search blob is already normalised at write-time (NFKC + NFD + mark
 * strip); `matchesSearch` applies the same normalisation to the query at
 * match-time so callers can pass raw user input.
 *
 * @returns `true` when `query` is a non-empty substring match; `false` for
 *          empty queries, missing translations, or no match.
 */
export function exercisesMatchSearch(
  exercise: Exercise,
  translations: ReadonlyArray<ExerciseTranslation>,
  query: string,
  locale: SupportedLocale,
): boolean {
  void exercise; // reserved for future per-exercise filtering (e.g. muscleGroup)
  const translation = findTranslationForLocale(translations, locale);
  if (!translation) return false;
  return matchesSearch(query, translation.search);
}

/**
 * Throw on an empty exercise name. Trims first so whitespace-only strings
 * are rejected. Limit is 120 characters — long enough for localised terms
 * (e.g. pt-BR "Remada curvada com pegada supinada") without bloating the UI.
 *
 * Throws:
 *  - `Error('exercise name required')` when the trimmed value is empty.
 *  - `Error('exercise name too long')` when the trimmed value exceeds 120.
 */
export function assertValidExerciseName(name: string): void {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error('exercise name required');
  }
  if (trimmed.length > 120) {
    throw new Error('exercise name too long');
  }
}

/**
 * Throw on an invalid kcal-per-hour estimate. Aerobic kcal/h is a
 * non-negative rate — it cannot be negative and cannot be NaN/Infinity.
 *
 * Throws `Error('kcal per hour must be a non-negative finite number')` when
 * the input is not a finite, non-negative number.
 */
export function assertValidKcalPerHour(kcal: number): void {
  if (!Number.isFinite(kcal) || kcal < 0) {
    throw new Error('kcal per hour must be a non-negative finite number');
  }
}

/**
 * Throw on an invalid rep count. Reps may be fractional (REAL storage) so
 * `0.5` is a legal value; negative or non-finite values are not.
 *
 * Throws `Error('reps must be a non-negative finite number')` when the
 * input is not a finite, non-negative number.
 */
export function assertValidReps(reps: number): void {
  if (!Number.isFinite(reps) || reps < 0) {
    throw new Error('reps must be a non-negative finite number');
  }
}

/**
 * Throw on an invalid weight, but only when the weight is present.
 *
 * `null` and `undefined` pass through (bodyweight / load-less exercises).
 * Any provided weight must be finite and non-negative.
 *
 * Throws `Error('weight must be a non-negative finite number')` when the
 * input is not `null`/`undefined` and not a finite, non-negative number.
 */
export function assertValidWeightKg(weight: number | null | undefined): void {
  if (weight === null || weight === undefined) return;
  if (!Number.isFinite(weight) || weight < 0) {
    throw new Error('weight must be a non-negative finite number');
  }
}
