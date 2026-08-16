import type { MeasurementSystem } from './types';

/**
 * Unit conversion utilities.
 *
 * The canonical store is metric (kg + cm). The UI converts to imperial at the
 * edge only — never store a converted value back as the source of truth.
 */

export const KG_PER_LB = 0.45359237; // exact, NIST
export const CM_PER_INCH = 2.54; // exact
export const INCHES_PER_FOOT = 12;

/**
 * Mass conversion between grams and international avoirdupois ounces.
 * Derived from the NIST exact factor: 1 oz = 28.349523125 g.
 */
export const OZ_PER_GRAM = 1 / 28.349523125; // exact, NIST
export const GRAMS_PER_OZ = 28.349523125; // exact, NIST

/**
 * Volume conversion between millilitres and US fluid ounces.
 * NIST exact factor: 1 US fl oz = 29.5735295625 ml.
 */
export const ML_PER_FL_OZ_US = 29.5735295625; // exact, NIST
export const FL_OZ_US_PER_ML = 1 / 29.5735295625; // exact, NIST

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function cmToInches(cm: number): number {
  return cm / CM_PER_INCH;
}

export function inchesToCm(inches: number): number {
  return inches * CM_PER_INCH;
}

/** Convert grams to international avoirdupois ounces. */
export function gramsToOz(g: number): number {
  return g * OZ_PER_GRAM;
}

/** Convert international avoirdupois ounces to grams. */
export function ozToGrams(oz: number): number {
  return oz * GRAMS_PER_OZ;
}

/** Convert millilitres to US fluid ounces. */
export function mlToFlOz(ml: number): number {
  return ml / ML_PER_FL_OZ_US;
}

/** Convert US fluid ounces to millilitres. */
export function flOzToMl(flOz: number): number {
  return flOz * ML_PER_FL_OZ_US;
}

export interface ImperialHeight {
  feet: number;
  inches: number;
}

/**
 * Convert canonical cm to the imperial {feet, inches} form. Uses the *exact*
 * cm value to avoid accumulated rounding error from repeated conversions.
 */
export function cmToFtIn(cm: number): ImperialHeight {
  const totalInches = cmToInches(cm);
  // Floor feet, leftover inches round to one decimal for display; underlying
  // cm is unchanged.
  const feet = Math.floor(totalInches / INCHES_PER_FOOT);
  const inches = totalInches - feet * INCHES_PER_FOOT;
  return { feet, inches: round1(inches) };
}

/**
 * Reconstruct canonical cm from imperial inputs. Always round-trip via cm.
 */
export function ftInToCm(feet: number, inches: number): number {
  const totalInches = feet * INCHES_PER_FOOT + inches;
  return inchesToCm(totalInches);
}

/** Format a weight value for display in the user's preferred system. */
export function formatWeight(
  kg: number,
  system: MeasurementSystem,
  fractionDigits = 1,
): string {
  if (system === 'metric') {
    return `${kg.toFixed(fractionDigits)} kg`;
  }
  return `${kgToLb(kg).toFixed(fractionDigits)} lb`;
}

/** Format a height value for display in the user's preferred system. */
export function formatHeight(cm: number, system: MeasurementSystem): string {
  if (system === 'metric') {
    return `${round1(cm)} cm`;
  }
  const { feet, inches } = cmToFtIn(cm);
  return `${feet}′${inches.toFixed(1)}″`;
}

/**
 * Format a barbell/load weight for display in the user's preferred system.
 *
 *   metric   → `"72.5 kg"`
 *   imperial → `"154.3 lb"`
 *   null     → `"—"`     (no load — bodyweight, ab crunch, plank, ...)
 *
 * Defaults to 1 fractional digit. Canonical store is kg; imperial rendering
 * converts at the edge only.
 */
export function formatLoad(
  kg: number | null,
  system: MeasurementSystem,
  fractionDigits: number = 1,
): string {
  if (kg === null) return '—';
  if (system === 'metric') {
    return `${kg.toFixed(fractionDigits)} kg`;
  }
  return `${kgToLb(kg).toFixed(fractionDigits)} lb`;
}

/**
 * Parse a user-typed load string into canonical kg.
 *
 * Accepts locale-shaped entries like:
 *   - `"72,5"`         → 72.5 kg  (PT/ES comma decimal)
 *   - `"72.5"`         → 72.5 kg  (en/US dot decimal)
 *   - `"154,3 lb"`     → 69.98 kg (stripped + converted)
 *   - `"1,234"`        → 1234 kg  (3 digits after comma → thousands)
 *   - `"1.234"`        → 1234 kg  (3 digits after dot  → thousands)
 *   - `"1,234.5"`      → 1234.5   (dot is decimal; commas are thousands)
 *   - `"1.234,5"`      → 1234.5   (comma is decimal; dots are thousands)
 *
 * Returns `null` on empty input, unparseable input, or input that strips
 * down to no numeric characters.
 */
export function parseLoadInputToKg(raw: string, system: MeasurementSystem): number | null {
  if (typeof raw !== 'string') return null;
  // Strip everything except digits, separators and minus.
  const cleaned = raw.replace(/[^0-9.,-]/g, '');
  if (cleaned.length === 0) return null;

  const normalized = normaliseNumericSeparators(cleaned);
  if (normalized === null) return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;

  return system === 'imperial' ? lbToKg(parsed) : parsed;
}

/**
 * Apply the locale-separator disambiguation rules and produce a normalized
 * number string using `.` as the decimal separator.
 *
 * Rules (in order):
 *  1. No separators → return as-is.
 *  2. Both `,` and `.` present → whichever appears LAST is the decimal
 *     separator; the other one is treated as a thousands separator and
 *     removed. `"1,234.5"` → `"1234.5"`, `"1.234,5"` → `"1234.5"`.
 *  3. Exactly one separator present AND exactly 3 digits follow it → treat
 *     as thousands separator and remove. `"1,234"` → `"1234"`, `"1.234"`
 *     → `"1234"`.
 *  4. Otherwise the single separator is a decimal → replace `,` with `.`
 *     (`.` is already canonical). `"72,5"` → `"72.5"`, `"72.5"` → `"72.5"`.
 *
 * Returns `null` when the result is empty or unparseable.
 */
function normaliseNumericSeparators(input: string): string | null {
  const hasComma = input.includes(',');
  const hasDot = input.includes('.');

  if (!hasComma && !hasDot) {
    return input.length > 0 ? input : null;
  }

  if (hasComma && hasDot) {
    const lastComma = input.lastIndexOf(',');
    const lastDot = input.lastIndexOf('.');
    if (lastComma > lastDot) {
      // Comma is the decimal; dots are thousands separators.
      const withoutDots = input.replace(/\./g, '');
      return replaceLastCommaWithDot(withoutDots);
    }
    // Dot is the decimal; commas are thousands separators.
    return input.replace(/,/g, '');
  }

  // Exactly one separator.
  const sep = hasComma ? ',' : '.';
  const idx = input.lastIndexOf(sep);
  const after = input.substring(idx + 1);
  if (after.length === 3) {
    // Thousands separator: strip it.
    return input.substring(0, idx) + input.substring(idx + 1);
  }
  // Decimal separator: ensure `.` (commas become dots; dots stay).
  if (sep === ',') {
    return replaceLastCommaWithDot(input);
  }
  return input;
}

/**
 * Replace the final `,` in `input` with `.` and drop any other commas (which
 * would otherwise confuse the JS number parser). Returns `null` if there is
 * no comma to replace.
 */
function replaceLastCommaWithDot(input: string): string | null {
  const idx = input.lastIndexOf(',');
  if (idx === -1) return null;
  const before = input.substring(0, idx).replace(/,/g, '');
  const after = input.substring(idx + 1).replace(/,/g, '');
  const out = `${before}.${after}`;
  return out.length > 0 ? out : null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}