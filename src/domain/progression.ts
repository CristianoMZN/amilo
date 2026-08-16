// Pure helpers for previous-workout progression comparison.
// No Vue, Pinia, Capacitor or Quasar imports.
//
// "Previous" means the last logged occurrence of the *same exercise*. The
// caller (repository / store) supplies the prev row + its sets and the
// current row + its sets. This module only computes the deltas.

import type { PerformedWorkoutExercise, PerformedWorkoutSet } from './types';
import { bestSetByVolume, exerciseVolumeKg, setVolumeKg } from './volume';

/**
 * Rep delta: how many more reps does the current set do compared to the
 * previous? Returns `curr.reps` when there is no previous row to compare
 * against (treats the missing baseline as `0`).
 */
export function compareReps(
  prev: { reps: number } | null,
  curr: { reps: number },
): number {
  const prevReps = prev?.reps ?? 0;
  return curr.reps - prevReps;
}

/**
 * Weight delta in kg. Null-safe on both sides — a bodyweight set vs a
 * weighted set is `weightKg - 0`, both bodyweight is `0 - 0 = 0`.
 *
 * Treats a missing previous as `0` so a first-time lift returns the
 * current weight as the delta.
 */
export function compareWeight(
  prev: { weightKg: number | null } | null,
  curr: { weightKg: number | null },
): number {
  const pw = prev?.weightKg ?? 0;
  const cw = curr.weightKg ?? 0;
  return cw - pw;
}

/**
 * Volume delta in kg — sums `reps * weightKg` over each side and returns
 * the difference. Treats a missing previous as `0`. Bodyweight sets
 * contribute 0 to each side.
 */
export function compareVolume(
  prevSets: ReadonlyArray<PerformedWorkoutSet> | null,
  currSets: ReadonlyArray<PerformedWorkoutSet>,
): number {
  const prevVolume = prevSets === null ? 0 : exerciseVolumeKg(prevSets);
  const currVolume = exerciseVolumeKg(currSets);
  return currVolume - prevVolume;
}

/**
 * Pick the "best" representative set for headline comparison. Highest
 * `weightKg` wins; ties are broken by most reps. Returns `null` for an
 * empty input. Bodyweight-only inputs return their first set (matches
 * the `reps`-only dimension).
 */
export function pickTopSetForComparison(
  sets: ReadonlyArray<PerformedWorkoutSet>,
): { weightKg: number | null; reps: number } | null {
  if (sets.length === 0) return null;
  let best: PerformedWorkoutSet | undefined;
  for (const set of sets) {
    if (best === undefined) {
      best = set;
      continue;
    }
    const bw = best.weightKg;
    const sw = set.weightKg;
    // A null weight cannot beat any non-null weight. Among nulls, prefer
    // the most-repped set; among ties on weight, prefer the most-repped set.
    if (sw === null) {
      if (bw === null && set.reps > best.reps) best = set;
      continue;
    }
    if (bw === null) {
      best = set;
      continue;
    }
    if (sw > bw) {
      best = set;
    } else if (sw === bw && set.reps > best.reps) {
      best = set;
    }
  }
  if (best === undefined) return null;
  return { weightKg: best.weightKg, reps: best.reps };
}

/**
 * Compute the headline progression deltas between a previous and current
 * exercise. Each field is `null` when the dimension does not apply (no
 * weighted set on either side, etc.). Always returns an object so the
 * caller can render unconditionally.
 *
 * Semantics:
 *  - `weightDeltaKg` — difference of the top-set weights in kg, or `null`
 *    if either side has no weighted set.
 *  - `repsDelta` — difference of the top-set reps, or `null` if either
 *    side is empty.
 *  - `volumeDeltaKg` — difference of total set-volume in kg, or `null` if
 *    neither side contains any weighted set (so bodyweight sessions do
 *    not produce misleading "+0 kg" labels).
 */
export function progressionSummary(
  prev: PerformedWorkoutExercise | null,
  prevSets: ReadonlyArray<PerformedWorkoutSet>,
  currSets: ReadonlyArray<PerformedWorkoutSet>,
): { weightDeltaKg: number | null; repsDelta: number | null; volumeDeltaKg: number | null } {
  void prev; // reserved for context (e.g. linking back to the prev workout id)

  const prevTop = pickTopSetForComparison(prevSets);
  const currTop = pickTopSetForComparison(currSets);

  // Weight delta — null when either side is missing a weighted top set.
  let weightDeltaKg: number | null;
  if (
    currTop === null ||
    prevTop === null ||
    currTop.weightKg === null ||
    prevTop.weightKg === null
  ) {
    weightDeltaKg = null;
  } else {
    weightDeltaKg = currTop.weightKg - prevTop.weightKg;
  }

  // Reps delta — null when either side has no top set at all.
  let repsDelta: number | null;
  if (currTop === null || prevTop === null) {
    repsDelta = null;
  } else {
    repsDelta = currTop.reps - prevTop.reps;
  }

  // Volume delta — null when neither side has any weighted set.
  const prevHasWeights = prevSets.some((s) => s.weightKg !== null);
  const currHasWeights = currSets.some((s) => s.weightKg !== null);
  let volumeDeltaKg: number | null;
  if (!prevHasWeights && !currHasWeights) {
    volumeDeltaKg = null;
  } else {
    let prevVolume = 0;
    for (const s of prevSets) prevVolume += setVolumeKg(s.reps, s.weightKg);
    const currVolume = exerciseVolumeKg(currSets);
    // Use `bestSetByVolume` indirectly by recomputing (the helper returns a
    // row, not a scalar — exerciseVolumeKg already aggregates correctly).
    void bestSetByVolume; // keep import live; reserved for future "top set" reporting.
    volumeDeltaKg = currVolume - prevVolume;
  }

  return { weightDeltaKg, repsDelta, volumeDeltaKg };
}
