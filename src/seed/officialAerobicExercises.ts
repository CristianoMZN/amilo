// Bundled aerobic exercise catalog — official reference rows seeded on first boot.
//
// IDs are stable string slugs (`'exercise:<name>'`). Corrections to an
// aerobic exercise's `kcalPerHour` never UPSERT an existing id — they add a
// new id and retire the old one — so historical `aerobic_activity` snapshots
// stay immune. The `kcalPerHour` values are rough averages for a ~70 kg
// adult at moderate intensity; they are useful defaults, not lab values.
//
// Data organisation note: entries are kept in a single file so a future
// contributor can see the whole catalog at a glance. The actual exported
// array is sorted alphabetically by id for predictable diffs.

import type {
  Exercise,
  ExerciseDefaultUnit,
  ExerciseKind,
  ExerciseOrigin,
  SupportedLocale,
} from 'src/domain/types';

/**
 * A seed row for an aerobic exercise. `exercise` carries the parent-table
 * columns (timestamps are owned by the seed runner); `translations` is the
 * per-locale display name keyed by the full `SupportedLocale` set; `meta`
 * captures the per-aerobic-exercise kcal-per-hour estimate.
 */
export interface OfficialAerobicExerciseSeed {
  exercise: Omit<Exercise, 'createdAt' | 'updatedAt'>;
  translations: Record<SupportedLocale, string>;
  meta: { kcalPerHour: number };
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Compact builder for an `OfficialAerobicExerciseSeed` row. Keeps each
 * entry readable as a single multi-line `seedAerobic(...)` call while
 * avoiding the noise of hand-written `{ exercise: {…}, translations: {…},
 * meta: {…} }` literals. Aerobic exercises are duration-based, so
 * `hasRepetitions` is locked to `false` and `hasDuration` to `true` here.
 */
function seedAerobic(
  id: string,
  defaultUnit: ExerciseDefaultUnit,
  translations: Record<SupportedLocale, string>,
  kcalPerHour: number,
): OfficialAerobicExerciseSeed {
  // `origin` is locked to `'official'`: this is the bundled catalog.
  // `kind` is locked to `'aerobic'` and `muscleGroup` to `null` — aerobic
  // exercises don't have a single primary muscle group. Aerobic sessions
  // are recorded by `duration_minutes`, never by reps, so the flags are
  // pinned regardless of the seed author's intent.
  const exercise: Omit<Exercise, 'createdAt' | 'updatedAt'> = {
    id,
    origin: 'official' satisfies ExerciseOrigin,
    kind: 'aerobic' satisfies ExerciseKind,
    muscleGroup: null,
    defaultUnit,
    hasRepetitions: false,
    hasDuration: true,
    notes: null,
  };
  return { exercise, translations, meta: { kcalPerHour } };
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

const AEROBIC_ROWS: OfficialAerobicExerciseSeed[] = [
  seedAerobic(
    'exercise:walking',
    'none',
    {
      en: 'Walking',
      es: 'Caminata',
      'pt-BR': 'Caminhada',
      de: 'Gehen',
      fr: 'Marche',
      ja: 'ウォーキング',
      ko: '걷기',
      it: 'Camminata',
    },
    280,
  ),
  seedAerobic(
    'exercise:running',
    'none',
    {
      en: 'Running',
      es: 'Carrera',
      'pt-BR': 'Corrida',
      de: 'Laufen',
      fr: 'Course',
      ja: 'ランニング',
      ko: '달리기',
      it: 'Corsa',
    },
    600,
  ),
  seedAerobic(
    'exercise:cycling',
    'none',
    {
      en: 'Cycling',
      es: 'Ciclismo',
      'pt-BR': 'Ciclismo',
      de: 'Radfahren',
      fr: 'Vélo',
      ja: 'サイクリング',
      ko: '자전거',
      it: 'Ciclismo',
    },
    500,
  ),
  seedAerobic(
    'exercise:stationary_bike',
    'none',
    {
      en: 'Stationary bike',
      es: 'Bicicleta estática',
      'pt-BR': 'Bicicleta ergométrica',
      de: 'Heimtrainer',
      fr: 'Vélo d’appartement',
      ja: 'エアロバイク',
      ko: '실내 자전거',
      it: 'Cyclette',
    },
    450,
  ),
  seedAerobic(
    'exercise:elliptical',
    'none',
    {
      en: 'Elliptical',
      es: 'Elíptica',
      'pt-BR': 'Elíptico',
      de: 'Ellipsentrainer',
      fr: 'Elliptique',
      ja: 'エリプティカル',
      ko: '엘립티컬',
      it: 'Ellittica',
    },
    500,
  ),
  seedAerobic(
    'exercise:stair_climber',
    'none',
    {
      en: 'Stair climber',
      es: 'Escalador',
      'pt-BR': 'Escada',
      de: 'Stair Climber',
      fr: 'Stairmaster',
      ja: 'ステアクライマー',
      ko: '스테퍼',
      it: 'Stairmaster',
    },
    520,
  ),
  seedAerobic(
    'exercise:rowing',
    'none',
    {
      en: 'Rowing',
      es: 'Remo',
      'pt-BR': 'Remo',
      de: 'Rudern',
      fr: 'Aviron',
      ja: 'ローイング',
      ko: '조정',
      it: 'Canottaggio',
    },
    480,
  ),
  seedAerobic(
    'exercise:swimming',
    'none',
    {
      en: 'Swimming',
      es: 'Natación',
      'pt-BR': 'Natação',
      de: 'Schwimmen',
      fr: 'Natation',
      ja: 'スイミング',
      ko: '수영',
      it: 'Nuoto',
    },
    500,
  ),
  seedAerobic(
    'exercise:jump_rope',
    'none',
    {
      en: 'Jump rope',
      es: 'Cuerda',
      'pt-BR': 'Corda',
      de: 'Seilspringen',
      fr: 'Corde à sauter',
      ja: '縄跳び',
      ko: '줄넘기',
      it: 'Salto con la corda',
    },
    700,
  ),
];

// ---------------------------------------------------------------------------
// Public export — sorted alphabetically by id for predictable diffs.
// ---------------------------------------------------------------------------

function compareIds(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

const SORTED_ROWS: OfficialAerobicExerciseSeed[] = [...AEROBIC_ROWS].sort((a, b) =>
  compareIds(a.exercise.id, b.exercise.id),
);

/**
 * Bundled official aerobic exercise catalog. Sorted alphabetically by
 * `exercise.id` so structural diffs are easy to read across changes.
 *
 * The exported array is the canonical input for `applySeed` and is also
 * re-imported by structural tests under `src/seed/__tests__/`.
 */
export const OFFICIAL_AEROBIC_EXERCISES: readonly OfficialAerobicExerciseSeed[] = SORTED_ROWS;
