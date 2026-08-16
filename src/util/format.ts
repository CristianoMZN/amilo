// Pure formatting helpers. No Vue, Pinia, Capacitor or Quasar imports.
//
// All locale-aware formatting goes through `Intl.NumberFormat` /
// `Intl.DateTimeFormat`. The locale is passed explicitly — never read from
// the navigator — so the same code path is used at dev and render time.

import type { MeasurementSystem, SupportedLocale } from 'src/domain/types';
import { gramsToOz, mlToFlOz } from 'src/domain/measurements';

/**
 * Format an energy value with a trailing `kcal` unit. Defaults to 0
 * fractional digits so whole-kcal counts stay tidy.
 *
 * @example formatKcal(420, 'en-US')        // "420 kcal"
 * @example formatKcal(420.4, 'pt-BR', 1)   // "420,4 kcal"
 */
export function formatKcal(
  value: number,
  locale: SupportedLocale,
  fractionDigits: number = 0,
): string {
  return `${formatNumber(value, locale, fractionDigits)} kcal`;
}

/**
 * Format a macro value with a trailing `g` unit. Defaults to 1 fractional
 * digit so values like `"32.4 g"` render naturally.
 */
export function formatMacroGrams(
  value: number,
  locale: SupportedLocale,
  fractionDigits: number = 1,
): string {
  return `${formatNumber(value, locale, fractionDigits)} g`;
}

/**
 * Format a grams value in the user's preferred measurement system.
 *
 *   metric   → "150 g"
 *   imperial → "5.3 oz"      (NIST: 1 oz = 28.349523125 g)
 *
 * Defaults to 1 fractional digit.
 */
export function formatGramsForSystem(
  value: number,
  locale: SupportedLocale,
  system: MeasurementSystem,
  fractionDigits: number = 1,
): string {
  if (system === 'metric') {
    return `${formatNumber(value, locale, fractionDigits)} g`;
  }
  return `${formatNumber(gramsToOz(value), locale, fractionDigits)} oz`;
}

/**
 * Format a millilitre value in the user's preferred measurement system.
 *
 *   metric   → "200 ml"
 *   imperial → "6.8 fl oz"   (NIST: 1 US fl oz = 29.5735295625 ml)
 *
 * Defaults to 1 fractional digit.
 */
export function formatMillilitersForSystem(
  value: number,
  locale: SupportedLocale,
  system: MeasurementSystem,
  fractionDigits: number = 1,
): string {
  if (system === 'metric') {
    return `${formatNumber(value, locale, fractionDigits)} ml`;
  }
  return `${formatNumber(mlToFlOz(value), locale, fractionDigits)} fl oz`;
}

/**
 * Format a ratio as a percentage. Inputs are in `[0, 1]` style (1 = 100%).
 * Negative ratios clamp to 0%; ratios above 9.99 (= 999%) clamp to 999%.
 *
 * @example formatPercent(0.5, 'en-US')   // "50%"
 * @example formatPercent(10,  'en-US')   // "999%" (capped)
 */
export function formatPercent(
  ratio: number,
  locale: SupportedLocale,
  fractionDigits: number = 0,
): string {
  const clamped = Math.min(Math.max(ratio, 0), 9.99);
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(clamped);
}

/**
 * Generic locale-aware number formatter. When `fractionDigits` is omitted,
 * `Intl.NumberFormat` defaults apply (3 max fraction digits, grouping on).
 */
export function formatNumber(
  value: number,
  locale: SupportedLocale,
  fractionDigits?: number,
): string {
  if (fractionDigits === undefined) {
    return new Intl.NumberFormat(locale).format(value);
  }
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/**
 * Round a value to a fixed number of fractional digits for display.
 *
 * Uses the straightforward `Math.round(value * 10^d) / 10^d` formula. Note
 * that IEEE 754 can produce surprising results for inputs like `1.005`
 * (rounds to `1.00` rather than `1.01`) — callers needing exact
 * decimal rounding should pre-quantize via `toFixed` strings.
 */
export function roundForDisplay(value: number, fractionDigits: number): number {
  const factor = Math.pow(10, fractionDigits);
  return Math.round(value * factor) / factor;
}
