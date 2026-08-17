import type { DbConnection } from '../database/connection';
import type { WeightEntry } from 'src/domain/types';

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

interface WeightRow {
  id: number;
  weight_kg: number;
  recorded_at: string;
  source: WeightEntry['source'];
}

function rowToEntry(row: WeightRow): WeightEntry {
  return {
    id: row.id,
    weightKg: row.weight_kg,
    recordedAt: row.recorded_at,
    source: row.source,
  };
}

export async function listWeightEntries(conn: DbConnection): Promise<WeightEntry[]> {
  const rows = await query<WeightRow>(conn, 'SELECT * FROM weight_entry ORDER BY recorded_at DESC');
  return rows.map(rowToEntry);
}

export async function insertWeightEntry(
  conn: DbConnection,
  entry: Omit<WeightEntry, 'id'>,
): Promise<WeightEntry> {
  await exec(conn, 'INSERT INTO weight_entry (weight_kg, recorded_at, source) VALUES (?, ?, ?)', [
    entry.weightKg,
    entry.recordedAt,
    entry.source,
  ]);
  // SQLite's lastInsertRowid is portable; on the dev stub we approximate by
  // returning the timestamp hash. Repositories should treat the returned id
  // as advisory only.
  const rows = await query<{ id: number }>(conn, 'SELECT MAX(id) AS id FROM weight_entry');
  const id = rows[0]?.id ?? Math.floor(Math.random() * 1_000_000);
  return { id, ...entry };
}

export async function latestWeightEntry(conn: DbConnection): Promise<WeightEntry | null> {
  const entries = await listWeightEntries(conn);
  return entries[0] ?? null;
}
