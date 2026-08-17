import { describe, expect, it } from 'vitest';
import { OFFICIAL_STRENGTH_EXERCISES, applySeed } from 'src/seed';
import type { MuscleGroup, SupportedLocale } from 'src/domain/types';
import type { DbConnection } from 'src/database/connection';

const ALL_LOCALES: readonly SupportedLocale[] = ['en', 'es', 'pt-BR', 'de', 'fr', 'ja', 'ko', 'it'];

const VALID_MUSCLE_GROUPS: readonly MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'legs',
  'glutes',
  'calves',
  'core',
  'lower_back',
  'full_body',
  'other',
];

const VALID_DEFAULT_UNITS = ['kg', 'lb', 'bodyweight', 'none'] as const;

describe('OFFICIAL_STRENGTH_EXERCISES — structural integrity', () => {
  it('has at least 25 entries (gives the user a useful catalog)', () => {
    expect(OFFICIAL_STRENGTH_EXERCISES.length).toBeGreaterThanOrEqual(25);
  });

  it('is sorted alphabetically by id', () => {
    const ids = OFFICIAL_STRENGTH_EXERCISES.map((entry) => entry.exercise.id);
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it('every entry has all 8 locale translations (no missing keys)', () => {
    for (const entry of OFFICIAL_STRENGTH_EXERCISES) {
      const keys = Object.keys(entry.translations).sort();
      expect(keys).toEqual([...ALL_LOCALES].sort());
      for (const locale of ALL_LOCALES) {
        expect(typeof entry.translations[locale]).toBe('string');
        expect(entry.translations[locale].length).toBeGreaterThan(0);
      }
    }
  });

  it('ids are unique and match /^exercise:[a-z0-9_]+$/', () => {
    const seen = new Set<string>();
    for (const entry of OFFICIAL_STRENGTH_EXERCISES) {
      const id = entry.exercise.id;
      expect(id).toMatch(/^exercise:[a-z0-9_]+$/);
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
  });

  it('every entry has kind="strength", hasRepetitions=true, hasDuration=false', () => {
    for (const entry of OFFICIAL_STRENGTH_EXERCISES) {
      const ex = entry.exercise;
      expect(ex.kind).toBe('strength');
      expect(ex.hasRepetitions).toBe(true);
      expect(ex.hasDuration).toBe(false);
    }
  });

  it('every entry has origin="official" and notes=null', () => {
    for (const entry of OFFICIAL_STRENGTH_EXERCISES) {
      expect(entry.exercise.origin).toBe('official');
      expect(entry.exercise.notes).toBeNull();
    }
  });

  it('defaultUnit is one of the four allowed values', () => {
    for (const entry of OFFICIAL_STRENGTH_EXERCISES) {
      expect(VALID_DEFAULT_UNITS).toContain(entry.exercise.defaultUnit);
    }
  });

  it('muscleGroup is one of the 12 valid MuscleGroup values (non-null)', () => {
    for (const entry of OFFICIAL_STRENGTH_EXERCISES) {
      const mg = entry.exercise.muscleGroup;
      expect(mg).not.toBeNull();
      expect(VALID_MUSCLE_GROUPS).toContain(mg);
    }
  });

  it('default unit policy: only isometric/no-load reps use "none"', () => {
    const NO_LOAD_IDS = new Set([
      'exercise:plank',
      'exercise:side_plank',
      'exercise:russian_twist',
      'exercise:hanging_leg_raise',
    ]);
    for (const entry of OFFICIAL_STRENGTH_EXERCISES) {
      const id = entry.exercise.id;
      if (entry.exercise.defaultUnit === 'none') {
        expect(NO_LOAD_IDS.has(id)).toBe(true);
      }
    }
  });

  it('every muscle group is represented at least once (catalog coverage)', () => {
    const seenGroups = new Set<MuscleGroup>();
    for (const entry of OFFICIAL_STRENGTH_EXERCISES) {
      const mg = entry.exercise.muscleGroup;
      if (mg !== null) seenGroups.add(mg);
    }
    // Expected coverage: at least the 9 main group buckets from the spec.
    const required: readonly MuscleGroup[] = [
      'chest',
      'back',
      'shoulders',
      'biceps',
      'triceps',
      'legs',
      'core',
      'lower_back',
      'full_body',
    ];
    for (const mg of required) {
      expect(seenGroups.has(mg)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Light-weight integration test focused on the strength catalog.
// Mirrors the FakeSeedConnection pattern used in officialFoods.test.ts;
// exercises are asserted independently of aerobic results.
// ---------------------------------------------------------------------------

interface FakeRow {
  [key: string]: unknown;
}

class FakeSeedConnection implements DbConnection {
  public readonly tables: Record<string, FakeRow[]> = {
    food: [],
    food_translation: [],
    meal_type: [],
    meal_type_translation: [],
    exercise: [],
    exercise_translation: [],
    exercise_aerobic_meta: [],
  };

  private static readonly PRIMARY_KEYS: Readonly<Record<string, readonly string[]>> = {
    food: ['id'],
    food_translation: ['food_id', 'locale'],
    meal_type: ['id'],
    meal_type_translation: ['meal_type_id', 'locale'],
    exercise: ['id'],
    exercise_translation: ['exercise_id', 'locale'],
    exercise_aerobic_meta: ['exercise_id'],
  };

  open(): Promise<void> {
    return Promise.resolve();
  }

  close(): Promise<void> {
    return Promise.resolve();
  }

  isNative(): boolean {
    return false;
  }

  getDb(): Promise<unknown> {
    const tables = this.tables;
    return Promise.resolve({
      execute: (sql: string, values: unknown[] = []) => {
        const trimmed = sql.trim();
        const upper = trimmed.toUpperCase();
        if (!upper.startsWith('INSERT')) {
          return Promise.resolve({ changes: { changes: 0 }, rows: [] });
        }
        const match = /\bINSERT\s+OR\s+IGNORE\s+INTO\s+(\w+)\s*\(([^)]+)\)/i.exec(sql);
        if (!match) return Promise.resolve({ changes: { changes: 0 }, rows: [] });
        const table = (match[1] ?? '').toLowerCase();
        const cols = (match[2] ?? '').split(',').map((c) => c.trim());
        const list = tables[table];
        if (!list) return Promise.resolve({ changes: { changes: 0 }, rows: [] });
        const row: FakeRow = {};
        cols.forEach((col, i) => {
          row[col] = values[i];
        });
        const pkCols = FakeSeedConnection.PRIMARY_KEYS[table] ?? [cols[0] ?? ''];
        const exists = list.some((existing) => pkCols.every((col) => existing[col] === row[col]));
        if (exists) return Promise.resolve({ changes: { changes: 0 }, rows: [] });
        list.push(row);
        return Promise.resolve({ changes: { changes: 1 }, rows: [] });
      },
      query: () => Promise.resolve({ values: [] }),
    });
  }
}

describe('applySeed (fake connection integration) — strength exercises', () => {
  it('inserts every strength exercise and a per-locale translation for each', async () => {
    const conn = new FakeSeedConnection();
    await applySeed(conn);

    const strengthIds = new Set(OFFICIAL_STRENGTH_EXERCISES.map((e) => e.exercise.id));
    const exerciseRows = conn.tables['exercise']!.filter((r) => strengthIds.has(r['id'] as string));
    expect(exerciseRows.length).toBe(OFFICIAL_STRENGTH_EXERCISES.length);

    const translationRows = conn.tables['exercise_translation']!.filter((r) =>
      strengthIds.has(r['exercise_id'] as string),
    );
    expect(translationRows.length).toBe(OFFICIAL_STRENGTH_EXERCISES.length * ALL_LOCALES.length);
  });

  it('does NOT write exercise_aerobic_meta rows for strength exercises', async () => {
    const conn = new FakeSeedConnection();
    await applySeed(conn);

    const strengthIds = new Set(OFFICIAL_STRENGTH_EXERCISES.map((e) => e.exercise.id));
    const metaRows = conn.tables['exercise_aerobic_meta']!.filter((r) =>
      strengthIds.has(r['exercise_id'] as string),
    );
    expect(metaRows.length).toBe(0);
  });

  it('strength rows have kind=strength, muscle_group NOT null, has_repetitions=1, has_duration=0', async () => {
    const conn = new FakeSeedConnection();
    await applySeed(conn);
    const strengthIds = new Set(OFFICIAL_STRENGTH_EXERCISES.map((e) => e.exercise.id));
    const rows = conn.tables['exercise']!.filter((r) => strengthIds.has(r['id'] as string));
    expect(rows.length).toBe(OFFICIAL_STRENGTH_EXERCISES.length);
    for (const row of rows) {
      expect(row['kind']).toBe('strength');
      expect(row['muscle_group']).not.toBeNull();
      expect(row['has_repetitions']).toBe(1);
      expect(row['has_duration']).toBe(0);
    }
  });

  it('is idempotent — calling applySeed twice produces no extra strength rows', async () => {
    const conn = new FakeSeedConnection();
    await applySeed(conn);
    await applySeed(conn);

    const strengthIds = new Set(OFFICIAL_STRENGTH_EXERCISES.map((e) => e.exercise.id));
    const exerciseRows = conn.tables['exercise']!.filter((r) => strengthIds.has(r['id'] as string));
    const translationRows = conn.tables['exercise_translation']!.filter((r) =>
      strengthIds.has(r['exercise_id'] as string),
    );
    expect(exerciseRows.length).toBe(OFFICIAL_STRENGTH_EXERCISES.length);
    expect(translationRows.length).toBe(OFFICIAL_STRENGTH_EXERCISES.length * ALL_LOCALES.length);
  });
});
