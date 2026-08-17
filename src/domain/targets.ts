// Targets suggestion. Non-prescriptive — see the JSDoc below.

import type { NutritionTargets, UserProfile } from 'src/domain/types';
import { estimateTdee } from 'src/domain/age';
import { mifflinStJeor, roundKcal } from 'src/domain/metabolism';
import { nowIso } from 'src/util/dateDay';

const KCAL_PER_G_PROTEIN = 4;
const KCAL_PER_G_CARB = 4;
const KCAL_PER_G_FAT = 9;

const ADJUSTMENT_KCAL: Record<UserProfile['goal'], number> = {
  lose: -500,
  maintain: 0,
  gain: 300,
};

const SUGGESTED_PROTEIN_G_PER_KG = 1.6;
const FAT_KCAL_RATIO = 0.25;

/**
 * Build a `NutritionTargets` suggestion from the user's profile.
 *
 * Heuristics (defensible general-population defaults; **not medical advice**):
 *  - kcal target = clamp(tdee + delta, bmr) for lose; tdee + delta otherwise.
 *    Prevents dieting adults from getting recommendations below their basal
 *    metabolic rate.
 *  - protein target = max(1.6 g/kg × weightKg), a common active-adult figure.
 *  - fat target = round(kcal × 0.25 / 9). Caps fat at 25% of total kcal.
 *  - carb target = the remainder in kcal, / 4. Clamped to `>= 0`; if the
 *    remainder is negative (very high protein share) it is set to 0 and
 *    the user is expected to fine-tune.
 *
 * People with medical conditions (diabetes, pregnancy, eating disorders)
 * should consult a professional before applying any value generated here.
 */
export function suggestTargetsFromProfile(profile: UserProfile): NutritionTargets {
  const tdee = estimateTdee({
    sex: profile.sex,
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    birthDateIso: profile.birthDate,
    activity: profile.activity,
  });
  const bmr = mifflinStJeor(profile.sex, profile.weightKg, profile.heightCm, tdee.bmrKcal);
  // Note: the bmr computed above equals tdee.bmrKcal; the explicit
  // recomputation here is defensive against future changes that decouple the
  // two. Falls back to tdee.bmrKcal if needed.
  const bmrFloor = Number.isFinite(bmr) && bmr > 0 ? bmr : tdee.bmrKcal;

  const delta = ADJUSTMENT_KCAL[profile.goal];
  const rawKcal = tdee.tdeeKcal + delta;
  const kcalTarget =
    profile.goal === 'lose'
      ? Math.max(roundKcal(rawKcal), roundKcal(bmrFloor))
      : Math.max(roundKcal(rawKcal), 1200); // sanity floor for any goal

  const proteinGTarget = roundToTenth(Math.max(0, SUGGESTED_PROTEIN_G_PER_KG * profile.weightKg));
  const fatGTarget = roundToTenth(Math.max(0, (kcalTarget * FAT_KCAL_RATIO) / KCAL_PER_G_FAT));
  const carbsKcalRemaining =
    kcalTarget - proteinGTarget * KCAL_PER_G_PROTEIN - fatGTarget * KCAL_PER_G_FAT;
  const carbsGTarget = roundToTenth(Math.max(0, carbsKcalRemaining / KCAL_PER_G_CARB));

  return {
    id: 1,
    kcalTarget,
    proteinGTarget,
    carbsGTarget,
    fatGTarget,
    updatedAt: nowIso(),
  };
}

function roundToTenth(n: number): number {
  return Math.round(n * 10) / 10;
}
