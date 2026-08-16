// Singleton nutrition targets — kcal/protein/carbs/fat per day.
//
// The dev stub does not model `INSERT ... ON CONFLICT(id) DO UPDATE`. The
// native SQLite engine handles this correctly; the stub will silently no-op
// the statement. The native codepath is the one tested on-device.

import type { DbConnection } from '../database/connection';
import type { NutritionTargets } from 'src/domain/types';
import { nowIso } from 'src/util/dateDay';

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

interface NutritionTargetsRow {
  id: number;
  kcal_target: number;
  protein_g_target: number;
  carbs_g_target: number;
  fat_g_target: number;
  updated_at: string;
}

function rowToTargets(row: NutritionTargetsRow): NutritionTargets {
  return {
    id: 1,
    kcalTarget: row.kcal_target,
    proteinGTarget: row.protein_g_target,
    carbsGTarget: row.carbs_g_target,
    fatGTarget: row.fat_g_target,
    updatedAt: row.updated_at,
  };
}

export async function findNutritionTargets(
  conn: DbConnection,
): Promise<NutritionTargets | null> {
  const rows = await query<NutritionTargetsRow>(
    conn,
    'SELECT * FROM nutrition_targets WHERE id = 1',
  );
  const row = rows[0];
  return row ? rowToTargets(row) : null;
}

export async function upsertNutritionTargets(
  conn: DbConnection,
  targets: NutritionTargets,
): Promise<void> {
  // The dev stub does not model `INSERT ... ON CONFLICT(id) DO UPDATE` —
  // see the note at the top of this file. The native engine handles the
  // upsert correctly.
  const now = nowIso();
  await exec(
    conn,
    `INSERT INTO nutrition_targets
       (id, kcal_target, protein_g_target, carbs_g_target, fat_g_target, updated_at)
     VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       kcal_target = excluded.kcal_target,
       protein_g_target = excluded.protein_g_target,
       carbs_g_target = excluded.carbs_g_target,
       fat_g_target = excluded.fat_g_target,
       updated_at = excluded.updated_at`,
    [targets.kcalTarget, targets.proteinGTarget, targets.carbsGTarget, targets.fatGTarget, now],
  );
}
