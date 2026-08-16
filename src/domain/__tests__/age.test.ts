import { describe, expect, it } from 'vitest';
import { calculateAge, estimateTdee } from 'src/domain/age';
import { mifflinStJeor } from 'src/domain/metabolism';

describe('calculateAge', () => {
  it('returns the age in completed years when the birthday has passed', () => {
    const age = calculateAge('1990-06-15', '2026-08-16T00:00:00Z');
    expect(age).toBe(36);
  });

  it('returns one year less when the birthday has not yet happened this year', () => {
    const age = calculateAge('1990-12-31', '2026-08-16T00:00:00Z');
    expect(age).toBe(35);
  });

  it('handles the same day as a birthday (counts up at UTC midnight)', () => {
    const age = calculateAge('1990-08-16', '2026-08-16T00:00:00Z');
    // August 16 vs August 16 with same UTC date — the getUTCDate comparison
    // returns equal, so we don't subtract.
    expect(age).toBe(36);
  });

  it('throws on invalid birth date', () => {
    expect(() => calculateAge('not-a-date', '2026-08-16T00:00:00Z')).toThrow();
  });

  it('throws on invalid reference time', () => {
    expect(() => calculateAge('1990-06-15', 'not-a-date')).toThrow();
  });
});

describe('mifflinStJeor', () => {
  it('matches the standard male reference for a 30y 80kg 180cm man', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    expect(mifflinStJeor('male', 80, 180, 30)).toBeCloseTo(1780, 5);
  });

  it('matches the standard female reference for a 30y 65kg 165cm woman', () => {
    // 10*65 + 6.25*165 - 5*30 - 161 = 650 + 1031.25 - 150 - 161 = 1370.25
    expect(mifflinStJeor('female', 65, 165, 30)).toBeCloseTo(1370.25, 5);
  });

  it('female BMR is always lower than male BMR at the same inputs', () => {
    const male = mifflinStJeor('male', 70, 170, 30);
    const female = mifflinStJeor('female', 70, 170, 30);
    expect(female).toBeLessThan(male);
    expect(male - female).toBeCloseTo(166, 5);
  });
});

describe('estimateTdee', () => {
  it('multiplies BMR by the sedentary factor (1.2)', () => {
    const tdee = estimateTdee({
      sex: 'male',
      weightKg: 80,
      heightCm: 180,
      birthDateIso: '1990-06-15',
      activity: 'sedentary',
      nowIso: '2026-08-16T00:00:00Z',
    });
    // birth 1990-06-15, now 2026-08-16 → age 36
    // BMR = 10*80 + 6.25*180 - 5*36 + 5 = 800 + 1125 - 180 + 5 = 1750
    expect(tdee.bmrKcal).toBeCloseTo(1750, 5);
    expect(tdee.tdeeKcal).toBeCloseTo(1750 * 1.2, 5);
    expect(tdee.activity).toBe('sedentary');
  });

  it('scales with the very_active factor (1.725)', () => {
    const tdee = estimateTdee({
      sex: 'female',
      weightKg: 65,
      heightCm: 165,
      birthDateIso: '1995-01-01',
      activity: 'very_active',
      nowIso: '2026-08-16T00:00:00Z',
    });
    expect(tdee.activity).toBe('very_active');
    expect(tdee.tdeeKcal).toBeCloseTo(tdee.bmrKcal * 1.725, 5);
  });

  it('returns the requested activity id verbatim', () => {
    const tdee = estimateTdee({
      sex: 'male',
      weightKg: 80,
      heightCm: 180,
      birthDateIso: '1990-06-15',
      activity: 'extremely_active',
      nowIso: '2026-08-16T00:00:00Z',
    });
    expect(tdee.activity).toBe('extremely_active');
  });
});