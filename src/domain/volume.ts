// Pure helpers for set-level volume and best-set selection.
// No Vue, Pinia, Capacitor or Quasar imports.
//
// "Volume" here means `reps * weightKg` over a single set. Bodyweight
// exercises (weightKg === null) contribute 0 to volume by convention — load
// is what volume tracks, not effort. This matches how strength athletes
// tally weekly volume for progressive-overload tracking.

import type { PerformedWorkoutSet } from './types';

/**
 * Volume (kg) of a single set. Returns `0` when the weight is `null` so a
 * bodyweight set does not pollute the running total.
 */
export function setVolumeKg(reps: number, weightKg: number | null): number {
  return reps * (weightKg ?? 0);
}

/**
 * Total volume (kg) across all sets in a list. Sums `reps * weightKg` per
 * set; bodyweight sets contribute 0.
 */
export function exerciseVolumeKg(sets: ReadonlyArray<{ reps: number; weightKg: number | null }>): number {
  let total = 0;
  for (const set of sets) {
    total += setVolumeKg(set.reps, set.weightKg);
  }
  return total;
}

/**
 * Pick the set with the highest non-null `weightKg`. Returns `null` when
 * no set has a weight (all bodyweight / incomplete).
 */
export function bestSetByWeight(sets: ReadonlyArray<PerformedWorkoutSet>): PerformedWorkoutSet | null {
  let best: PerformedWorkoutSet | undefined;
  for (const set of sets) {
    if (set.weightKg === null) continue;
    if (best === undefined || best.weightKg === null || set.weightKg > best.weightKg) {
      best = set;
    }
  }
  return best ?? null;
}

/**
 * Pick the set with the highest `reps * weightKg` (kg-volume). Returns
 * `null` when no set has a weight.
 */
export function bestSetByVolume(sets: ReadonlyArray<PerformedWorkoutSet>): PerformedWorkoutSet | null {
  let best: PerformedWorkoutSet | undefined;
  for (const set of sets) {
    if (set.weightKg === null) continue;
    if (best === undefined) {
      best = set;
      continue;
    }
    if (best.weightKg === null) {
      best = set;
      continue;
    }
    const sVol = set.reps * set.weightKg;
    const bVol = best.reps * best.weightKg;
    if (sVol > bVol) {
      best = set;
    }
  }
  return best ?? null;
}

/**
 * Pick the set with the most reps at exactly the target weight. The weight
 * comparison is rounded to 0.01 kg on each side so a typed `70` and a
 * stored `70.0000001` (float drift) still match. Returns `null` when no
 * weighted set matches.
 */
export function bestSetByRepsAtWeight(
  sets: ReadonlyArray<PerformedWorkoutSet>,
  targetKg: number,
): PerformedWorkoutSet | null {
  const roundedTarget = Math.round(targetKg * 100) / 100;
  let best: PerformedWorkoutSet | undefined;
  for (const set of sets) {
    if (set.weightKg === null) continue;
    const roundedSet = Math.round(set.weightKg * 100) / 100;
    if (roundedSet !== roundedTarget) continue;
    if (best === undefined || set.reps > best.reps) {
      best = set;
    }
  }
  return best ?? null;
}
