// Pure helpers for aerobic activities. No Vue, Pinia, Capacitor or Quasar
// imports.
//
// All functions are deterministic and side-effect-free. No rounding is
// performed inside the math — full double precision is preserved until the
// display edge.

import type { SupportedLocale } from './types';

/**
 * Compute kcal burned for a session given the parent's kcal-per-hour rate
 * and the actual session duration.
 *
 * Returns the full-precision result (`kcalPerHour * durationMinutes / 60`)
 * without any rounding. Callers that need a display value should round at
 * the edge via `formatKcalCompact`.
 */
export function computeKcalFromDuration(kcalPerHour: number, durationMinutes: number): number {
  return (kcalPerHour * durationMinutes) / 60;
}

/**
 * Throw on an invalid session duration. Must be a positive finite number
 * — fractions like `12.5` are allowed. Zero and negatives are rejected so
 * downstream snapshots never end up with negative kcal estimates.
 *
 * Throws `Error('duration must be a positive finite number')` when the
 * input is `0`, negative, NaN, or ±Infinity.
 */
export function assertValidDurationMinutes(minutes: number): void {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new Error('duration must be a positive finite number');
  }
}

/**
 * Build the snapshot bundle persisted on an `AerobicActivity` row. The
 * snapshot freezes the values that may change underneath (exercise name,
 * kcal/h rate) so historical rows stay correct even if the parent exercise
 * is edited or deleted.
 *
 * `kcalEstimated` is computed at full precision — rounding is left to the
 * caller / display edge.
 */
export function buildAerobicSnapshot(args: {
  exerciseName: string;
  kcalPerHour: number;
  durationMinutes: number;
}): { exerciseNameSnapshot: string; kcalPerHourSnapshot: number; kcalEstimated: number } {
  return {
    exerciseNameSnapshot: args.exerciseName,
    kcalPerHourSnapshot: args.kcalPerHour,
    kcalEstimated: computeKcalFromDuration(args.kcalPerHour, args.durationMinutes),
  };
}

/**
 * Compact, locale-aware kcal rendering. Drops fractional digits entirely
 * (`maximumFractionDigits: 0`) so whole-kcal counts stay tidy in compact UI
 * (chips, badges, totals). Grouping separators come from ICU so:
 *
 *   - `formatKcalCompact(1234, 'en')`    → `"1,234"`
 *   - `formatKcalCompact(1234, 'pt-BR')` → `"1.234"`
 *
 * Negative inputs are formatted as-is (no clamping) — callers that want to
 * guard against negatives should validate upstream.
 */
export function formatKcalCompact(kcal: number, locale: SupportedLocale): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(kcal);
}
