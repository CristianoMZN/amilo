import { describe, expect, it } from 'vitest';
import {
  bestSetByRepsAtWeight,
  bestSetByVolume,
  bestSetByWeight,
  exerciseVolumeKg,
  setVolumeKg,
} from 'src/domain/volume';
import type { PerformedWorkoutSet } from 'src/domain/types';

function makeSet(overrides: Partial<PerformedWorkoutSet>): PerformedWorkoutSet {
  return {
    id: 1,
    performedExerciseId: 1,
    position: 0,
    reps: 10,
    weightKg: 70,
    completed: true,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('setVolumeKg', () => {
  it('multiplies reps by weight when weight is present', () => {
    expect(setVolumeKg(10, 70)).toBe(700);
    expect(setVolumeKg(8, 100)).toBe(800);
  });

  it('returns 0 when weight is null (bodyweight)', () => {
    expect(setVolumeKg(10, null)).toBe(0);
    expect(setVolumeKg(20, null)).toBe(0);
  });
});

describe('exerciseVolumeKg', () => {
  it('sums reps * weight across sets', () => {
    const sets = [
      { reps: 10, weightKg: 70 },
      { reps: 8, weightKg: 70 },
    ];
    // 10*70 + 8*70 = 700 + 560 = 1260 (sets are weighted individually, not aggregated first).
    expect(exerciseVolumeKg(sets)).toBe(1260);
  });

  it('treats null weights as 0', () => {
    const sets = [
      { reps: 10, weightKg: 70 },
      { reps: 15, weightKg: null },
      { reps: 8, weightKg: 60 },
    ];
    // 700 + 0 + 480 = 1180
    expect(exerciseVolumeKg(sets)).toBe(1180);
  });

  it('returns 0 for an empty list', () => {
    expect(exerciseVolumeKg([])).toBe(0);
  });
});

describe('bestSetByWeight', () => {
  it('returns the set with the highest non-null weight', () => {
    const sets = [
      makeSet({ id: 1, weightKg: 70, reps: 10 }),
      makeSet({ id: 2, weightKg: 80, reps: 5 }),
      makeSet({ id: 3, weightKg: 75, reps: 8 }),
    ];
    const best = bestSetByWeight(sets);
    expect(best?.id).toBe(2);
    expect(best?.weightKg).toBe(80);
  });

  it('ignores sets with null weight', () => {
    const sets = [
      makeSet({ id: 1, weightKg: null, reps: 20 }),
      makeSet({ id: 2, weightKg: 70, reps: 10 }),
    ];
    const best = bestSetByWeight(sets);
    expect(best?.id).toBe(2);
  });

  it('returns null when no set has a weight', () => {
    const sets = [makeSet({ id: 1, weightKg: null }), makeSet({ id: 2, weightKg: null })];
    expect(bestSetByWeight(sets)).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(bestSetByWeight([])).toBeNull();
  });
});

describe('bestSetByVolume', () => {
  it('returns the set with the highest reps * weightKg', () => {
    const sets = [
      makeSet({ id: 1, weightKg: 70, reps: 10 }), // 700
      makeSet({ id: 2, weightKg: 100, reps: 8 }), // 800
      makeSet({ id: 3, weightKg: 60, reps: 12 }), // 720
    ];
    const best = bestSetByVolume(sets);
    expect(best?.id).toBe(2);
  });

  it('ignores bodyweight sets even when their reps are huge', () => {
    const sets = [
      makeSet({ id: 1, weightKg: null, reps: 100 }),
      makeSet({ id: 2, weightKg: 70, reps: 5 }),
    ];
    const best = bestSetByVolume(sets);
    expect(best?.id).toBe(2);
  });

  it('returns null when no set has a weight', () => {
    expect(bestSetByVolume([makeSet({ weightKg: null })])).toBeNull();
  });
});

describe('bestSetByRepsAtWeight', () => {
  it('returns the set with the most reps at the exact weight', () => {
    const sets = [
      makeSet({ id: 1, weightKg: 70, reps: 10 }),
      makeSet({ id: 2, weightKg: 70, reps: 12 }),
      makeSet({ id: 3, weightKg: 80, reps: 5 }),
    ];
    const best = bestSetByRepsAtWeight(sets, 70);
    expect(best?.id).toBe(2);
    expect(best?.reps).toBe(12);
  });

  it('matches weights after rounding to 0.01 kg (float drift)', () => {
    // 70.0000000001 should match the lookup target 70.
    const sets = [makeSet({ id: 1, weightKg: 70.0000000001, reps: 10 })];
    expect(bestSetByRepsAtWeight(sets, 70)?.id).toBe(1);
  });

  it('does not match a different weight', () => {
    const sets = [makeSet({ id: 1, weightKg: 72.5, reps: 10 })];
    expect(bestSetByRepsAtWeight(sets, 70)).toBeNull();
  });

  it('ignores bodyweight sets', () => {
    const sets = [makeSet({ id: 1, weightKg: null, reps: 20 })];
    expect(bestSetByRepsAtWeight(sets, 0)).toBeNull();
  });
});
