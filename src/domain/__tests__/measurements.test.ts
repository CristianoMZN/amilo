import { describe, expect, it } from 'vitest';
import {
  FL_OZ_US_PER_ML,
  GRAMS_PER_OZ,
  KG_PER_LB,
  ML_PER_FL_OZ_US,
  OZ_PER_GRAM,
  cmToFtIn,
  cmToInches,
  flOzToMl,
  ftInToCm,
  formatHeight,
  formatWeight,
  gramsToOz,
  inchesToCm,
  kgToLb,
  lbToKg,
  mlToFlOz,
  ozToGrams,
} from 'src/domain/measurements';

describe('kg ↔ lb', () => {
  it('round-trips a value through lb without drift', () => {
    expect(lbToKg(kgToLb(80))).toBeCloseTo(80, 10);
    expect(kgToLb(lbToKg(150))).toBeCloseTo(150, 10);
  });

  it('uses the exact NIST constant 0.45359237', () => {
    expect(KG_PER_LB).toBe(0.45359237);
    // 1 kg ≈ 2.20462262 lb
    expect(kgToLb(1)).toBeCloseTo(1 / 0.45359237, 12);
  });

  it('handles edge values', () => {
    expect(kgToLb(0)).toBe(0);
    expect(lbToKg(0)).toBe(0);
    expect(kgToLb(100)).toBeCloseTo(220.462262, 5);
  });
});

describe('cm ↔ ft/in', () => {
  it('round-trips through raw inches without drift', () => {
    // The canonical store is cm. Raw inches (cmToInches) round-trip losslessly.
    const original = 175; // cm
    expect(inchesToCm(cmToInches(original))).toBeCloseTo(original, 12);
  });

  it('ft+in display form is rounded to 1 decimal and does NOT round-trip losslessly', () => {
    // This is by design: ft+in is the *display* form. The canonical store is cm.
    // Converting display feet/inches back to cm is for *input parsing* only.
    const original = 175; // cm
    const { feet, inches } = cmToFtIn(original);
    expect(feet).toBe(5);
    expect(inches).toBeCloseTo(8.9, 1); // 175cm ≈ 68.8976 in, − 5ft (60in) ≈ 8.9
    // Reverse parse has tiny drift (~0.5cm) due to inches being rounded.
    expect(Math.abs(ftInToCm(feet, inches) - original)).toBeLessThan(0.6);
  });

  it('splits 180cm into 5ft with the leftover inches', () => {
    const { feet, inches } = cmToFtIn(180);
    expect(feet).toBe(5);
    // 180cm → 70.8661… in → ~10.87 in after subtracting 5ft (60in)
    expect(inches).toBeCloseTo(10.9, 1);
  });

  it('handles cm < 1ft (e.g. children)', () => {
    const { feet, inches } = cmToFtIn(50);
    expect(feet).toBe(1); // 50cm ≈ 19.7in, floor(19.7/12) = 1
    expect(inches).toBeCloseTo(7.7, 1);
  });

  it('inchesToCm uses the exact 2.54 constant', () => {
    expect(inchesToCm(1)).toBeCloseTo(2.54, 10);
    expect(cmToInches(2.54)).toBeCloseTo(1, 10);
  });
});

describe('formatWeight', () => {
  it('renders metric with kg', () => {
    expect(formatWeight(80, 'metric')).toBe('80.0 kg');
  });

  it('renders imperial with lb', () => {
    expect(formatWeight(80, 'imperial')).toMatch(/^1\d\d\.\d lb$/);
  });

  it('respects custom fractionDigits', () => {
    expect(formatWeight(80, 'metric', 2)).toBe('80.00 kg');
  });
});

describe('formatHeight', () => {
  it('renders metric with cm', () => {
    expect(formatHeight(175, 'metric')).toBe('175 cm');
  });

  it('renders imperial with feet and inches glyphs', () => {
    const formatted = formatHeight(180, 'imperial');
    expect(formatted).toMatch(/^5′10\.\d″$/);
  });
});

describe('g ↔ oz', () => {
  it('round-trips a value through oz without drift', () => {
    expect(ozToGrams(gramsToOz(150))).toBeCloseTo(150, 10);
    expect(gramsToOz(ozToGrams(5))).toBeCloseTo(5, 10);
  });

  it('uses the exact NIST constants', () => {
    expect(GRAMS_PER_OZ).toBe(28.349523125);
    expect(OZ_PER_GRAM).toBeCloseTo(1 / 28.349523125, 15);
    expect(gramsToOz(28.349523125)).toBeCloseTo(1, 12);
    expect(ozToGrams(1)).toBeCloseTo(28.349523125, 12);
  });

  it('handles edge values', () => {
    expect(gramsToOz(0)).toBe(0);
    expect(ozToGrams(0)).toBe(0);
    // 150 g ≈ 5.29109 oz
    expect(gramsToOz(150)).toBeCloseTo(5.29109, 4);
  });
});

describe('ml ↔ fl oz (US)', () => {
  it('round-trips a value through fl oz without drift', () => {
    expect(flOzToMl(mlToFlOz(200))).toBeCloseTo(200, 10);
    expect(mlToFlOz(flOzToMl(6))).toBeCloseTo(6, 10);
  });

  it('uses the exact NIST constants', () => {
    expect(ML_PER_FL_OZ_US).toBe(29.5735295625);
    expect(FL_OZ_US_PER_ML).toBeCloseTo(1 / 29.5735295625, 15);
    expect(mlToFlOz(29.5735295625)).toBeCloseTo(1, 12);
    expect(flOzToMl(1)).toBeCloseTo(29.5735295625, 12);
  });

  it('handles edge values', () => {
    expect(mlToFlOz(0)).toBe(0);
    expect(flOzToMl(0)).toBe(0);
    // 200 ml ≈ 6.7628 fl oz
    expect(mlToFlOz(200)).toBeCloseTo(6.7628, 3);
  });
});