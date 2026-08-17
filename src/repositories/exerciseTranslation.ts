// Exercise translation CRUD.
//
// Each exercise carries one row per locale its name ships in. The
// `search` column is the diacritic-insensitive, case-insensitive
// normalisation of `name` (see `src/util/search.ts`) so the in-app
// catalog stays searchable across locales.

import type { DbConnection } from '../database/connection';
import type { ExerciseTranslation, SupportedLocale } from 'src/domain/types';
import { normalizeForSearch } from 'src/util/search';

async function query<T>(conn: DbConnection, sql: string, params: unknown[] = []): Promise<T[]> {
  const db = (await conn.getDb()) as {
    query: (sql: string, params?: unknown[]) => Promise<{ values?: T[]; rows?: { _array?: T[] } }>;
  };
  const result = await db.query(sql, params);
  return result.values ?? result.rows?._array ?? [];
}

async function exec(conn: DbConnection, sql: string, params: unknown[] = []): Promise<void> {
  const db = (await conn.getDb()) as {
    execute: (sql: string, params?: unknown[]) => Promise<unknown>;
  };
  await db.execute(sql, params);
}

interface ExerciseTranslationRow {
  exercise_id: string;
  locale: string;
  name: string;
  search: string;
}

function rowToTranslation(row: ExerciseTranslationRow): ExerciseTranslation {
  return {
    exerciseId: row.exercise_id,
    locale: row.locale as SupportedLocale,
    name: row.name,
    search: row.search,
  };
}

export async function findExerciseTranslation(
  conn: DbConnection,
  exerciseId: string,
  locale: SupportedLocale,
): Promise<ExerciseTranslation | null> {
  const rows = await query<ExerciseTranslationRow>(
    conn,
    'SELECT * FROM exercise_translation WHERE exercise_id = ? AND locale = ?',
    [exerciseId, locale],
  );
  const row = rows[0];
  return row ? rowToTranslation(row) : null;
}

/**
 * First available translation for the exercise, regardless of locale.
 * Used as a fallback when the user's active locale has no row.
 */
export async function findAnyExerciseTranslation(
  conn: DbConnection,
  exerciseId: string,
): Promise<ExerciseTranslation | null> {
  const rows = await query<ExerciseTranslationRow>(
    conn,
    'SELECT * FROM exercise_translation WHERE exercise_id = ? ORDER BY locale ASC',
    [exerciseId],
  );
  const row = rows[0];
  return row ? rowToTranslation(row) : null;
}

export async function listExerciseTranslationsByLocale(
  conn: DbConnection,
  locale: SupportedLocale,
): Promise<ExerciseTranslation[]> {
  const rows = await query<ExerciseTranslationRow>(
    conn,
    'SELECT * FROM exercise_translation WHERE locale = ? ORDER BY exercise_id ASC',
    [locale],
  );
  return rows.map(rowToTranslation);
}

export async function listExerciseTranslationsByExercise(
  conn: DbConnection,
  exerciseId: string,
): Promise<ExerciseTranslation[]> {
  const rows = await query<ExerciseTranslationRow>(
    conn,
    'SELECT * FROM exercise_translation WHERE exercise_id = ? ORDER BY locale ASC',
    [exerciseId],
  );
  return rows.map(rowToTranslation);
}

/**
 * Insert a brand-new translation. `search` is auto-derived from the
 * input name so callers don't have to think about diacritics or casing.
 * Throws if a row with `(exercise_id, locale)` already exists — use
 * `upsertExerciseTranslation` when conflict-tolerant semantics are
 * needed (e.g. seed re-application).
 */
export async function insertExerciseTranslation(
  conn: DbConnection,
  tr: Omit<ExerciseTranslation, 'search'>,
): Promise<ExerciseTranslation> {
  const search = normalizeForSearch(tr.name);
  await exec(
    conn,
    `INSERT INTO exercise_translation (exercise_id, locale, name, search)
     VALUES (?, ?, ?, ?)`,
    [tr.exerciseId, tr.locale, tr.name, search],
  );
  return { exerciseId: tr.exerciseId, locale: tr.locale, name: tr.name, search };
}

/**
 * Upsert a translation. Implemented as `INSERT OR IGNORE` followed by
 * `UPDATE` so the dev stub (which only models `INSERT OR IGNORE`)
 * behaves the same as the native `ON CONFLICT(...) DO UPDATE` clause
 * on `exercise_translation`.
 */
export async function upsertExerciseTranslation(
  conn: DbConnection,
  tr: ExerciseTranslation,
): Promise<void> {
  const search = tr.search.length > 0 ? tr.search : normalizeForSearch(tr.name);
  await exec(
    conn,
    `INSERT OR IGNORE INTO exercise_translation (exercise_id, locale, name, search)
     VALUES (?, ?, ?, ?)`,
    [tr.exerciseId, tr.locale, tr.name, search],
  );
  await exec(
    conn,
    `UPDATE exercise_translation SET
       name = ?,
       search = ?
     WHERE exercise_id = ? AND locale = ?`,
    [tr.name, search, tr.exerciseId, tr.locale],
  );
}

export async function deleteExerciseTranslations(
  conn: DbConnection,
  exerciseId: string,
): Promise<void> {
  await exec(conn, 'DELETE FROM exercise_translation WHERE exercise_id = ?', [exerciseId]);
}
