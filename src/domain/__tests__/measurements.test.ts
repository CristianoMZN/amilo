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
  formatLoad,
  formatWeight,
  gramsToOz,
  inchesToCm,
  kgToLb,
  lbToKg,
  mlToFlOz,
  ozToGrams,
  parseLoadInputToKg,
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

describe('formatLoad', () => {
  it('renders metric with kg', () => {
    expect(formatLoad(72.5, 'metric')).toBe('72.5 kg');
  });

  it('renders imperial with lb (canonical kg → lb)', () => {
    // 70 kg / 0.45359237 ≈ 154.32308… → toFixed(1) = "154.3"
    expect(formatLoad(70, 'imperial')).toBe('154.3 lb');
  });

  it('returns the em-dash placeholder when the weight is null', () => {
    expect(formatLoad(null, 'metric')).toBe('—');
    expect(formatLoad(null, 'imperial')).toBe('—');
  });

  it('respects custom fractionDigits', () => {
    expect(formatLoad(72.5, 'metric', 2)).toBe('72.50 kg');
    expect(formatLoad(72.5, 'imperial', 0)).toBe('160 lb');
  });
});

describe('parseLoadInputToKg', () => {
  it('parses pt-BR comma-decimal in metric', () => {
    expect(parseLoadInputToKg('72,5', 'metric')).toBe(72.5);
  });

  it('parses en dot-decimal and converts to kg when imperial', () => {
    // 72.5 lb × 0.45359237 ≈ 32.886
    expect(parseLoadInputToKg('72.5', 'imperial')).toBeCloseTo(72.5 * KG_PER_LB, 2);
    expect(parseLoadInputToKg('72.5', 'imperial')).toBeCloseTo(32.886, 2);
  });

  it('keeps en dot-decimal verbatim in metric', () => {
    expect(parseLoadInputToKg('72.5', 'metric')).toBe(72.5);
  });

  it('treats a single comma with exactly 3 digits as a thousands separator', () => {
    expect(parseLoadInputToKg('1,234', 'metric')).toBe(1234);
  });

  it('treats a single dot with exactly 3 digits as a thousands separator', () => {
    expect(parseLoadInputToKg('1.234', 'metric')).toBe(1234);
  });

  it('handles US-style thousands + decimal: "1,234.5"', () => {
    expect(parseLoadInputToKg('1,234.5', 'metric')).toBe(1234.5);
  });

  it('handles EU-style thousands + decimal: "1.234,5"', () => {
    expect(parseLoadInputToKg('1.234,5', 'metric')).toBe(1234.5);
  });

  it('strips trailing units like "lb"', () => {
    // "154,3 lb" → "154,3" → decimal → 154.3 (interpreted in user system)
    expect(parseLoadInputToKg('154,3 lb', 'metric')).toBe(154.3);
    // imperial: 154.3 lb × 0.45359237 ≈ 69.9893 kg
    expect(parseLoadInputToKg('154,3 lb', 'imperial')).toBeCloseTo(154.3 * KG_PER_LB, 2);
  });

  it('parses zero', () => {
    expect(parseLoadInputToKg('0', 'metric')).toBe(0);
    expect(parseLoadInputToKg('0,0', 'metric')).toBe(0);
  });

  it('returns null for empty input', () => {
    expect(parseLoadInputToKg('', 'metric')).toBeNull();
    expect(parseLoadInputToKg('   ', 'metric')).toBeNull();
  });

  it('returns null for unparseable input', () => {
    expect(parseLoadInputToKg('abc', 'metric')).toBeNull();
    expect(parseLoadInputToKg('--', 'metric')).toBeNull();
    expect(parseLoadInputToKg('.', 'metric')).toBeNull();
    expect(parseLoadInputToKg(',', 'metric')).toBeNull();
  });

  it('returns null for a non-string input', () => {
    expect(parseLoadInputToKg(null as unknown as string, 'metric')).toBeNull();
    expect(parseLoadInputToKg(undefined as unknown as string, 'metric')).toBeNull();
    expect(parseLoadInputToKg(123 as unknown as string, 'metric')).toBeNull();
  });
});