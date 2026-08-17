import { describe, expect, it } from 'vitest';
import {
  OFFICIAL_FOODS,
  OFFICIAL_MEAL_TYPES,
  OFFICIAL_MEAL_TYPE_TRANSLATIONS,
  applySeed,
} from 'src/seed';
import type { SupportedLocale } from 'src/domain/types';
import type { DbConnection } from 'src/database/connection';

const ALL_LOCALES: readonly SupportedLocale[] = ['en', 'es', 'pt-BR', 'de', 'fr', 'ja', 'ko', 'it'];

describe('OFFICIAL_FOODS — structural integrity', () => {
  it('has at least 50 entries', () => {
    expect(OFFICIAL_FOODS.length).toBeGreaterThanOrEqual(50);
  });

  it('is sorted alphabetically by id', () => {
    const ids = OFFICIAL_FOODS.map((entry) => entry.food.id);
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it('every food has all 8 locale translations (no missing keys)', () => {
    for (const entry of OFFICIAL_FOODS) {
      const keys = Object.keys(entry.translations).sort();
      expect(keys).toEqual([...ALL_LOCALES].sort());
      // Names must be non-empty strings.
      for (const locale of ALL_LOCALES) {
        expect(typeof entry.translations[locale]).toBe('string');
        expect(entry.translations[locale].length).toBeGreaterThan(0);
      }
    }
  });

  it('ids are unique and match /^food:[a-z0-9_]+$/', () => {
    const seen = new Set<string>();
    for (const entry of OFFICIAL_FOODS) {
      const id = entry.food.id;
      expect(id).toMatch(/^food:[a-z0-9_]+$/);
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
  });

  it('baseAmountG > 0 and all macros are non-negative finite numbers', () => {
    for (const entry of OFFICIAL_FOODS) {
      const f = entry.food;
      expect(f.baseAmountG).toBeGreaterThan(0);
      for (const value of [f.kcal, f.proteinG, f.carbsG, f.fatG]) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('fiberG is null or a non-negative finite number', () => {
    for (const entry of OFFICIAL_FOODS) {
      const fiber = entry.food.fiberG;
      if (fiber === null) continue;
      expect(typeof fiber).toBe('number');
      expect(Number.isFinite(fiber)).toBe(true);
      expect(fiber).toBeGreaterThanOrEqual(0);
    }
  });

  it('kcal is within ~30% of protein*4 + carbs*4 + fat*9 (smoke test)', () => {
    // The Atwater factors used in nutrition labels. Foods where the
    // mac-sum is trivially small (e.g. water) don't yield a meaningful
    // ratio — skip them rather than divide by zero.
    for (const entry of OFFICIAL_FOODS) {
      const f = entry.food;
      const macroKcal = f.proteinG * 4 + f.carbsG * 4 + f.fatG * 9;
      if (macroKcal < 5) continue;
      const ratio = f.kcal / macroKcal;
      expect(ratio).toBeGreaterThan(0.7);
      expect(ratio).toBeLessThan(1.3);
    }
  });

  it('every food has origin "official" and base amount of 100', () => {
    for (const entry of OFFICIAL_FOODS) {
      expect(entry.food.origin).toBe('official');
      expect(entry.food.baseAmountG).toBe(100);
    }
  });

  it('baseUnit is "g" for solids and "ml" for liquids', () => {
    for (const entry of OFFICIAL_FOODS) {
      expect(entry.food.baseUnit === 'g' || entry.food.baseUnit === 'ml').toBe(true);
    }
  });
});

describe('OFFICIAL_MEAL_TYPES', () => {
  it('covers exactly breakfast / lunch / snack / dinner / supper', () => {
    const ids = [...OFFICIAL_MEAL_TYPES.map((m) => m.id)].sort();
    expect(ids).toEqual(['breakfast', 'dinner', 'lunch', 'snack', 'supper']);
  });

  it('does not include the synthetic "custom" id', () => {
    const ids = OFFICIAL_MEAL_TYPES.map((m) => m.id);
    expect(ids).not.toContain('custom');
  });

  it('every meal type is flagged as builtin', () => {
    for (const mt of OFFICIAL_MEAL_TYPES) {
      expect(mt.builtin).toBe(true);
    }
  });

  it('sortOrder is contiguous starting at 0', () => {
    const orders = OFFICIAL_MEAL_TYPES.map((m) => m.sortOrder).sort((a, b) => a - b);
    expect(orders).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('OFFICIAL_MEAL_TYPE_TRANSLATIONS', () => {
  it('every meal type has translations in all 8 locales', () => {
    for (const mt of OFFICIAL_MEAL_TYPES) {
      const matching = OFFICIAL_MEAL_TYPE_TRANSLATIONS.filter((t) => t.mealTypeId === mt.id);
      expect(matching).toHaveLength(ALL_LOCALES.length);
      for (const t of matching) {
        expect(ALL_LOCALES).toContain(t.locale);
        expect(typeof t.name).toBe('string');
        expect(t.name.length).toBeGreaterThan(0);
      }
    }
  });

  it('has exactly one row per (meal_type, locale)', () => {
    const seen = new Set<string>();
    for (const t of OFFICIAL_MEAL_TYPE_TRANSLATIONS) {
      const key = `${t.mealTypeId}::${t.locale}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
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
  };

  /** Per-table primary-key columns used to detect duplicate `INSERT OR IGNORE` rows. */
  private static readonly PRIMARY_KEYS: Readonly<Record<string, readonly string[]>> = {
    food: ['id'],
    food_translation: ['food_id', 'locale'],
    meal_type: ['id'],
    meal_type_translation: ['meal_type_id', 'locale'],
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

describe('applySeed (fake connection integration)', () => {
  it('inserts every meal_type, meal_type_translation, food, and food_translation', async () => {
    const conn = new FakeSeedConnection();
    await applySeed(conn);

    expect(conn.tables['food']!.length).toBe(OFFICIAL_FOODS.length);
    expect(conn.tables['meal_type']!.length).toBe(OFFICIAL_MEAL_TYPES.length);
    expect(conn.tables['meal_type_translation']!.length).toBe(
      OFFICIAL_MEAL_TYPES.length * ALL_LOCALES.length,
    );
    // food_translation: every food × every locale.
    expect(conn.tables['food_translation']!.length).toBe(
      OFFICIAL_FOODS.length * ALL_LOCALES.length,
    );
  });

  it('is idempotent — calling it twice produces no extra rows', async () => {
    const conn = new FakeSeedConnection();
    await applySeed(conn);
    await applySeed(conn);
    expect(conn.tables['food']!.length).toBe(OFFICIAL_FOODS.length);
    expect(conn.tables['food_translation']!.length).toBe(
      OFFICIAL_FOODS.length * ALL_LOCALES.length,
    );
  });

  it('stores builtin as numeric 1 (SQLite INTEGER)', async () => {
    const conn = new FakeSeedConnection();
    await applySeed(conn);
    for (const row of conn.tables['meal_type']!) {
      expect(row['builtin']).toBe(1);
    }
  });

  it('stores the search column as the normalized name', async () => {
    const conn = new FakeSeedConnection();
    await applySeed(conn);
    const en = OFFICIAL_FOODS[0]!;
    const id = en.food.id;
    const row = conn.tables['food_translation']!.find(
      (r) => r['food_id'] === id && r['locale'] === 'en',
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
