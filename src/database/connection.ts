/**
 * SQLite connection wrapper.
 *
 * The Capacitor SQLite plugin only works on a native device (Android/iOS).
 * In `quasar dev` (browser) we expose an in-memory dev stub so the app can
 * still be navigated end-to-end during local development. The dev stub is
 * *clearly* isolated and never expected to persist between page reloads —
 * the real persistence only happens on Android.
 *
 * The dev stub is intentionally a thin shim: it knows the column order for
 * every table so positional `?` parameters map cleanly to rows, and it
 * supports `WHERE id = ?` for targeted UPDATEs / DELETEs (with cascade
 * semantics for foreign-key-enabled tables).
 */

import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
} from '@capacitor-community/sqlite';

export interface DbConnection {
  /** Resolves when the connection is open and migrations are applied. */
  open(): Promise<void>;
  /** Releases the underlying native resources. */
  close(): Promise<void>;
  /** Returns true if we are talking to the on-device SQLite engine. */
  isNative(): boolean;
  /** Internal native handle, exposed for repositories. */
  getDb(): Promise<unknown>;
}

const DB_NAME = 'amilio';

/**
 * Per-table column order — used by the dev stub to translate positional
 * `?` parameters into named fields. The repositories already use placeholder
 * order matching the DDL, so this table keeps the dev stub in sync without
 * SQL parsing.
 */
const STUB_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  user_profile: [
    'id',
    'name',
    'birth_date',
    'sex',
    'height_cm',
    'weight_kg',
    'activity',
    'goal',
    'created_at',
    'updated_at',
  ],
  user_preferences: [
    'id',
    'locale',
    'measurement_system',
    'theme',
    'onboarding_completed_at',
    'updated_at',
  ],
  weight_entry: ['id', 'weight_kg', 'recorded_at', 'source'],

  food: [
    'id',
    'origin',
    'base_amount_g',
    'base_unit',
    'kcal',
    'protein_g',
    'carbs_g',
    'fat_g',
    'fiber_g',
    'created_at',
    'updated_at',
  ],
  food_translation: ['food_id', 'locale', 'name', 'search'],
  food_favorite: ['food_id', 'created_at'],

  meal_type: ['id', 'sort_order', 'builtin'],
  meal_type_translation: ['meal_type_id', 'locale', 'name'],

  meal: [
    'id',
    'ref_date',
    'meal_type_id',
    'custom_name',
    'position',
    'created_at',
  ],
  meal_item: [
    'id',
    'meal_id',
    'position',
    'food_id',
    'food_name_snapshot',
    'amount_g',
    'unit',
    'kcal_snapshot',
    'protein_g_snapshot',
    'carbs_g_snapshot',
    'fat_g_snapshot',
    'fiber_g_snapshot',
    'created_at',
  ],

  saved_meal: ['id', 'name', 'locale', 'created_at', 'updated_at'],
  saved_meal_item: [
    'id',
    'saved_meal_id',
    'position',
    'food_id',
    'food_name_snapshot',
    'amount_g',
    'unit',
    'kcal_snapshot',
    'protein_g_snapshot',
    'carbs_g_snapshot',
    'fat_g_snapshot',
    'fiber_g_snapshot',
    'created_at',
  ],

  nutrition_targets: [
    'id',
    'kcal_target',
    'protein_g_target',
    'carbs_g_target',
    'fat_g_target',
    'updated_at',
  ],

  exercise: [
    'id',
    'origin',
    'kind',
    'muscle_group',
    'default_unit',
    'has_repetitions',
    'has_duration',
    'notes',
    'created_at',
    'updated_at',
  ],
  exercise_translation: ['exercise_id', 'locale', 'name', 'search'],
  exercise_aerobic_meta: ['exercise_id', 'kcal_per_hour'],

  aerobic_activity: [
    'id',
    'ref_date',
    'exercise_id',
    'exercise_name_snapshot',
    'kcal_per_hour_snapshot',
    'duration_minutes',
    'kcal_estimated',
    'notes',
    'created_at',
  ],
  aerobic_favorite: ['exercise_id', 'created_at'],

  workout_sheet: ['id', 'name', 'position', 'created_at', 'updated_at'],
  workout_session: [
    'id',
    'sheet_id',
    'name',
    'position',
    'created_at',
    'updated_at',
  ],
  workout_planned_exercise: [
    'id',
    'session_id',
    'exercise_id',
    'exercise_name_snapshot',
    'muscle_group_snapshot',
    'position',
    'planned_sets',
    'planned_reps',
    'planned_weight_kg',
    'notes',
    'created_at',
  ],
  performed_workout: [
    'id',
    'ref_date',
    'sheet_id',
    'session_id',
    'sheet_name_snapshot',
    'session_name_snapshot',
    'status',
    'started_at',
    'finished_at',
    'notes',
    'created_at',
    'updated_at',
  ],
  performed_workout_exercise: [
    'id',
    'performed_workout_id',
    'exercise_id',
    'exercise_name_snapshot',
    'muscle_group_snapshot',
    'position',
    'created_at',
  ],
  performed_workout_set: [
    'id',
    'performed_exercise_id',
    'position',
    'reps',
    'weight_kg',
    'completed',
    'created_at',
  ],
};

/** Roughly the same cascade set the real foreign keys declare (via SQL). */
const CASCADE_DELETE: Readonly<Record<string, readonly string[]>> = {
  food: ['food_translation', 'food_favorite'],
  meal: ['meal_item'],
  saved_meal: ['saved_meal_item'],
  exercise: ['exercise_translation', 'exercise_aerobic_meta', 'aerobic_favorite'],
  workout_sheet: ['workout_session'],
  workout_session: ['workout_planned_exercise'],
  performed_workout: ['performed_workout_exercise'],
  performed_workout_exercise: ['performed_workout_set'],
};

/**
 * Tables whose first column is `INTEGER PRIMARY KEY AUTOINCREMENT` and
 * therefore need the dev stub to auto-assign a fresh id when the caller
 * doesn't supply one. Tables NOT in this set have either a non-autoincrement
 * primary key (`food` / `food_favorite` / `meal_type` — caller passes id),
 * a composite primary key (`food_translation` / `meal_type_translation`),
 * or a singleton id=1 row (`user_profile` / `user_preferences` /
 * `nutrition_targets` — caller passes id = 1).
 */
const STUB_AUTOINCREMENT_PRIMARY: ReadonlySet<string> = new Set([
  'weight_entry',
  'meal',
  'meal_item',
  'saved_meal',
  'saved_meal_item',
  'aerobic_activity',
]);

class NativeConnection implements DbConnection {
  private readonly conn: SQLiteConnection;

  constructor() {
    this.conn = new SQLiteConnection(CapacitorSQLite);
  }

  async open(): Promise<void> {
    // createConnection is idempotent — returns the same handle for the same
    // database name within a single app process.
    await this.conn.createConnection(DB_NAME, false, 'no-encryption', 1, false);
  }

  async close(): Promise<void> {
    await this.conn.closeConnection(DB_NAME, false);
  }

  isNative(): boolean {
    return true;
  }

  async getDb(): Promise<unknown> {
    return this.conn.retrieveConnection(DB_NAME, false);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RowValues = Record<string, any>;

/**
 * Dev stub: a minimal in-memory table store. Only used in `quasar dev`
 * to allow visual navigation through the onboarding and (now) nutrition
 * flows. Real persistence happens only in the Android build.
 */
class DevStubConnection implements DbConnection {
  private readonly tables = new Map<string, RowValues[]>();
  private readonly autoincrement = new Map<string, number>();

  open(): Promise<void> {
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.tables.clear();
    this.autoincrement.clear();
    return Promise.resolve();
  }

  isNative(): boolean {
    return false;
  }

  getDb(): Promise<unknown> {
    const tables = this.tables;
    const autoincrement = this.autoincrement;
    return Promise.resolve({
      execute: (statement: string, values?: unknown[]) => {
        return this.execute(statement, values ?? [], tables, autoincrement);
      },
      query: (statement: string, values?: unknown[]) => {
        return { values: this.query(statement, values ?? [], tables) };
      },
    });
  }

  // -------------------------------------------------------------------------
  // Write path
  // -------------------------------------------------------------------------

  private execute(
    statement: string,
    values: unknown[],
    tables: Map<string, RowValues[]>,
    autoincrement: Map<string, number>,
  ) {
    const trimmed = statement.trim();
    const upper = trimmed.toUpperCase();

    // PRAGMA statements: silently succeed for any value. The native engine
    // will execute real pragmas against the on-device database.
    if (upper.startsWith('PRAGMA')) {
      return { changes: { changes: 0 }, rows: [] };
    }

    if (upper.startsWith('CREATE TABLE') || upper.startsWith('CREATE INDEX')) {
      return { changes: { changes: 0 }, rows: [] };
    }

    if (upper.startsWith('INSERT')) {
      const table = matchTableName(statement, 'INTO');
      if (!table) return { changes: { changes: 0 }, rows: [] };
      // INSERT OR REPLACE is not modelled by the dev stub (it would
      // duplicate rows). Promote to OR IGNORE so the dev workflow isn't
      // silently broken, but warn so the engineer notices.
      const replacement = detectInsertConflict(upper);
      if (replacement === 'replace') {
        console.warn(
          `[Amilio dev-stub] INSERT OR REPLACE is not supported; treating as OR IGNORE. ` +
            `Statement: ${trimmed}`,
        );
      }
      if (replacement === null) return { changes: { changes: 0 }, rows: [] };

      const cols = STUB_COLUMNS[table];
      if (!cols) return { changes: { changes: 1 }, rows: [] };
      const list = tables.get(table) ?? [];
      // Whether column 0 (= `id`) should be mapped from the params array.
      // Autoincrement tables need to skip col 0 because the caller never
      // supplies an id; everything else (singletons + non-auto primary
      // keys) passes an id parameter.
      const isAutoId = STUB_AUTOINCREMENT_PRIMARY.has(table);
      const setRow = mapValuesToRow(values, cols, !isAutoId);
      // For IGNORE with a unique-key conflict (here, food.id is the primary
      // key), we look for an existing row matching the same primary key and
      // skip the insert.
      if (replacement === 'ignore' && !isAutoId) {
        const pk = cols[0];
        if (pk && setRow[pk] !== undefined) {
          const existing = list.find((r) => r[pk] === setRow[pk]);
          if (existing) return { changes: { changes: 0 }, rows: [] };
        }
      }
      const row = setRow;
      // Assign autoincrement id only when the table actually auto-increments
      // and the caller didn't supply one.
      const lastId = autoincrement.get(table) ?? 0;
      if (isAutoId && (row['id'] === undefined || row['id'] === null)) {
        const next = lastId + 1;
        row['id'] = next;
        autoincrement.set(table, next);
      } else if (isAutoId && typeof row['id'] === 'number') {
        if (row['id'] > lastId) autoincrement.set(table, row['id']);
      }
      list.push(row);
      tables.set(table, list);
      return { changes: { changes: 1 }, rows: [] };
    }

    if (upper.startsWith('UPDATE')) {
      const table = matchTableName(statement, 'UPDATE');
      if (!table) return { changes: { changes: 0 }, rows: [] };
      const cols = STUB_COLUMNS[table];
      if (!cols) {
        // Unknown table — fall back to legacy behaviour.
        const list = tables.get(table) ?? [];
        list.forEach((row) => Object.assign(row, buildRow(values)));
        return { changes: { changes: 1 }, rows: [] };
      }
      const idParam = matchWhereId(statement, values.length);
      const setValues = idParam === null ? values : values.slice(0, -1);
      const setRow = mapValuesToRow(setValues, cols, /* includeAuto */ true);
      const list = tables.get(table) ?? [];
      let updated = 0;
      for (const row of list) {
        const matchesAll = matchesWhere(row, statement, values);
        if (!matchesAll) continue;
        for (const [k, v] of Object.entries(setRow)) {
          if (v !== undefined) row[k] = v;
        }
        updated++;
      }
      return { changes: { changes: updated }, rows: [] };
    }

    if (upper.startsWith('DELETE')) {
      const table = matchTableName(statement, 'FROM');
      if (!table) return { changes: { changes: 0 }, rows: [] };
      const list = tables.get(table) ?? [];
      const keep: RowValues[] = [];
      let removed = 0;
      for (const row of list) {
        if (matchesWhere(row, statement, values)) {
          removed++;
          // Manual cascade for the dev stub.
          const cascade = CASCADE_DELETE[table];
          if (cascade) {
            for (const child of cascade) {
              const childRows = tables.get(child) ?? [];
              tables.set(
                child,
                childRows.filter((r) => !foreignKeyMatches(r, table, row)),
              );
            }
          }
        } else {
          keep.push(row);
        }
      }
      tables.set(table, keep);
      return { changes: { changes: removed }, rows: [] };
    }

    return { changes: { changes: 0 }, rows: [] };
  }

  // -------------------------------------------------------------------------
  // Read path
  // -------------------------------------------------------------------------

  private query(
    statement: string,
    values: unknown[],
    tables: Map<string, RowValues[]>,
  ) {
    const trimmed = statement.trim();
    const upper = trimmed.toUpperCase();

    if (upper.startsWith('SELECT VERSION')) {
      return [{ version: 1 }];
    }

    // Aggregate fast-path: SELECT COUNT/SUM/MAX/MIN … FROM <table>. These
    // return a single row with a single value under an optional alias. The
    // native engine handles them natively; the dev stub must support them
    // too or repositories that aggregate (e.g. migration runner) will read
    // garbage.
    const agg = detectAggregate(trimmed, upper);
    if (agg) {
      const { fn, col, alias, table } = agg;
      const list = tables.get(table) ?? [];
      const filtered = list.filter((r) => matchesWhere(r, trimmed, values));
      const value = aggregateValue(fn, col, filtered);
      const key = alias ?? (fn === 'COUNT' && col === '*' ? 'count' : `${fn.toLowerCase()}(${col})`);
      return [{ [key]: value }];
    }

    // Fail closed on features we explicitly do not model. Unrecognised
    // SQL features would otherwise either silently return every row, leading
    // to subtle dev/prod divergence, or worse, cause incorrect mutations in
    // UPDATE / DELETE paths.
    const unsupported = detectUnsupportedFeatures(upper);
    if (unsupported) {
      console.warn(
        `[Amilio dev-stub] SELECT contains unsupported feature ("${unsupported}"). ` +
          `Statement: ${trimmed}`,
      );
      return [];
    }

    // Most queries are simple `FROM tablename [WHERE …] [ORDER BY …]`. We pick
    // the table by the first `FROM <table>` clause, then apply WHERE.
    const fromMatch = /(?:^|\s)FROM\s+([A-Z_]+)/i.exec(trimmed);
    const table = fromMatch?.[1]?.toLowerCase();
    if (!table) return [];

    const rows = tables.get(table) ?? [];
    const filtered = rows.filter((r) => matchesWhere(r, trimmed, values));
    return orderRows(filtered, trimmed);
  }
}

// ---------------------------------------------------------------------------
// Helpers — extracted outside the class so they're easy to unit-test.
// ---------------------------------------------------------------------------

function matchTableName(
  stmt: string,
  after: 'INTO' | 'UPDATE' | 'FROM',
): string | null {
  if (after === 'FROM') {
    const m = stmt.match(/\bFROM\s+(\w+)/i);
    return m && m[1] ? m[1].toLowerCase() : null;
  }
  const re = new RegExp(`\\b${after}\\s+(\\w+)`, 'i');
  const m = stmt.match(re);
  return m && m[1] ? m[1].toLowerCase() : null;
}

/**
 * Detect INSERT OR <conflict> clause and return the action.
 *  - 'ignore' for INSERT OR IGNORE / ABORT (we treat as a positional no-op
 *    on primary-key collision)
 *  - 'replace' for INSERT OR REPLACE (we promote to IGNORE in the dev
 *    stub and warn loudly so the engineer notices)
 *  - null when no conflict clause is present, or when the statement is
 *    not an INSERT.
 */
function detectInsertConflict(upper: string): 'ignore' | 'replace' | null {
  if (!upper.startsWith('INSERT')) return null;
  if (/\bINSERT\s+OR\s+REPLACE\b/.test(upper)) return 'replace';
  if (/\bINSERT\s+OR\s+IGNORE\b/.test(upper)) return 'ignore';
  if (/\bINSERT\s+OR\s+ABORT\b/.test(upper)) return 'ignore';
  return null;
}

/**
 * For an UPDATE/DELETE statement, return how many `?` placeholders belong
 * to the SET clause (which sits between `UPDATE table` and `WHERE`). The
 * WHERE-clause values follow those SET placeholders.
 */
function countPlaceholdersBeforeWhere(stmt: string): number {
  // Walk the SET clause up to the first `WHERE`.
  const idx = stmt.toUpperCase().indexOf('WHERE');
  if (idx < 0) return 0;
  const head = stmt.slice(0, idx);
  // Count `?` not inside string literals (best-effort — repos don't embed
  // `?` literals in SQL strings, so this works for our schema).
  let count = 0;
  let inString = false;
  for (let i = 0; i < head.length; i++) {
    const ch = head[i];
    if (ch === "'") inString = !inString;
    else if (ch === '?' && !inString) count++;
  }
  return count;
}

/**
 * For an UPDATE statement, returns the index of the `id` parameter
 * referenced in `WHERE id = ?`, if present. We assume a single id check —
 * enough for the dev stub's needs.
 */
function matchWhereId(stmt: string, totalParams: number): number | null {
  if (!/\bWHERE\b/i.test(stmt)) return null;
  const whereMatch = stmt.match(/\bWHERE\b([\s\S]*?)(?:\bORDER\s+BY\b|\bLIMIT\b|;|$)/i);
  if (!whereMatch) return null;
  if (!/\bid\s*=\s*\?/i.test(whereMatch[1]!)) return null;
  // Convention: the id parameter is the last one in the bound values.
  return totalParams - 1;
}

/**
 * Generic WHERE matcher. Supports the predicates SQLite clients typically
 * issue against the dev stub:
 *
 *   col = ?            exact match
 *   col <> ? / != ?
 *   col >  ?           numeric greater-than
 *   col <  ?           numeric less-than
 *   col >= ? / <= ?
 *   col BETWEEN ? AND ?
 *   col LIKE ?
 *   col IN (?, ?, …)
 *   col IS NULL        (note: no parameter)
 *   col IS NOT NULL
 *
 * Unknown predicates fail closed: returning `false` from an unknown
 * condition means no row ever matches, which surfaces dev/prod divergence
 * early instead of silently passing every row.
 */
function matchesWhere(
  row: RowValues,
  stmt: string,
  values: unknown[],
): boolean {
  const whereMatch = stmt.match(/\bWHERE\b([\s\S]*?)(?:\bORDER\s+BY\b|\bLIMIT\b|;|$)/i);
  if (!whereMatch) return true;
  const clause = whereMatch[1] ?? '';
  const conditions = splitAnd(clause);
  let paramIdx = 0;
  for (const cond of conditions) {
    const result = evaluateCondition(cond.trim(), row, values, () => values[paramIdx++]);
    if (result === 'unknown') return false; // fail closed
    if (result === false) return false;
    if (result === 'consumed-params') {
      // Number of params consumed is implicit — not tracked here.
      void 0;
    }
  }
  return true;
}

type ConditionResult = true | false | 'unknown' | 'consumed-params';

function evaluateCondition(
  cond: string,
  row: RowValues,
  allValues: unknown[],
  nextParam: () => unknown,
): ConditionResult {
  // IS [NOT] NULL
  const isMatch = cond.match(/^\s*(\w+)\s+IS\s+(NOT\s+)?NULL\s*$/i);
  if (isMatch) {
    const [, col, not] = isMatch;
    if (!col) return 'unknown';
    const isNull = row[col] === null || row[col] === undefined;
    return not ? !isNull : isNull;
  }
  // BETWEEN ? AND ?
  const between = cond.match(/^\s*(\w+)\s+BETWEEN\s+\?\s+AND\s+\?\s*$/i);
  if (between) {
    const [, col] = between;
    if (!col) return 'unknown';
    const low = Number(nextParam());
    const high = Number(nextParam());
    const value = Number(row[col]);
    if (Number.isNaN(value) || Number.isNaN(low) || Number.isNaN(high)) return false;
    return value >= low && value <= high;
  }
  // IN (?, ?, ?)
  const inList = cond.match(/^\s*(\w+)\s+IN\s+\(([^)]+)\)\s*$/i);
  if (inList) {
    const [, col, list] = inList;
    if (!col || !list) return 'unknown';
    const tokens = list.split(',').map((t) => t.trim());
    for (const tok of tokens) {
      const paramValue = consumeLiteralOrPlaceholder(tok, allValues, nextParam);
      if (row[col] === paramValue) return true;
    }
    return false;
  }
  // LIKE ?
  const like = cond.match(/^\s*(\w+)\s+LIKE\s+(\?|'[^']*')\s*$/i);
  if (like) {
    const [, col, raw] = like;
    if (!col || !raw) return 'unknown';
    const pattern = raw === '?'
      ? String(nextParam())
      : raw.slice(1, -1);
    const re = new RegExp('^' + pattern.replace(/%/g, '.*').replace(/_/g, '.') + '$');
    return re.test(String(row[col] ?? ''));
  }
  // Comparison: col OP value
  const cmp = cond.match(/^\s*(\w+)\s*(=|<>|!=|<=|>=|<|>)\s*(\?|\d+|'[^']*')\s*$/i);
  if (cmp) {
    const [, col, op, raw] = cmp;
    if (!col || !op || !raw) return 'unknown';
    let target: unknown;
    if (raw === '?') {
      target = nextParam();
    } else if (raw.startsWith("'")) {
      target = raw.slice(1, -1);
    } else {
      target = Number(raw);
    }
    return evaluate(row[col], op, target);
  }
  return 'unknown';
}

function consumeLiteralOrPlaceholder(
  token: string,
  _values: unknown[],
  nextParam: () => unknown,
): unknown {
  const t = token.trim();
  if (t === '?') return nextParam();
  if (t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1);
  const n = Number(t);
  return Number.isNaN(n) ? t : n;
}

function evaluate(left: unknown, op: string, right: unknown): boolean {
  if (op === '=') return left === right;
  if (op === '!=' || op === '<>') return left !== right;
  if (op === '>') return Number(left) > Number(right);
  if (op === '<') return Number(left) < Number(right);
  if (op === '>=') return Number(left) >= Number(right);
  if (op === '<=') return Number(left) <= Number(right);
  return false;
}

interface AggregatePattern {
  fn: 'COUNT' | 'SUM' | 'MAX' | 'MIN' | 'AVG';
  col: string;
  alias: string | null;
  table: string;
}

function detectAggregate(trimmed: string, upper: string): AggregatePattern | null {
  if (!upper.startsWith('SELECT') || !/\bFROM\s+/i.test(trimmed)) return null;
  const fnMatch = upper.match(/\bSELECT\s+(COUNT|SUM|MAX|MIN|AVG)\s*\(\s*(\*|\w+)\s*\)(?:\s+AS\s+(\w+))?/i);
  if (!fnMatch) return null;
  const fnRaw = fnMatch[1] ?? '';
  const colRaw = fnMatch[2] ?? '';
  const aliasRaw = fnMatch[3] ?? null;
  const fn = fnRaw.toUpperCase() as AggregatePattern['fn'];
  const col = colRaw === '*' ? '*' : colRaw.toLowerCase();
  if (col === '*' && fn !== 'COUNT') return null; // SUM(*) doesn't exist
  const tableMatch = upper.match(/\bFROM\s+(\w+)/i);
  if (!tableMatch || !tableMatch[1]) return null;
  const table = tableMatch[1].toLowerCase();
  return { fn, col, alias: aliasRaw, table };
}

function aggregateValue(
  fn: AggregatePattern['fn'],
  col: string,
  rows: RowValues[],
): number {
  if (fn === 'COUNT' && col === '*') return rows.length;
  const values = rows.map((r) => Number(r[col])).filter((n) => !Number.isNaN(n));
  if (values.length === 0) return 0;
  switch (fn) {
    case 'COUNT':
      return values.length;
    case 'SUM':
      return values.reduce((acc, v) => acc + v, 0);
    case 'MAX':
      return Math.max(...values);
    case 'MIN':
      return Math.min(...values);
    case 'AVG':
      return values.reduce((acc, v) => acc + v, 0) / values.length;
  }
}

function detectUnsupportedFeatures(upper: string): string | null {
  const features: Array<[RegExp, string]> = [
    [/\bJOIN\b/i, 'JOIN'],
    [/\bGROUP\s+BY\b/i, 'GROUP BY'],
    [/\bHAVING\b/i, 'HAVING'],
    [/\bDISTINCT\b/i, 'DISTINCT'],
    [/\bLIMIT\b/i, 'LIMIT'],
    [/\bUNION\b/i, 'UNION'],
    [/\bINTERSECT\b/i, 'INTERSECT'],
    [/\bEXCEPT\b/i, 'EXCEPT'],
  ];
  for (const [re, name] of features) {
    if (re.test(upper)) return name;
  }
  return null;
}

function splitAnd(clause: string): string[] {
  return clause.split(/\bAND\b/i).map((s) => s.trim()).filter(Boolean);
}

function orderRows(rows: RowValues[], stmt: string): RowValues[] {
  const orderMatch = stmt.match(/\bORDER\s+BY\s+([A-Z_]+)(?:\s+(ASC|DESC))?/i);
  if (!orderMatch) return rows;
  const [, col, dir] = orderMatch;
  if (!col) return rows;
  const desc = (dir ?? 'ASC').toUpperCase() === 'DESC';
  return [...rows].sort((a, b) => {
    const av = a[col];
    const bv = b[col];
    if (av === bv) return 0;
    const cmp = (av as never) > (bv as never) ? 1 : -1;
    return desc ? -cmp : cmp;
  });
}

function mapValuesToRow(
  values: unknown[],
  cols: readonly string[],
  includeAuto = false,
): RowValues {
  // Allow callers to pass a single object directly (used by some
  // repositories when the SQL is dynamic).
  if (values.length === 1 && isPlainObject(values[0])) {
    return { ...(values[0] as RowValues) };
  }
  const startIndex = includeAuto ? 0 : cols[0] === 'id' ? 1 : 0;
  const row: RowValues = {};
  for (let i = startIndex; i < values.length; i++) {
    const col = cols[i];
    if (!col) break;
    row[col] = values[i];
  }
  return row;
}

function isPlainObject(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function buildRow(values: unknown[]): RowValues {
  // Legacy fallback used only for unknown tables — keeps the stub
  // permissive even when the SCHEMA registry hasn't been updated.
  return { ...(values as RowValues) };
}

function foreignKeyMatches(
  childRow: RowValues,
  parentTable: string,
  parentRow: RowValues,
): boolean {
  switch (parentTable) {
    case 'food':
      return childRow['food_id'] === parentRow['id'];
    case 'meal':
      return childRow['meal_id'] === parentRow['id'];
    case 'saved_meal':
      return childRow['saved_meal_id'] === parentRow['id'];
    case 'exercise':
      return childRow['exercise_id'] === parentRow['id'];
    case 'workout_sheet':
      return childRow['sheet_id'] === parentRow['id'];
    case 'workout_session':
      return childRow['session_id'] === parentRow['id'];
    case 'performed_workout':
      return childRow['performed_workout_id'] === parentRow['id'];
    case 'performed_workout_exercise':
      return childRow['performed_exercise_id'] === parentRow['id'];
    default:
      return false;
  }
}

/** Whether we are running inside the Capacitor native container. */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/** Lazy connection factory — picks native vs dev stub once. */
export function createConnection(): Promise<DbConnection> {
  if (isNativePlatform()) {
    return Promise.resolve(new NativeConnection());
  }
  if (import.meta.env.DEV) {
    console.warn(
      '[Amilio] SQLite native plugin unavailable in browser dev. Using in-memory stub. ' +
        'Real persistence only happens in the Android build.',
    );
    return Promise.resolve(new DevStubConnection());
  }
  return Promise.reject(
    new Error(
      '[Amilio] SQLite native plugin is required outside the dev environment. ' +
        'Run the app on an Android device or emulator.',
    ),
  );
}
