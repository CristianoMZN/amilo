import type { DbConnection } from '../database/connection';
import type { UserPreferences } from 'src/domain/types';

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

interface PrefsRow {
  id: number;
  locale: UserPreferences['locale'];
  measurement_system: UserPreferences['measurementSystem'];
  theme: UserPreferences['theme'];
  onboarding_completed_at: string | null;
  updated_at: string;
}

function rowToPrefs(row: PrefsRow): UserPreferences {
  return {
    id: 1,
    locale: row.locale,
    measurementSystem: row.measurement_system,
    theme: row.theme,
    onboardingCompletedAt: row.onboarding_completed_at,
    updatedAt: row.updated_at,
  };
}

export async function findPreferences(conn: DbConnection): Promise<UserPreferences | null> {
  const rows = await query<PrefsRow>(conn, 'SELECT * FROM user_preferences WHERE id = 1');
  const row = rows[0];
  return row ? rowToPrefs(row) : null;
}

export async function upsertPreferences(conn: DbConnection, prefs: UserPreferences): Promise<void> {
  const now = new Date().toISOString();
  await exec(
    conn,
    `INSERT INTO user_preferences
       (id, locale, measurement_system, theme, onboarding_completed_at, updated_at)
     VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       locale = excluded.locale,
       measurement_system = excluded.measurement_system,
       theme = excluded.theme,
       onboarding_completed_at = excluded.onboarding_completed_at,
       updated_at = excluded.updated_at`,
    [prefs.locale, prefs.measurementSystem, prefs.theme, prefs.onboardingCompletedAt, now],
  );
}
