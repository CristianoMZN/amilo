import { describe, expect, it } from 'vitest';
import {
  compareReps,
  compareVolume,
  compareWeight,
  pickTopSetForComparison,
  progressionSummary,
} from 'src/domain/progression';
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

describe('compareReps', () => {
  it('returns 0 when both sides have the same reps', () => {
    expect(compareReps({ reps: 10 }, { reps: 10 })).toBe(0);
  });

  it('returns the delta when current has more reps', () => {
    expect(compareReps({ reps: 8 }, { reps: 10 })).toBe(2);
  });

  it('treats null previous as 0', () => {
    expect(compareReps(null, { reps: 10 })).toBe(10);
  });

  it('returns negative when current has fewer reps', () => {
    expect(compareReps({ reps: 12 }, { reps: 10 })).toBe(-2);
  });
});

describe('compareWeight', () => {
  it('returns the kg delta when both sides have a weight', () => {
    expect(compareWeight({ weightKg: 70 }, { weightKg: 72.5 })).toBe(2.5);
    expect(compareWeight({ weightKg: 72.5 }, { weightKg: 70 })).toBe(-2.5);
  });

  it('treats null previous as 0', () => {
    expect(compareWeight(null, { weightKg: 80 })).toBe(80);
  });

  it('treats both null weights as 0-0 = 0', () => {
    expect(compareWeight(null, { weightKg: null })).toBe(0);
    expect(compareWeight({ weightKg: null }, { weightKg: null })).toBe(0);
  });

  it('subtracts 0 when only current has a weight', () => {
    expect(compareWeight({ weightKg: null }, { weightKg: 60 })).toBe(60);
  });
});

describe('compareVolume', () => {
  it('returns the kg-volume delta across sets', () => {
    const prev = [makeSet({ reps: 10, weightKg: 70 })];
    const curr = [makeSet({ reps: 10, weightKg: 72.5 })];
    // 10*72.5 - 10*70 = 725 - 700 = 25
    expect(compareVolume(prev, curr)).toBe(25);
  });

  it('treats null previous as 0 volume', () => {
    const curr = [makeSet({ reps: 10, weightKg: 70 })];
    expect(compareVolume(null, curr)).toBe(700);
  });

  it('sums across multiple sets on each side', () => {
    const prev = [
      makeSet({ reps: 10, weightKg: 70 }),
      makeSet({ reps: 8, weightKg: 70 }),
    ];
    const curr = [
      makeSet({ reps: 10, weightKg: 72.5 }),
      makeSet({ reps: 8, weightKg: 72.5 }),
    ];
    // prev total: 10*70 + 8*70 = 700 + 560 = 1260
    // curr total: 10*72.5 + 8*72.5 = 725 + 580 = 1305
    // delta = 1305 - 1260 = 45
    expect(compareVolume(prev, curr)).toBe(45);
  });
});

describe('pickTopSetForComparison', () => {
  it('prefers the set with the highest weight', () => {
    const sets = [
      makeSet({ id: 1, weightKg: 70, reps: 10 }),
      makeSet({ id: 2, weightKg: 80, reps: 1 }),
    ];
    expect(pickTopSetForComparison(sets)?.weightKg).toBe(80);
  });

  it('breaks weight ties by most reps', () => {
    const sets = [
      makeSet({ id: 1, weightKg: 70, reps: 5 }),
      makeSet({ id: 2, weightKg: 70, reps: 8 }),
    ];
    const top = pickTopSetForComparison(sets);
    expect(top?.reps).toBe(8);
    expect(top?.weightKg).toBe(70);
  });

  it('returns null for an empty list', () => {
    expect(pickTopSetForComparison([])).toBeNull();
  });

  it('returns the first set when all weights are null', () => {
    const sets = [
      makeSet({ id: 1, weightKg: null, reps: 20 }),
      makeSet({ id: 2, weightKg: null, reps: 15 }),
    ];
    expect(pickTopSetForComparison(sets)?.reps).toBe(20);
  });
});

describe('progressionSummary', () => {
  it('returns all three deltas when both sides are populated', () => {
    const prevSets = [makeSet({ reps: 10, weightKg: 70 })];
    const currSets = [makeSet({ reps: 12, weightKg: 72.5 })];
    const sum = progressionSummary(null, prevSets, currSets);
    expect(sum.weightDeltaKg).toBe(2.5);
    expect(sum.repsDelta).toBe(2);
    expect(sum.volumeDeltaKg).toBe(12 * 72.5 - 10 * 70);
  });

  it('returns null deltas when no previous exercise exists', () => {
    const currSets = [makeSet({ reps: 10, weightKg: 70 })];
    const sum = progressionSummary(null, [], currSets);
    expect(sum.weightDeltaKg).toBeNull();
    expect(sum.repsDelta).toBeNull();
    expect(sum.volumeDeltaKg).toBe(700);
  });

  it('returns null volumeDelta when neither side has any weighted set', () => {
    const prevSets = [makeSet({ weightKg: null, reps: 10 })];
    const currSets = [makeSet({ weightKg: null, reps: 12 })];
    const sum = progressionSummary(null, prevSets, currSets);
    expect(sum.volumeDeltaKg).toBeNull();
    // reps delta still has a value because the top set exists.
    expect(sum.repsDelta).toBe(2);
  });

  it('returns null weightDelta when either side has no weighted top set', () => {
    const prevSets = [makeSet({ weightKg: null, reps: 10 })];
    const currSets = [makeSet({ weightKg: 70, reps: 5 })];
    const sum = progressionSummary(null, prevSets, currSets);
    expect(sum.weightDeltaKg).toBeNull();
    // reps actually went down from 10 → 5, so the delta is negative.
    expect(sum.repsDelta).toBe(-5);
    expect(sum.volumeDeltaKg).toBe(5 * 70);
  });
});
