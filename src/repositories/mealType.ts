import type { DbConnection } from '../database/connection';
import type {
  MealType,
  MealTypeId,
  MealTypeTranslation,
  SupportedLocale,
} from 'src/domain/types';

async function query<T>(
  conn: DbConnection,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const db = (await conn.getDb()) as {
    query: (sql: string, params?: unknown[]) => Promise<{ values?: T[]; rows?: { _array?: T[] } }>;
  };
  const result = await db.query(sql, params);
  return result.values ?? result.rows?._array ?? [];
}

async function exec(
  conn: DbConnection,
  sql: string,
  params: unknown[] = [],
): Promise<void> {
  const db = (await conn.getDb()) as {
    execute: (sql: string, params?: unknown[]) => Promise<unknown>;
  };
  await db.execute(sql, params);
}

interface MealTypeRow {
  id: string;
  sort_order: number;
  builtin: number;
}

function rowToMealType(row: MealTypeRow): MealType {
  return {
    id: row.id as MealTypeId,
    sortOrder: row.sort_order,
    builtin: row.builtin === 1,
  };
}

interface MealTypeTranslationRow {
  meal_type_id: string;
  locale: string;
  name: string;
}

function rowToMealTypeTranslation(row: MealTypeTranslationRow): MealTypeTranslation {
  return {
    mealTypeId: row.meal_type_id as MealTypeId,
    locale: row.locale as SupportedLocale,
    name: row.name,
  };
}

/** All meal types, sorted by sortOrder. */
export async function listMealTypes(conn: DbConnection): Promise<MealType[]> {
  const rows = await query<MealTypeRow>(
    conn,
    'SELECT * FROM meal_type ORDER BY sort_order ASC',
  );
  return rows.map(rowToMealType);
}

export async function findMealType(
  conn: DbConnection,
  id: MealTypeId,
): Promise<MealType | null> {
  const rows = await query<MealTypeRow>(
    conn,
    'SELECT * FROM meal_type WHERE id = ?',
    [id],
  );
  const row = rows[0];
  return row ? rowToMealType(row) : null;
}

export async function findMealTypeTranslation(
  conn: DbConnection,
  id: MealTypeId,
  locale: SupportedLocale,
): Promise<MealTypeTranslation | null> {
  const rows = await query<MealTypeTranslationRow>(
    conn,
    'SELECT * FROM meal_type_translation WHERE meal_type_id = ? AND locale = ?',
    [id, locale],
  );
  const row = rows[0];
  return row ? rowToMealTypeTranslation(row) : null;
}

export async function listMealTypesWithTranslations(
  conn: DbConnection,
  locale: SupportedLocale,
): Promise<Array<MealType & { name: string }>> {
  const types = await listMealTypes(conn);
  const out: Array<MealType & { name: string }> = [];
  for (const t of types) {
    const tr = await findMealTypeTranslation(conn, t.id, locale);
    if (!tr) continue;
    out.push({ ...t, name: tr.name });
  }
  return out;
}

/** INSERT OR IGNORE — used by the seeder. */
export async function seedMealTypeIfMissing(
  conn: DbConnection,
  mt: MealType,
): Promise<void> {
  await exec(
    conn,
    'INSERT OR IGNORE INTO meal_type (id, sort_order, builtin) VALUES (?, ?, ?)',
    [mt.id, mt.sortOrder, mt.builtin ? 1 : 0],
  );
}

/** INSERT OR IGNORE — used by the seeder. */
export async function seedMealTypeTranslationIfMissing(
  conn: DbConnection,
  tr: MealTypeTranslation,
): Promise<void> {
  await exec(
    conn,
    'INSERT OR IGNORE INTO meal_type_translation (meal_type_id, locale, name) VALUES (?, ?, ?)',
    [tr.mealTypeId, tr.locale, tr.name],
  );
}
