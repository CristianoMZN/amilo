import type { DbConnection } from './connection';
import { createConnection, isNativePlatform } from './connection';
import { MIGRATIONS } from './migrations';

/**
 * Thin schema-version helper. Reads the `schema_version` table, finds the
 * highest applied version, and applies any pending migrations in order.
 */

interface NativeQueryResult<T> {
  values?: T[];
  rows?: { _array?: T[] };
}

async function queryOne<T>(conn: DbConnection, sql: string): Promise<T | null> {
  const db = (await conn.getDb()) as {
    query: (sql: string, params?: unknown[]) => Promise<NativeQueryResult<T>>;
  };
  const result = await db.query(sql);
  const row = result.values?.[0] ?? result.rows?._array?.[0];
  return row ?? null;
}

async function execute(conn: DbConnection, sql: string, params: unknown[] = []): Promise<void> {
  const db = (await conn.getDb()) as {
    execute: (sql: string, params?: unknown[]) => Promise<unknown>;
  };
  await db.execute(sql, params);
}

async function getCurrentVersion(conn: DbConnection): Promise<number> {
  const row = await queryOne<{ version: number }>(conn, 'SELECT MAX(version) as version FROM schema_version');
  return row?.version ?? 0;
}

export async function ensureSchema(conn: DbConnection): Promise<void> {
  // The migration for v1 creates schema_version if missing. We still need to
  // guard the SELECT above — make sure the table exists first.
  await execute(
    conn,
    `CREATE TABLE IF NOT EXISTS schema_version (
       version    INTEGER PRIMARY KEY,
       applied_at TEXT NOT NULL
     )`,
  );

  // Enable foreign-key enforcement. @capacitor-community/sqlite ships with
  // PRAGMA foreign_keys = OFF by default; without this, the `ON DELETE
  // CASCADE` declarations in 002_nutrition.sql (food → food_translation /
  // food_favorite, meal → meal_item, saved_meal → saved_meal_item) would be
  // silently ignored at runtime.
  await execute(conn, 'PRAGMA foreign_keys = ON');

  const current = await getCurrentVersion(conn);

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    await execute(conn, migration.sql);
    await execute(
      conn,
      'INSERT INTO schema_version (version, applied_at) VALUES (?, ?)',
      [migration.version, new Date().toISOString()],
    );
  }
}

let cached: DbConnection | null = null;

/** Opens the connection lazily. Subsequent calls return the same handle. */
export async function getDatabase(): Promise<DbConnection> {
  if (!cached) {
    cached = await createConnection();
    await cached.open();
    await ensureSchema(cached);
  }
  return cached;
}

/** Closes the cached connection (used in tests / app teardown). */
export async function closeDatabase(): Promise<void> {
  if (cached) {
    await cached.close();
    cached = null;
  }
}

export function databaseIsNative(): boolean {
  return isNativePlatform();
}