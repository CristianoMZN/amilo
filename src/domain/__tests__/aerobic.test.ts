import { describe, expect, it } from 'vitest';
import {
  assertValidDurationMinutes,
  buildAerobicSnapshot,
  computeKcalFromDuration,
  formatKcalCompact,
} from 'src/domain/aerobic';

describe('computeKcalFromDuration', () => {
  it('computes the textbook 200 kcal/h × 30 min = 100 kcal', () => {
    expect(computeKcalFromDuration(200, 30)).toBe(100);
  });

  it('computes 420 kcal/h × 45 min = 315 kcal', () => {
    expect(computeKcalFromDuration(420, 45)).toBe(315);
  });

  it('preserves full double precision for fractional minutes', () => {
    // 200 * 17.5 / 60 = 58.3333... — the function must NOT round.
    expect(computeKcalFromDuration(200, 17.5)).toBe(58.333333333333336);
  });

  it('returns 0 when the rate is 0', () => {
    expect(computeKcalFromDuration(0, 30)).toBe(0);
  });
});

describe('assertValidDurationMinutes', () => {
  it('accepts positive integers', () => {
    expect(() => assertValidDurationMinutes(30)).not.toThrow();
    expect(() => assertValidDurationMinutes(1)).not.toThrow();
  });

  it('accepts fractional minutes', () => {
    expect(() => assertValidDurationMinutes(12.5)).not.toThrow();
    expect(() => assertValidDurationMinutes(0.5)).not.toThrow();
  });

  it('rejects zero', () => {
    expect(() => assertValidDurationMinutes(0)).toThrow();
  });

  it('rejects negative numbers', () => {
    expect(() => assertValidDurationMinutes(-1)).toThrow();
    expect(() => assertValidDurationMinutes(-0.0001)).toThrow();
  });

  it('rejects NaN', () => {
    expect(() => assertValidDurationMinutes(Number.NaN)).toThrow();
  });

  it('rejects Infinity', () => {
    expect(() => assertValidDurationMinutes(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => assertValidDurationMinutes(Number.NEGATIVE_INFINITY)).toThrow();
  });
});

describe('buildAerobicSnapshot', () => {
  it('returns a snapshot with kcalEstimated computed at full precision', () => {
    const snap = buildAerobicSnapshot({
      exerciseName: 'Walking',
      kcalPerHour: 240,
      durationMinutes: 30,
    });
    expect(snap.exerciseNameSnapshot).toBe('Walking');
    expect(snap.kcalPerHourSnapshot).toBe(240);
    expect(snap.kcalEstimated).toBe(120);
  });

  it('preserves full precision in kcalEstimated for fractional durations', () => {
    const snap = buildAerobicSnapshot({
      exerciseName: 'Walking',
      kcalPerHour: 200,
      durationMinutes: 17.5,
    });
    expect(snap.kcalEstimated).toBe(58.333333333333336);
  });
});

describe('formatKcalCompact', () => {
  it('uses comma thousands separator in en', () => {
    // Sanity check the ICU output the test is asserting against.
    expect(new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(1234)).toBe('1,234');
    expect(formatKcalCompact(1234, 'en')).toBe('1,234');
  });

  it('uses dot thousands separator in pt-BR', () => {
    // ICU: pt-BR uses `.` for thousands and `,` for decimal.
    expect(new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(1234)).toBe('1.234');
    expect(formatKcalCompact(1234, 'pt-BR')).toBe('1.234');
  });

  it('drops fractional digits entirely', () => {
    expect(formatKcalCompact(99.6, 'en')).toBe('100');
    expect(formatKcalCompact(99.4, 'en')).toBe('99');
  });
});
