import { describe, expect, it } from 'vitest';
import { OFFICIAL_AEROBIC_EXERCISES, OFFICIAL_STRENGTH_EXERCISES, applySeed } from 'src/seed';
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

describe('OFFICIAL_AEROBIC_EXERCISES — structural integrity', () => {
  it('has exactly the 9 expected entries', () => {
    expect(OFFICIAL_AEROBIC_EXERCISES.length).toBe(9);
  });

  it('is sorted alphabetically by id', () => {
    const ids = OFFICIAL_AEROBIC_EXERCISES.map((entry) => entry.exercise.id);
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it('every entry has all 8 locale translations (no missing keys)', () => {
    for (const entry of OFFICIAL_AEROBIC_EXERCISES) {
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
    for (const entry of OFFICIAL_AEROBIC_EXERCISES) {
      const id = entry.exercise.id;
      expect(id).toMatch(/^exercise:[a-z0-9_]+$/);
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
  });

  it('every entry has kind="aerobic", muscleGroup=null, hasDuration=true, hasRepetitions=false', () => {
    for (const entry of OFFICIAL_AEROBIC_EXERCISES) {
      const ex = entry.exercise;
      expect(ex.kind).toBe('aerobic');
      expect(ex.muscleGroup).toBeNull();
      expect(ex.hasDuration).toBe(true);
      expect(ex.hasRepetitions).toBe(false);
    }
  });

  it('every entry has origin="official" and notes=null', () => {
    for (const entry of OFFICIAL_AEROBIC_EXERCISES) {
      expect(entry.exercise.origin).toBe('official');
      expect(entry.exercise.notes).toBeNull();
    }
  });

  it('defaultUnit is one of the four allowed values', () => {
    for (const entry of OFFICIAL_AEROBIC_EXERCISES) {
      expect(VALID_DEFAULT_UNITS).toContain(entry.exercise.defaultUnit);
    }
  });

  it('every meta.kcalPerHour is a positive finite number', () => {
    for (const entry of OFFICIAL_AEROBIC_EXERCISES) {
      const k = entry.meta.kcalPerHour;
      expect(typeof k).toBe('number');
      expect(Number.isFinite(k)).toBe(true);
      expect(k).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Sanity check on the strength catalog — same locale / id format rules, but
// distinct kind-specific constraints (hasRepetitions, muscleGroup validity).
// ---------------------------------------------------------------------------

describe('OFFICIAL_STRENGTH_EXERCISES — structural integrity', () => {
  it('has at least 25 entries', () => {
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
});

describe('aerobic + strength catalogs — cross-checks', () => {
  it('no id appears in both catalogs', () => {
    const aIds = new Set(OFFICIAL_AEROBIC_EXERCISES.map((e) => e.exercise.id));
    for (const s of OFFICIAL_STRENGTH_EXERCISES) {
      expect(aIds.has(s.exercise.id)).toBe(false);
    }
  });

  it('every expected id is present in OFFICIAL_AEROBIC_EXERCISES', () => {
    const ids = new Set(OFFICIAL_AEROBIC_EXERCISES.map((e) => e.exercise.id));
    const expected = [
      'exercise:walking',
      'exercise:running',
      'exercise:cycling',
      'exercise:stationary_bike',
      'exercise:elliptical',
      'exercise:stair_climber',
      'exercise:rowing',
      'exercise:swimming',
      'exercise:jump_rope',
    ];
    for (const id of expected) {
      expect(ids.has(id)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Light-weight integration test: drive `applySeed` against an in-memory
// fake DbConnection that honours only the SQL patterns the seed issues
// (INSERT OR IGNORE with positional `?` parameters). This is enough to
// catch refactors that change column order or lose a row class.
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

  /** Per-table primary-key columns used to detect duplicate `INSERT OR IGNORE` rows. */
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

describe('applySeed (fake connection integration) — exercise tables', () => {
  it('inserts every aerobic + strength exercise + per-locale translation + aerobic meta', async () => {
    const conn = new FakeSeedConnection();
    await applySeed(conn);

    expect(conn.tables['exercise']!.length).toBe(
      OFFICIAL_AEROBIC_EXERCISES.length + OFFICIAL_STRENGTH_EXERCISES.length,
    );
    expect(conn.tables['exercise_translation']!.length).toBe(
      (OFFICIAL_AEROBIC_EXERCISES.length + OFFICIAL_STRENGTH_EXERCISES.length) * ALL_LOCALES.length,
    );
    // Only aerobic exercises get an exercise_aerobic_meta row.
    expect(conn.tables['exercise_aerobic_meta']!.length).toBe(OFFICIAL_AEROBIC_EXERCISES.length);
  });

  it('is idempotent — calling it twice produces no extra rows', async () => {
    const conn = new FakeSeedConnection();
    await applySeed(conn);
    await applySeed(conn);

    expect(conn.tables['exercise']!.length).toBe(
      OFFICIAL_AEROBIC_EXERCISES.length + OFFICIAL_STRENGTH_EXERCISES.length,
    );
    expect(conn.tables['exercise_translation']!.length).toBe(
      (OFFICIAL_AEROBIC_EXERCISES.length + OFFICIAL_STRENGTH_EXERCISES.length) * ALL_LOCALES.length,
    );
    expect(conn.tables['exercise_aerobic_meta']!.length).toBe(OFFICIAL_AEROBIC_EXERCISES.length);
  });

  it('persists has_repetitions / has_duration as INTEGER (0/1)', async () => {
    const conn = new FakeSeedConnection();
    await applySeed(conn);
    for (const row of conn.tables['exercise']!) {
      expect([0, 1]).toContain(row['has_repetitions']);
      expect([0, 1]).toContain(row['has_duration']);
    }
  });

  it('aerobic rows have kind=aerobic, muscle_group=null, has_duration=1, has_repetitions=0', async () => {
    const conn = new FakeSeedConnection();
    await applySeed(conn);
    const aerobicIds = new Set(OFFICIAL_AEROBIC_EXERCISES.map((e) => e.exercise.id));
    const rows = conn.tables['exercise']!.filter((r) => aerobicIds.has(r['id'] as string));
    expect(rows.length).toBe(OFFICIAL_AEROBIC_EXERCISES.length);
    for (const row of rows) {
      expect(row['kind']).toBe('aerobic');
      expect(row['muscle_group']).toBeNull();
      expect(row['has_duration']).toBe(1);
      expect(row['has_repetitions']).toBe(0);
    }
  });

  it('strength rows have kind=strength, has_repetitions=1, has_duration=0', async () => {
    const conn = new FakeSeedConnection();
    await applySeed(conn);
    const strengthIds = new Set(OFFICIAL_STRENGTH_EXERCISES.map((e) => e.exercise.id));
    const rows = conn.tables['exercise']!.filter((r) => strengthIds.has(r['id'] as string));
    expect(rows.length).toBe(OFFICIAL_STRENGTH_EXERCISES.length);
    for (const row of rows) {
      expect(row['kind']).toBe('strength');
      expect(row['has_repetitions']).toBe(1);
      expect(row['has_duration']).toBe(0);
    }
  });

  it('stores the search column as the normalized name', async () => {
    const conn = new FakeSeedConnection();
    await applySeed(conn);
    const en = OFFICIAL_AEROBIC_EXERCISES[0]!;
    const id = en.exercise.id;
    const row = conn.tables['exercise_translation']!.find(
      (r) => r['exercise_id'] === id && r['locale'] === 'en',
    );
    expect(row).toBeDefined();
    const name = en.translations.en;
    const expected = name
      .toLowerCase()
      .normalize('NFKC')
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
    expect(row!['search']).toBe(expected);
  });
});
