import { describe, expect, it } from 'vitest';
import {
  formatGramsForSystem,
  formatKcal,
  formatMacroGrams,
  formatMillilitersForSystem,
  formatNumber,
  formatPercent,
  roundForDisplay,
} from 'src/util/format';

describe('formatNumber locale separators', () => {
  it('uses "." as the decimal separator in en-US', () => {
    expect(formatNumber(32.4, 'en', 1)).toBe('32.4');
    expect(formatNumber(1234.5, 'en', 1)).toBe('1,234.5');
  });

  it('uses "," as the decimal separator in pt-BR', () => {
    expect(formatNumber(32.4, 'pt-BR', 1)).toBe('32,4');
    expect(formatNumber(1234.5, 'pt-BR', 1)).toBe('1.234,5');
  });

  it('keeps the locale separator across de, fr, it', () => {
    expect(formatNumber(1.5, 'de', 1)).toBe('1,5');
    expect(formatNumber(1.5, 'fr', 1)).toBe('1,5');
    expect(formatNumber(1.5, 'it', 1)).toBe('1,5');
  });
});

describe('formatKcal', () => {
  it('uses an integer formatting by default', () => {
    expect(formatKcal(420, 'en')).toBe('420 kcal');
    expect(formatKcal(420, 'pt-BR')).toBe('420 kcal');
  });

  it('honours fractionDigits with the locale separator', () => {
    expect(formatKcal(420.4, 'en', 1)).toBe('420.4 kcal');
    expect(formatKcal(420.4, 'pt-BR', 1)).toBe('420,4 kcal');
  });

  it('always appends the kcal unit', () => {
    expect(formatKcal(0, 'en')).toBe('0 kcal');
    expect(formatKcal(0, 'pt-BR')).toBe('0 kcal');
  });
});

describe('formatMacroGrams', () => {
  it('formats grams with 1 decimal by default', () => {
    expect(formatMacroGrams(32.4, 'pt-BR')).toBe('32,4 g');
    expect(formatMacroGrams(32.4, 'en')).toBe('32.4 g');
  });

  it('honours custom fractionDigits', () => {
    expect(formatMacroGrams(32, 'en', 0)).toBe('32 g');
    expect(formatMacroGrams(32.456, 'en', 2)).toBe('32.46 g');
  });
});

describe('formatGramsForSystem', () => {
  it('renders metric with "g" and no conversion', () => {
    expect(formatGramsForSystem(150, 'en', 'metric', 0)).toBe('150 g');
  });

  it('renders imperial with "oz" using the NIST conversion', () => {
    // 150 g / 28.349523125 g/oz = 5.29109... oz → "5.3 oz" with 1 decimal
    expect(formatGramsForSystem(150, 'en', 'imperial', 1)).toBe('5.3 oz');
  });

  it('uses the locale separator for the imperial side', () => {
    // 150 g ≈ 5,3 oz in pt-BR
    expect(formatGramsForSystem(150, 'pt-BR', 'imperial', 1)).toBe('5,3 oz');
  });

  it('handles zero', () => {
    expect(formatGramsForSystem(0, 'en', 'metric', 0)).toBe('0 g');
    expect(formatGramsForSystem(0, 'en', 'imperial', 1)).toBe('0.0 oz');
  });
});

describe('formatMillilitersForSystem', () => {
  it('renders metric with "ml" and no conversion', () => {
    expect(formatMillilitersForSystem(200, 'en', 'metric', 0)).toBe('200 ml');
  });

  it('renders imperial with "fl oz" using the NIST conversion', () => {
    // 200 ml / 29.5735295625 ml/fl oz = 6.76280... fl oz → "6.8 fl oz"
    expect(formatMillilitersForSystem(200, 'en', 'imperial', 1)).toBe('6.8 fl oz');
  });

  it('uses the locale separator for the imperial side', () => {
    expect(formatMillilitersForSystem(200, 'pt-BR', 'imperial', 1)).toBe('6,8 fl oz');
  });

  it('handles zero', () => {
    expect(formatMillilitersForSystem(0, 'en', 'metric', 0)).toBe('0 ml');
    expect(formatMillilitersForSystem(0, 'en', 'imperial', 1)).toBe('0.0 fl oz');
  });
});

describe('formatPercent', () => {
  it('uses integer percent by default', () => {
    expect(formatPercent(0.5, 'en')).toBe('50%');
    expect(formatPercent(0.5, 'pt-BR')).toBe('50%');
  });

  it('honours fractionDigits', () => {
    expect(formatPercent(0.5, 'en', 1)).toBe('50.0%');
    expect(formatPercent(0.5, 'pt-BR', 1)).toBe('50,0%');
  });

  it('caps the output at 999%', () => {
    expect(formatPercent(10, 'en')).toBe('999%');
    expect(formatPercent(9.99, 'en')).toBe('999%');
    expect(formatPercent(100, 'en')).toBe('999%');
  });

  it('clamps negative ratios to 0%', () => {
    expect(formatPercent(-1, 'en')).toBe('0%');
  });

  it('handles 0%', () => {
    expect(formatPercent(0, 'en')).toBe('0%');
    expect(formatPercent(0, 'pt-BR')).toBe('0%');
  });
});

describe('roundForDisplay', () => {
  it('matches the spec example 1.999 → 2 at 1 decimal', () => {
    expect(roundForDisplay(1.999, 1)).toBe(2);
  });

  it('rounds to 0 decimals', () => {
    expect(roundForDisplay(0.4, 0)).toBe(0);
    expect(roundForDisplay(0.5, 0)).toBe(1);
    expect(roundForDisplay(1.5, 0)).toBe(2);
  });

  it('rounds to 2 decimals', () => {
    expect(roundForDisplay(1.234, 2)).toBe(1.23);
    expect(roundForDisplay(1.235, 2)).toBe(1.24);
  });

  it('is a no-op for 0 digits', () => {
    expect(roundForDisplay(42.7, 0)).toBe(43);
  });

  it('returns 0 for 0 input', () => {
    expect(roundForDisplay(0, 2)).toBe(0);
  });
});
