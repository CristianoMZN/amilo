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

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}