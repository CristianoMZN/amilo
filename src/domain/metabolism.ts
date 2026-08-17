import type { BiologicalSex } from './types';

/**
 * Mifflin–St Jeor Basal Metabolic Rate formula.
 *
 *   male:   BMR = 10 × weightKg + 6.25 × heightCm − 5 × age + 5
 *   female: BMR = 10 × weightKg + 6.25 × heightCm − 5 × age − 161
 *
 * Inputs are assumed to be in metric and within sane ranges. The function
 * does NOT clamp; callers should validate beforehand.
 */
export function mifflinStJeor(
  sex: BiologicalSex,
  weightKg: number,
  heightCm: number,
  ageYears: number,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return sex === 'male' ? base + 5 : base - 161;
}

/**
 * Rounds a BMR / TDEE estimate to the nearest kcal for display purposes.
 * Internally we keep full precision.
 */
export function roundKcal(value: number): number {
  return Math.round(value);
}
