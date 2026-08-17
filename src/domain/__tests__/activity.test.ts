import { describe, expect, it } from 'vitest';
import { ACTIVITY_LEVELS, getActivityFactor, isActivityLevel } from 'src/domain/activity';

describe('activity levels', () => {
  it('exposes the standard five clinical categories', () => {
    expect(ACTIVITY_LEVELS.map((a) => a.id)).toEqual([
      'sedentary',
      'lightly_active',
      'moderately_active',
      'very_active',
      'extremely_active',
    ]);
  });

  it('uses the standard Mifflin–St Jeor factors', () => {
    expect(getActivityFactor('sedentary')).toBe(1.2);
    expect(getActivityFactor('lightly_active')).toBe(1.375);
    expect(getActivityFactor('moderately_active')).toBe(1.55);
    expect(getActivityFactor('very_active')).toBe(1.725);
    expect(getActivityFactor('extremely_active')).toBe(1.9);
  });

  it('isActivityLevel narrows unknown values to false', () => {
    expect(isActivityLevel('sedentary')).toBe(true);
    expect(isActivityLevel('bogus')).toBe(false);
    expect(isActivityLevel(123)).toBe(false);
    expect(isActivityLevel(null)).toBe(false);
    expect(isActivityLevel(undefined)).toBe(false);
    expect(isActivityLevel({})).toBe(false);
  });
});
