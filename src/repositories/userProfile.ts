import type { DbConnection } from '../database/connection';
import type { UserProfile } from 'src/domain/types';

interface NativeExecResult<T = unknown> {
  changes?: { changes?: number };
  rows?: { _array?: T[] };
}

async function query<T>(conn: DbConnection, sql: string, params: unknown[] = []): Promise<T[]> {
  const db = (await conn.getDb()) as {
    query: (sql: string, params?: unknown[]) => Promise<{ values?: T[]; rows?: { _array?: T[] } }>;
  };
  const result = await db.query(sql, params);
  return result.values ?? result.rows?._array ?? [];
}

async function exec(conn: DbConnection, sql: string, params: unknown[] = []): Promise<void> {
  const db = (await conn.getDb()) as {
    execute: (sql: string, params?: unknown[]) => Promise<NativeExecResult>;
  };
  await db.execute(sql, params);
}

interface ProfileRow {
  id: number;
  name: string;
  birth_date: string;
  sex: 'male' | 'female';
  height_cm: number;
  weight_kg: number;
  activity: UserProfile['activity'];
  goal: UserProfile['goal'];
  created_at: string;
  updated_at: string;
}

function rowToProfile(row: ProfileRow): UserProfile {
  return {
    id: 1,
    name: row.name,
    birthDate: row.birth_date,
    sex: row.sex,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    activity: row.activity,
    goal: row.goal,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findProfile(conn: DbConnection): Promise<UserProfile | null> {
  const rows = await query<ProfileRow>(conn, 'SELECT * FROM user_profile WHERE id = 1');
  const row = rows[0];
  return row ? rowToProfile(row) : null;
}

export async function upsertProfile(conn: DbConnection, profile: UserProfile): Promise<void> {
  const now = new Date().toISOString();
  await exec(
    conn,
    `INSERT INTO user_profile
       (id, name, birth_date, sex, height_cm, weight_kg, activity, goal, created_at, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       birth_date = excluded.birth_date,
       sex = excluded.sex,
       height_cm = excluded.height_cm,
       weight_kg = excluded.weight_kg,
       activity = excluded.activity,
       goal = excluded.goal,
       updated_at = excluded.updated_at`,
    [
      profile.name,
      profile.birthDate,
      profile.sex,
      profile.heightCm,
      profile.weightKg,
      profile.activity,
      profile.goal,
      profile.createdAt ?? now,
      now,
    ],
  );
}
