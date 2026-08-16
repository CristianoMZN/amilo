import { describe, expect, it } from 'vitest';
import {
  addDays,
  compareLocalDates,
  dateRangeInclusive,
  formatLocalDateLong,
  isValidLocalDate,
  parseLocalDate,
  todayLocalDate,
} from 'src/util/dateDay';

describe('todayLocalDate', () => {
  it('returns a YYYY-MM-DD string for a given Date', () => {
    expect(todayLocalDate(new Date(2026, 7, 16))).toBe('2026-08-16');
  });

  it('zero-pads single-digit months and days', () => {
    expect(todayLocalDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(todayLocalDate(new Date(2026, 8, 9))).toBe('2026-09-09');
  });

  it('matches the YYYY-MM-DD shape', () => {
    const result = todayLocalDate();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('parseLocalDate', () => {
  it('parses a valid date', () => {
    expect(parseLocalDate('2026-08-16')).toEqual({ y: 2026, m: 8, d: 16 });
  });

  it('rejects empty input', () => {
    expect(parseLocalDate('')).toBeNull();
  });

  it('rejects un-padded components', () => {
    expect(parseLocalDate('2026-8-16')).toBeNull();
    expect(parseLocalDate('2026-08-6')).toBeNull();
  });

  it('rejects out-of-range months', () => {
    expect(parseLocalDate('2026-00-15')).toBeNull();
    expect(parseLocalDate('2026-13-01')).toBeNull();
  });

  it('rejects out-of-range days', () => {
    expect(parseLocalDate('2026-08-00')).toBeNull();
    expect(parseLocalDate('2026-08-32')).toBeNull();
  });

  it('rejects non-existent dates (Feb 30, Apr 31)', () => {
    expect(parseLocalDate('2026-02-30')).toBeNull();
    expect(parseLocalDate('2026-04-31')).toBeNull();
  });

  it('accepts leap day in a leap year', () => {
    expect(parseLocalDate('2024-02-29')).toEqual({ y: 2024, m: 2, d: 29 });
  });

  it('rejects leap day in a non-leap year', () => {
    expect(parseLocalDate('2026-02-29')).toBeNull();
  });

  it('rejects non-string-shaped input', () => {
    expect(parseLocalDate('not-a-date')).toBeNull();
    expect(parseLocalDate('2026/08/16')).toBeNull();
    expect(parseLocalDate('2026-8-16T00:00:00')).toBeNull();
  });
});

describe('isValidLocalDate', () => {
  it('returns true for a valid date', () => {
    expect(isValidLocalDate('2026-08-16')).toBe(true);
  });

  it('returns false for an invalid date', () => {
    expect(isValidLocalDate('2026-02-30')).toBe(false);
    expect(isValidLocalDate('2026-8-16')).toBe(false);
    expect(isValidLocalDate('')).toBe(false);
  });
});

describe('compareLocalDates', () => {
  it('returns -1 when a < b', () => {
    expect(compareLocalDates('2026-01-01', '2026-01-02')).toBe(-1);
    expect(compareLocalDates('2025-12-31', '2026-01-01')).toBe(-1);
  });

  it('returns 1 when a > b', () => {
    expect(compareLocalDates('2026-01-02', '2026-01-01')).toBe(1);
    expect(compareLocalDates('2026-01-01', '2025-12-31')).toBe(1);
  });

  it('returns 0 when equal', () => {
    expect(compareLocalDates('2026-08-16', '2026-08-16')).toBe(0);
  });
});

describe('addDays', () => {
  it('adds positive days within the same month', () => {
    expect(addDays('2026-08-16', 3)).toBe('2026-08-19');
  });

  it('subtracts days with negative input', () => {
    expect(addDays('2026-08-16', -2)).toBe('2026-08-14');
  });

  it('rolls over month boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('rolls over year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('handles leap day correctly', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
  });

  it('returns the same date when adding zero', () => {
    expect(addDays('2026-08-16', 0)).toBe('2026-08-16');
  });

  it('throws on invalid input', () => {
    expect(() => addDays('not-a-date', 1)).toThrow();
  });
});

describe('dateRangeInclusive', () => {
  it('returns every day in [start, end]', () => {
    expect(dateRangeInclusive('2026-01-01', '2026-01-03')).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
    ]);
  });

  it('returns a single-element list when start === end', () => {
    expect(dateRangeInclusive('2026-08-16', '2026-08-16')).toEqual(['2026-08-16']);
  });

  it('returns an empty list when start > end', () => {
    expect(dateRangeInclusive('2026-01-03', '2026-01-01')).toEqual([]);
  });

  it('crosses month boundaries', () => {
    expect(dateRangeInclusive('2026-01-30', '2026-02-02')).toEqual([
      '2026-01-30',
      '2026-01-31',
      '2026-02-01',
      '2026-02-02',
    ]);
  });

  it('crosses year boundaries', () => {
    expect(dateRangeInclusive('2026-12-30', '2027-01-02')).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
  });
});

describe('formatLocalDateLong', () => {
  it('returns a non-empty string for a valid date in en', () => {
    const result = formatLocalDateLong('2026-08-16', 'en');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('16');
  });

  it('includes the weekday and month name in English', () => {
    const result = formatLocalDateLong('2026-08-16', 'en');
    // 2026-08-16 is a Sunday; August is the month.
    expect(result.toLowerCase()).toMatch(/sun/);
    expect(result.toLowerCase()).toMatch(/aug/);
  });

  it('returns a non-empty string for a valid date in pt-BR', () => {
    const result = formatLocalDateLong('2026-08-16', 'pt-BR');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('16');
  });

  it('returns an empty string for an invalid date', () => {
    expect(formatLocalDateLong('not-a-date', 'en')).toBe('');
  });
});
