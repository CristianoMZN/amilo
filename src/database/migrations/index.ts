// Migration registry. Each entry owns a version + SQL + optional upgrade hook.
// Add new migrations at the BOTTOM — never reorder existing entries.

import migration001 from './001_init.sql?raw';
import migration002 from './002_nutrition.sql?raw';
import migration003 from './003_exercises_workouts.sql?raw';

export interface Migration {
  version: number;
  description: string;
  sql: string;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'Initial schema (profile, preferences, weight history)',
    sql: migration001,
  },
  {
    version: 2,
    description: 'Nutrition: foods, meals, favorites, saved meals, targets',
    sql: migration002,
  },
  {
    version: 3,
    description: 'Sprint 3: exercises, aerobic activities, workout sheets, performed workouts',
    sql: migration003,
  },
] as const;

export const INITIAL_VERSION = 0;
export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version;
