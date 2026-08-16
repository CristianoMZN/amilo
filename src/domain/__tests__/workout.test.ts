import { describe, expect, it } from 'vitest';
import {
  assignConsecutivePositions,
  assertValidSessionName,
  assertValidSheetName,
  reorderByPosition,
  snapshotForPerformedExercise,
  snapshotForPerformedWorkout,
  snapshotForPlannedExercise,
} from 'src/domain/workout';

describe('assertValidSheetName', () => {
  it('accepts a normal name', () => {
    expect(() => assertValidSheetName('Push / Pull / Legs')).not.toThrow();
  });

  it('trims whitespace before validating', () => {
    expect(() => assertValidSheetName('  PPL  ')).not.toThrow();
  });

  it('accepts a single character', () => {
    expect(() => assertValidSheetName('A')).not.toThrow();
  });

  it('throws on an empty string', () => {
    expect(() => assertValidSheetName('')).toThrow('sheet name required');
  });

  it('throws on whitespace-only', () => {
    expect(() => assertValidSheetName('   ')).toThrow('sheet name required');
  });
});

describe('assertValidSessionName', () => {
  it('accepts a normal name', () => {
    expect(() => assertValidSessionName('Peito + tríceps')).not.toThrow();
  });

  it('accepts a single character', () => {
    expect(() => assertValidSessionName('A')).not.toThrow();
  });

  it('throws on an empty string', () => {
    expect(() => assertValidSessionName('')).toThrow('session name required');
  });

  it('throws on whitespace-only', () => {
    expect(() => assertValidSessionName('   ')).toThrow('session name required');
  });
});

describe('reorderByPosition', () => {
  it('sorts items by position ascending', () => {
    const items = [
      { id: 1, position: 2 },
      { id: 2, position: 0 },
      { id: 3, position: 1 },
    ];
    expect(reorderByPosition(items).map((i) => i.id)).toEqual([2, 3, 1]);
  });

  it('is stable on ties (preserves input order)', () => {
    const items = [
      { id: 1, position: 0 },
      { id: 2, position: 0 },
      { id: 3, position: 1 },
    ];
    expect(reorderByPosition(items).map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it('returns an empty array for an empty input', () => {
    expect(reorderByPosition([])).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const items = [
      { id: 1, position: 2 },
      { id: 2, position: 0 },
    ];
    const before = items.map((i) => i.id);
    reorderByPosition(items);
    expect(items.map((i) => i.id)).toEqual(before);
  });
});

describe('assignConsecutivePositions', () => {
  it('resets positions to 0..N-1', () => {
    const items = [
      { id: 1, position: 9 },
      { id: 2, position: 4 },
      { id: 3, position: 0 },
    ];
    const result = assignConsecutivePositions(items);
    expect(result.map((i) => i.position)).toEqual([0, 1, 2]);
    expect(result.map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it('returns an empty array for an empty input', () => {
    expect(assignConsecutivePositions([])).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const items = [{ id: 1, position: 5 }];
    assignConsecutivePositions(items);
    expect(items[0]?.position).toBe(5);
  });
});

describe('snapshotForPlannedExercise', () => {
  it('returns the name and muscle group snapshot bundle', () => {
    const snap = snapshotForPlannedExercise({
      exerciseId: 'exercise:bench_press',
      name: 'Supino Reto',
      muscleGroup: 'chest',
      plannedSets: 4,
      plannedReps: 8,
      plannedWeightKg: 80,
      notes: null,
    });
    expect(snap.exerciseNameSnapshot).toBe('Supino Reto');
    expect(snap.muscleGroupSnapshot).toBe('chest');
  });

  it('preserves a null muscle group', () => {
    const snap = snapshotForPlannedExercise({
      exerciseId: null,
      name: 'Cardio Livre',
      muscleGroup: null,
      plannedSets: 1,
      plannedReps: 0,
      plannedWeightKg: null,
      notes: 'esteira',
    });
    expect(snap.muscleGroupSnapshot).toBeNull();
  });
});

describe('snapshotForPerformedWorkout', () => {
  it('returns the sheet and session name snapshot bundle', () => {
    const snap = snapshotForPerformedWorkout({
      sheetId: 1,
      sessionId: 2,
      sheetName: 'PPL',
      sessionName: 'Push',
      startedAt: '2026-01-01T00:00:00Z',
    });
    expect(snap.sheetNameSnapshot).toBe('PPL');
    expect(snap.sessionNameSnapshot).toBe('Push');
  });
});

describe('snapshotForPerformedExercise', () => {
  it('returns the name and muscle group snapshot bundle', () => {
    const snap = snapshotForPerformedExercise({
      exerciseId: 'exercise:squat',
      name: 'Agachamento Livre',
      muscleGroup: 'legs',
    });
    expect(snap.exerciseNameSnapshot).toBe('Agachamento Livre');
    expect(snap.muscleGroupSnapshot).toBe('legs');
  });
});
