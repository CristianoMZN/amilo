// Minimal in-memory `DbConnection` used by the repository tests.
//
// The dev stub in `src/database/connection.ts` is documented to fail
// closed on JOIN/GROUP BY/LIMIT and also silently drops the user-provided
// `id` value when inserting into tables whose first column is `id`
// (treating it as autoincrement). That's wrong for tables like `food`
// where `id` is a stable string slug. To exercise the most common path
// of each repo the tests need a connection that honours the user's id
// and the ON CONFLICT clauses. This fake is a small, no-deps model of
// the patterns the repos emit.

import type { DbConnection } from 'src/database/connection';

type Row = Record<string, unknown>;

const STUB_COLUMNS: Record<string, readonly string[]> = {
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
  meal: ['id', 'ref_date', 'meal_type_id', 'custom_name', 'position', 'created_at'],
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
};

const PRIMARY_KEYS: Record<string, readonly string[]> = {
  food: ['id'],
  food_translation: ['food_id', 'locale'],
  food_favorite: ['food_id'],
  meal_type: ['id'],
  meal_type_translation: ['meal_type_id', 'locale'],
  meal: ['id'],
  meal_item: ['id'],
  saved_meal: ['id'],
  saved_meal_item: ['id'],
  nutrition_targets: ['id'],
};

const SEQUENCE_TABLES: ReadonlySet<string> = new Set([
  'meal',
  'meal_item',
  'saved_meal',
  'saved_meal_item',
]);

const CASCADE_DELETE: Record<string, readonly string[]> = {
  food: ['food_translation', 'food_favorite'],
  meal: ['meal_item'],
  saved_meal: ['saved_meal_item'],
};

export class FakeDbConnection implements DbConnection {
  private readonly tables: Record<string, Row[]> = {};
  private readonly sequences: Record<string, number> = {};

  open(): Promise<void> {
    return Promise.resolve();
  }

  close(): Promise<void> {
    for (const key of Object.keys(this.tables)) {
      this.tables[key] = [];
    }
    for (const key of Object.keys(this.sequences)) {
      this.sequences[key] = 0;
    }
    return Promise.resolve();
  }

  isNative(): boolean {
    return false;
  }

  getDb(): Promise<unknown> {
    const tables = this.tables;
    const sequences = this.sequences;
    return Promise.resolve({
      execute: (sql: string, values: unknown[] = []) =>
        this.execute(sql, values, tables, sequences),
      query: (sql: string, values: unknown[] = []) =>
        Promise.resolve({ values: this.query(sql, values, tables) }),
    });
  }

  // -- Read-only access for assertions --------------------------------
  /** Snapshot of a table's rows. Useful for tests that want to inspect state. */
  rowsOf(table: string): Row[] {
    const list = this.tables[table];
    return list ? list.map((row) => ({ ...row })) : [];
  }

  // -------------------------------------------------------------------------
  // Write path
  // -------------------------------------------------------------------------

  private execute(
    sql: string,
    values: unknown[],
    tables: Record<string, Row[]>,
    sequences: Record<string, number>,
  ): { changes: { changes: number }; rows: [] } {
    const trimmed = sql.trim();
    const upper = trimmed.toUpperCase();

    if (upper.startsWith('PRAGMA') || upper.startsWith('CREATE')) {
      return { changes: { changes: 0 }, rows: [] };
    }

    if (upper.startsWith('INSERT')) {
      return this.executeInsert(trimmed, upper, values, tables, sequences);
    }
    if (upper.startsWith('UPDATE')) {
      return this.executeUpdate(trimmed, upper, values, tables);
    }
    if (upper.startsWith('DELETE')) {
      return this.executeDelete(trimmed, upper, values, tables);
    }
    return { changes: { changes: 0 }, rows: [] };
  }

  private executeInsert(
    sql: string,
    upper: string,
    values: unknown[],
    tables: Record<string, Row[]>,
    sequences: Record<string, number>,
  ): { changes: { changes: number }; rows: [] } {
    const tableMatch = /INSERT(?:\s+OR\s+(?:IGNORE|REPLACE|ABORT))?\s+INTO\s+(\w+)/i.exec(sql);
    if (!tableMatch) return { changes: { changes: 0 }, rows: [] };
    const table = tableMatch[1]!.toLowerCase();
    const colsMatch = /\(([^)]+)\)/.exec(sql);
    if (!colsMatch) return { changes: { changes: 0 }, rows: [] };
    const cols = (colsMatch[1] ?? '')
      .split(',')
      .map((c) => c.trim().toLowerCase());

    const isIgnore = /\bINSERT\s+OR\s+IGNORE\b/i.test(upper);
    const isReplace = /\bINSERT\s+OR\s+REPLACE\b/i.test(upper);
    const onConflict = /ON\s+CONFLICT\s*\(([^)]+)\)/i.exec(upper);
    const doUpdate = /DO\s+UPDATE\s+SET\s+([^)]+?)(?:\s+WHERE|$)/i.exec(upper);

    const list = this.bucket(table, tables);
    const row: Row = {};
    cols.forEach((col, i) => {
      row[col] = values[i];
    });
    // Auto-assign id for tables that use INTEGER PRIMARY KEY AUTOINCREMENT.
    // The repos bind `id` only when the schema sets it explicitly (e.g.
    // `food.id` TEXT, `nutrition_targets.id` = 1). For autoincrement tables
    // the repos omit `id` from the column list altogether, so we check
    // both the table's known columns and the column list.
    const hasIdColumn = STUB_COLUMNS[table]?.[0] === 'id';
    const idIncluded = cols[0] === 'id';
    if (hasIdColumn && !idIncluded && (row['id'] === undefined || row['id'] === null)) {
      if (SEQUENCE_TABLES.has(table)) {
        const next = (sequences[table] ?? 0) + 1;
        row['id'] = next;
        sequences[table] = next;
      }
    }

    const pk = PRIMARY_KEYS[table] ?? [];
    // Only check PK conflict when the row actually carries the PK columns
    // (autoincrement tables omit `id` from the INSERT column list).
    const pkOnRow = pk.length > 0 && pk.every((col) => row[col] !== undefined);
    const sameKey = (a: Row, b: Row): boolean =>
      pkOnRow && pk.every((col) => a[col] === b[col]);
    const existingIdx = pkOnRow ? list.findIndex((r) => sameKey(r, row)) : -1;

    if (isIgnore && existingIdx >= 0) {
      return { changes: { changes: 0 }, rows: [] };
    }
    if (isReplace && existingIdx >= 0) {
      list[existingIdx] = row;
      return { changes: { changes: 1 }, rows: [] };
    }
    if (onConflict && doUpdate && existingIdx >= 0) {
      const setParts = (doUpdate[1] ?? '').split(',').map((s) => s.trim());
      const setMap = new Map<string, string>();
      for (const part of setParts) {
        const m = /^(\w+)\s*=\s*excluded\.(\w+)/i.exec(part);
        if (m) setMap.set(m[1]!.toLowerCase(), m[2]!.toLowerCase());
      }
      for (const [target, source] of setMap) {
        // The source value lives at the source column's index in the bound
        // values array. If the source column wasn't in the bound list
        // (e.g. column missed from the bound VALUES, or comes from
        // `excluded` of an entirely different column), fall back to the
        // target column's own index.
        const sourceIdx = cols.indexOf(source);
        const targetIdx = cols.indexOf(target);
        const valueIdx = sourceIdx >= 0 ? sourceIdx : targetIdx;
        if (valueIdx >= 0) {
          list[existingIdx]![target] = values[valueIdx];
        }
      }
      return { changes: { changes: 1 }, rows: [] };
    }
    if (pk.length > 0 && existingIdx >= 0) {
      // No conflict clause but PK collision — reject (matches real SQLite).
      return { changes: { changes: 0 }, rows: [] };
    }

    list.push(row);
    return { changes: { changes: 1 }, rows: [] };
  }

  private executeUpdate(
    sql: string,
    upper: string,
    values: unknown[],
    tables: Record<string, Row[]>,
  ): { changes: { changes: number }; rows: [] } {
    const tableMatch = /UPDATE\s+(\w+)/i.exec(sql);
    if (!tableMatch) return { changes: { changes: 0 }, rows: [] };
    const table = tableMatch[1]!.toLowerCase();
    const setMatch = /SET\s+([\s\S]+?)\s+WHERE/i.exec(sql);
    if (!setMatch) return { changes: { changes: 0 }, rows: [] };
    const setText = setMatch[1] ?? '';
    const setParts = splitSetClauses(setText);
    // The SET placeholder count splits the bound values: the first N go to
    // SET, the remainder go to WHERE.
    const setPlaceholderCount = setParts.filter((p) => p.includes('?')).length;
    const setValues = values.slice(0, setPlaceholderCount);
    const whereValues = values.slice(setPlaceholderCount);
    const list = this.bucket(table, tables);
    let updated = 0;
    for (const row of list) {
      if (!matchesWhere(row, sql, whereValues)) continue;
      let setIdx = 0;
      for (const part of setParts) {
        const eq = /^(\w+)\s*=\s*([^,]+)$/.exec(part);
        if (!eq) continue;
        const target = (eq[1] ?? '').toLowerCase();
        const raw = (eq[2] ?? '').trim();
        if (raw === '?') {
          row[target] = setValues[setIdx];
          setIdx++;
        } else if (raw.toUpperCase() === 'NULL') {
          row[target] = null;
        } else {
          row[target] = stripQuotes(raw);
        }
      }
      updated++;
    }
    return { changes: { changes: updated }, rows: [] };
  }

  private executeDelete(
    sql: string,
    upper: string,
    values: unknown[],
    tables: Record<string, Row[]>,
  ): { changes: { changes: number }; rows: [] } {
    const tableMatch = /DELETE\s+FROM\s+(\w+)/i.exec(sql);
    if (!tableMatch) return { changes: { changes: 0 }, rows: [] };
    const table = tableMatch[1]!.toLowerCase();
    const list = this.bucket(table, tables);
    const keep: Row[] = [];
    let removed = 0;
    for (const row of list) {
      if (matchesWhere(row, sql, values)) {
        removed++;
        const cascade = CASCADE_DELETE[table];
        if (cascade) {
          for (const child of cascade) {
            const childList = this.bucket(child, tables);
            const pk = PRIMARY_KEYS[child] ?? [];
            this.tables[child] = childList.filter((c) =>
              pk.some((col) => c[col] !== row[col]),
            );
          }
        }
      } else {
        keep.push(row);
      }
    }
    this.tables[table] = keep;
    return { changes: { changes: removed }, rows: [] };
  }

  // -------------------------------------------------------------------------
  // Read path
  // -------------------------------------------------------------------------

  private query(sql: string, values: unknown[], tables: Record<string, Row[]>): Row[] {
    const trimmed = sql.trim();
    const upper = trimmed.toUpperCase();

    if (upper.startsWith('SELECT VERSION')) {
      return [{ version: 1 }];
    }

    const agg = detectAggregate(trimmed, upper);
    if (agg) {
      const list = tables[agg.table] ?? [];
      const filtered = list.filter((r) => matchesWhere(r, trimmed, values));
      const v = aggregateValue(agg.fn, agg.col, filtered);
      const alias = agg.alias ?? defaultAlias(agg.fn, agg.col);
      return [{ [alias]: v }];
    }

    const fromMatch = /(?:^|\s)FROM\s+(\w+)/i.exec(trimmed);
    const table = fromMatch?.[1]?.toLowerCase();
    if (!table) return [];
    const list = tables[table] ?? [];
    const filtered = list.filter((r) => matchesWhere(r, trimmed, values));
    return orderRows(filtered, trimmed);
  }

  private bucket(table: string, tables: Record<string, Row[]>): Row[] {
    if (!tables[table]) tables[table] = [];
    return tables[table];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function matchesWhere(row: Row, sql: string, values: unknown[]): boolean {
  const whereMatch = /\bWHERE\b([\s\S]*?)(?:\bORDER\s+BY\b|;|$)/i.exec(sql);
  if (!whereMatch) return true;
  const clause = whereMatch[1] ?? '';
  const conditions = clause.split(/\bAND\b/i);
  let paramIdx = 0;
  for (const cond of conditions) {
    const result = evaluateCondition(cond.trim(), row, values, () => values[paramIdx++]);
    if (result === 'unknown') return false;
    if (result === false) return false;
  }
  return true;
}

type CondResult = true | false | 'unknown';

function evaluateCondition(
  cond: string,
  row: Row,
  _values: unknown[],
  nextParam: () => unknown,
): CondResult {
  // IS [NOT] NULL
  const isMatch = /^\s*(\w+)\s+IS\s+(NOT\s+)?NULL\s*$/i.exec(cond);
  if (isMatch) {
    const col = (isMatch[1] ?? '').toLowerCase();
    const isNull = row[col] === null || row[col] === undefined;
    return isMatch[2] ? !isNull : isNull;
  }
  // LOWER(col) = LOWER(?)
  const lowerMatch = /^\s*LOWER\s*\(\s*(\w+)\s*\)\s*=\s*LOWER\s*\(\s*\?\s*\)\s*$/i.exec(cond);
  if (lowerMatch) {
    const col = (lowerMatch[1] ?? '').toLowerCase();
    const raw = nextParam();
    const target = `${raw ?? ''}`.toLowerCase();
    const rowStr = `${row[col] ?? ''}`.toLowerCase();
    return rowStr === target;
  }
  // BETWEEN ? AND ?
  const between = /^\s*(\w+)\s+BETWEEN\s+\?\s+AND\s+\?\s*$/i.exec(cond);
  if (between) {
    const col = (between[1] ?? '').toLowerCase();
    const low = Number(nextParam());
    const high = Number(nextParam());
    const value = Number(row[col]);
    return value >= low && value <= high;
  }
  // IN (?, ?, ?)
  const inList = /^\s*(\w+)\s+IN\s+\(([^)]+)\)\s*$/i.exec(cond);
  if (inList) {
    const col = (inList[1] ?? '').toLowerCase();
    const tokens = (inList[2] ?? '').split(',').map((t) => t.trim());
    const candidates = tokens.map((tok) =>
      tok === '?' ? nextParam() : coerceLiteral(tok),
    );
    return candidates.some((v) => row[col] === v);
  }
  // LIKE ?
  const like = /^\s*(\w+)\s+LIKE\s+(\?|'[^']*')\s*$/i.exec(cond);
  if (like) {
    const col = (like[1] ?? '').toLowerCase();
    const raw = like[2] ?? '';
    const patternSource = raw === '?' ? nextParam() : raw.slice(1, -1);
    const pattern = `${patternSource ?? ''}`.replace(/%/g, '.*').replace(/_/g, '.');
    const re = new RegExp(`^${pattern}$`);
    return re.test(`${row[col] ?? ''}`);
  }
  // col = ? / col = <literal>
  const cmp = /^\s*(\w+)\s*(=|<>|!=|<=|>=|<|>)\s*(\?|\d+|'[^']*')\s*$/i.exec(cond);
  if (cmp) {
    const col = (cmp[1] ?? '').toLowerCase();
    const op = cmp[2] ?? '=';
    const raw = cmp[3] ?? '?';
    const target = raw === '?' ? nextParam() : coerceLiteral(raw);
    return compare(row[col], op, target);
  }
  return 'unknown';
}

function coerceLiteral(raw: string): unknown {
  if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1);
  const n = Number(raw);
  return Number.isNaN(n) ? raw : n;
}

function stripQuotes(raw: string): string {
  if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1);
  return raw;
}

/**
 * Split a `SET` clause into individual `col = expr` parts. The clause is
 * guaranteed free of top-level commas inside the right-hand side of an
 * expression for the repos we exercise.
 */
function splitSetClauses(setText: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of setText) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) parts.push(trimmed);
      current = '';
    } else {
      current += ch;
    }
  }
  const trimmed = current.trim();
  if (trimmed) parts.push(trimmed);
  return parts;
}

function compare(left: unknown, op: string, right: unknown): boolean {
  if (op === '=') return left === right;
  if (op === '!=' || op === '<>') return left !== right;
  if (op === '>') return Number(left) > Number(right);
  if (op === '<') return Number(left) < Number(right);
  if (op === '>=') return Number(left) >= Number(right);
  if (op === '<=') return Number(left) <= Number(right);
  return false;
}

function orderRows(rows: Row[], stmt: string): Row[] {
  const orderMatch = /\bORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i.exec(stmt);
  if (!orderMatch) return rows;
  const col = (orderMatch[1] ?? '').toLowerCase();
  const desc = (orderMatch[2] ?? 'ASC').toUpperCase() === 'DESC';
  return [...rows].sort((a, b) => {
    const av = a[col];
    const bv = b[col];
    if (av === bv) return 0;
    const cmp = (av as never) > (bv as never) ? 1 : -1;
    return desc ? -cmp : cmp;
  });
}

interface AggregatePattern {
  fn: 'COUNT' | 'SUM' | 'MAX' | 'MIN' | 'AVG';
  col: string;
  alias: string | null;
  table: string;
}

function detectAggregate(trimmed: string, upper: string): AggregatePattern | null {
  if (!upper.startsWith('SELECT') || !/\bFROM\s+/i.test(trimmed)) return null;
  const fnMatch = /\bSELECT\s+(COUNT|SUM|MAX|MIN|AVG)\s*\(\s*(\*|\w+)\s*\)(?:\s+AS\s+(\w+))?/i.exec(
    upper,
  );
  if (!fnMatch) return null;
  const fn = (fnMatch[1] ?? 'COUNT').toUpperCase() as AggregatePattern['fn'];
  const col = fnMatch[2] ?? '*';
  const alias = fnMatch[3] ?? null;
  const tableMatch = /\bFROM\s+(\w+)/i.exec(upper);
  if (!tableMatch) return null;
  return { fn, col, alias, table: tableMatch[1]!.toLowerCase() };
}

function defaultAlias(fn: string, col: string): string {
  if (fn === 'COUNT' && col === '*') return 'count';
  return `${fn.toLowerCase()}(${col})`;
}

function aggregateValue(fn: string, col: string, rows: Row[]): number {
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
  return 0;
}
