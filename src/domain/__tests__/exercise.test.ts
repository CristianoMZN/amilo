import { describe, expect, it } from 'vitest';
import {
  assertValidExerciseName,
  assertValidKcalPerHour,
  assertValidReps,
  assertValidWeightKg,
  displayNameFor,
  exercisesMatchSearch,
  findTranslationForLocale,
} from 'src/domain/exercise';
import type { Exercise, ExerciseTranslation } from 'src/domain/types';

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'exercise:walking',
    origin: 'official',
    kind: 'aerobic',
    muscleGroup: null,
    defaultUnit: 'none',
    hasRepetitions: false,
    hasDuration: true,
    notes: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeTranslation(overrides: Partial<ExerciseTranslation>): ExerciseTranslation {
  return {
    exerciseId: 'exercise:walking',
    locale: 'en',
    name: 'Walking',
    search: 'walking',
    ...overrides,
  };
}

describe('findTranslationForLocale', () => {
  it('returns the translation matching the requested locale', () => {
    const translations = [
      makeTranslation({ locale: 'en', name: 'Walking' }),
      makeTranslation({ locale: 'pt-BR', name: 'Caminhada' }),
    ];
    expect(findTranslationForLocale(translations, 'pt-BR')?.name).toBe('Caminhada');
  });

  it('falls back to the en translation when the requested locale is missing', () => {
    const translations = [
      makeTranslation({ locale: 'en', name: 'Walking' }),
      makeTranslation({ locale: 'es', name: 'Caminar' }),
    ];
    expect(findTranslationForLocale(translations, 'pt-BR')?.name).toBe('Walking');
  });

  it('falls back to the first available translation when en is also missing', () => {
    const translations = [
      makeTranslation({ locale: 'es', name: 'Caminar' }),
      makeTranslation({ locale: 'pt-BR', name: 'Caminhada' }),
    ];
    expect(findTranslationForLocale(translations, 'de')?.name).toBe('Caminar');
  });

  it('returns undefined when the list is empty', () => {
    expect(findTranslationForLocale([], 'en')).toBeUndefined();
  });
});

describe('displayNameFor', () => {
  const exercise = makeExercise();

  it('uses the requested locale when present', () => {
    const translations = [
      makeTranslation({ locale: 'en', name: 'Walking' }),
      makeTranslation({ locale: 'pt-BR', name: 'Caminhada' }),
    ];
    expect(displayNameFor(exercise, translations, 'pt-BR')).toBe('Caminhada');
  });

  it('falls back to en when the requested locale is missing', () => {
    const translations = [
      makeTranslation({ locale: 'en', name: 'Walking' }),
      makeTranslation({ locale: 'es', name: 'Caminar' }),
    ];
    expect(displayNameFor(exercise, translations, 'pt-BR')).toBe('Walking');
  });

  it('falls back to the first available translation when en is missing', () => {
    const translations = [
      makeTranslation({ locale: 'es', name: 'Caminar' }),
      makeTranslation({ locale: 'pt-BR', name: 'Caminhada' }),
    ];
    expect(displayNameFor(exercise, translations, 'de')).toBe('Caminar');
  });

  it('returns the exercise id as the last resort', () => {
    expect(displayNameFor(exercise, [], 'pt-BR')).toBe('exercise:walking');
  });
});

describe('exercisesMatchSearch', () => {
  const exercise = makeExercise();

  it('matches a substring with diacritic insensitivity', () => {
    // Stored search blob has diacritics stripped at write-time.
    const translations = [
      makeTranslation({ locale: 'pt-BR', name: 'Caminhada', search: 'caminhada' }),
    ];
    expect(exercisesMatchSearch(exercise, translations, 'camin', 'pt-BR')).toBe(true);
    expect(exercisesMatchSearch(exercise, translations, 'CAMIN', 'pt-BR')).toBe(true);
  });

  it('does not match when the substring is absent', () => {
    const translations = [
      makeTranslation({ locale: 'pt-BR', name: 'Caminhada', search: 'caminhada' }),
    ];
    expect(exercisesMatchSearch(exercise, translations, 'xyz', 'pt-BR')).toBe(false);
  });

  it('falls back to en when the target locale is missing', () => {
    const translations = [makeTranslation({ locale: 'en', name: 'Walking', search: 'walking' })];
    expect(exercisesMatchSearch(exercise, translations, 'walk', 'pt-BR')).toBe(true);
  });

  it('returns false on empty translations', () => {
    expect(exercisesMatchSearch(exercise, [], 'walk', 'en')).toBe(false);
  });
});

describe('assertValidExerciseName', () => {
  it('accepts a normal name', () => {
    expect(() => assertValidExerciseName('Bench Press')).not.toThrow();
  });

  it('trims whitespace before validating', () => {
    expect(() => assertValidExerciseName('  Bench Press  ')).not.toThrow();
  });

  it('throws on an empty string', () => {
    expect(() => assertValidExerciseName('')).toThrow('exercise name required');
  });

  it('throws on whitespace-only', () => {
    expect(() => assertValidExerciseName('   ')).toThrow('exercise name required');
  });

  it('throws when the trimmed value exceeds 120 characters', () => {
    expect(() => assertValidExerciseName('a'.repeat(121))).toThrow('exercise name too long');
  });
});

describe('assertValidKcalPerHour', () => {
  it('accepts zero', () => {
    expect(() => assertValidKcalPerHour(0)).not.toThrow();
  });

  it('accepts positive values', () => {
    expect(() => assertValidKcalPerHour(420)).not.toThrow();
  });

  it('throws on negatives', () => {
    expect(() => assertValidKcalPerHour(-1)).toThrow();
  });

  it('throws on NaN', () => {
    expect(() => assertValidKcalPerHour(Number.NaN)).toThrow();
  });

  it('throws on Infinity', () => {
    expect(() => assertValidKcalPerHour(Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe('assertValidReps', () => {
  it('accepts zero and positive integers', () => {
    expect(() => assertValidReps(0)).not.toThrow();
    expect(() => assertValidReps(12)).not.toThrow();
  });

  it('accepts fractional reps', () => {
    expect(() => assertValidReps(0.5)).not.toThrow();
  });

  it('throws on negatives', () => {
    expect(() => assertValidReps(-1)).toThrow();
  });

  it('throws on NaN', () => {
    expect(() => assertValidReps(Number.NaN)).toThrow();
  });

  it('throws on Infinity', () => {
    expect(() => assertValidReps(Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe('assertValidWeightKg', () => {
  it('accepts null and undefined (optional weight)', () => {
    expect(() => assertValidWeightKg(null)).not.toThrow();
    expect(() => assertValidWeightKg(undefined)).not.toThrow();
  });

  it('accepts zero and positive weights', () => {
    expect(() => assertValidWeightKg(0)).not.toThrow();
    expect(() => assertValidWeightKg(70)).not.toThrow();
  });

  it('throws on negatives', () => {
    expect(() => assertValidWeightKg(-1)).toThrow();
  });

  it('throws on NaN', () => {
    expect(() => assertValidWeightKg(Number.NaN)).toThrow();
  });

  it('throws on Infinity', () => {
    expect(() => assertValidWeightKg(Number.POSITIVE_INFINITY)).toThrow();
  });
});
