// Amilio strict domain types — single source of truth.
// Keep this file free of Vue, Pinia, Capacitor or Quasar imports.

/** Locale codes actually shipped in the app (no regional variants). */
export type SupportedLocale = 'en' | 'es' | 'pt-BR' | 'de' | 'fr' | 'ja' | 'ko' | 'it';

/** Measurement system the user prefers to *see*. */
export type MeasurementSystem = 'metric' | 'imperial';

/** Biological sex used by the metabolic formula. */
export type BiologicalSex = 'male' | 'female';

/** Activity level used as a TDEE multiplier. */
export type ActivityLevel =
  'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active';

/** User's high-level goal. */
export type UserGoal = 'lose' | 'maintain' | 'gain';

/** Theme preference for the app. */
export type ThemePreference = 'system' | 'light' | 'dark';

/** Persisted user profile. Stored normalised (kg, cm, ISO date). */
export interface UserProfile {
  id: 1; // singleton row — only one profile per device
  name: string;
  birthDate: string; // ISO YYYY-MM-DD
  sex: BiologicalSex;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: UserGoal;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

/** Persisted user preferences. */
export interface UserPreferences {
  id: 1;
  locale: SupportedLocale;
  measurementSystem: MeasurementSystem;
  theme: ThemePreference;
  onboardingCompletedAt: string | null; // ISO timestamp or null while pending
  updatedAt: string;
}

/** Persisted weight history entry. One row per weight event. */
export interface WeightEntry {
  id: number;
  weightKg: number;
  recordedAt: string; // ISO timestamp
  source: 'onboarding' | 'manual' | 'import';
}

/** Result of the Mifflin–St Jeor formula. */
export interface BmrEstimate {
  bmrKcal: number;
}

/** Result of total daily energy expenditure. */
export interface TdeeEstimate {
  bmrKcal: number;
  tdeeKcal: number;
  activity: ActivityLevel;
}

/** Schema version row. */
export interface SchemaVersionRow {
  version: number;
  appliedAt: string;
}

/** A complete onboarding draft — kept in memory + persisted progressively. */
export interface OnboardingDraft {
  name: string;
  birthDate: string | null;
  sex: BiologicalSex | null;
  heightCm: number | null;
  weightKg: number | null;
  activity: ActivityLevel | null;
  goal: UserGoal | null;
}

// ---------------------------------------------------------------------------
// Sprint 2 — Nutrition
// ---------------------------------------------------------------------------

/** Provenance of a food row. Official = bundled catalog, custom = user-created. */
export type FoodOrigin = 'official' | 'custom';

/** Reference unit used to describe a food's nutrition values. */
export type FoodBaseUnit = 'g' | 'ml';

/**
 * Stable, semantic meal type. The synthetic 'custom' id is used when the
 * user-defined slot carries a `meal.custom_name`.
 */
export type MealTypeId = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'supper' | 'custom';

/**
 * A reusable nutritional entity. IDs are stable, semantic strings:
 *   - official: 'food:rice_white'
 *   - custom:   'food:user:<uuid>'
 *
 * Nutritional values are normalised to `baseAmountG` (always 100 for solids,
 * 100 for liquids). Per-amount transformations live in domain code so
 * snapshots and live values stay consistent.
 */
export interface Food {
  id: string;
  origin: FoodOrigin;
  baseAmountG: number;
  baseUnit: FoodBaseUnit;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Per-locale display name + diacritic-insensitive search blob. */
export interface FoodTranslation {
  foodId: string;
  locale: SupportedLocale;
  name: string;
  search: string;
}

/** Built-in or user-defined meal slot. */
export interface MealType {
  id: MealTypeId;
  sortOrder: number;
  builtin: boolean;
}

/** Per-locale display name of a meal type. */
export interface MealTypeTranslation {
  mealTypeId: MealTypeId;
  locale: SupportedLocale;
  name: string;
}

/**
 * A single meal-instance on a single local day. A "lunch" is one row even
 * if the user logs it twice — typical UX uses one row per (refDate,
 * mealTypeId) and lets slots grow by adding items.
 */
export interface Meal {
  id: number;
  /** Local YYYY-MM-DD. Derived from user-local timezone, never UTC. */
  refDate: string;
  mealTypeId: MealTypeId;
  /** Only set when mealTypeId === 'custom'. */
  customName: string | null;
  position: number;
  createdAt: string;
}

/**
 * A single consumed item. `*_snapshot` fields freeze the nutritional value
 * at consumption time so historical meals never change retroactively when
 * the parent food is edited or deleted.
 */
export interface MealItem {
  id: number;
  mealId: number;
  position: number;
  /**
   * Foreign key kept loose on purpose: a custom food can be deleted without
   * breaking the snapshot. Display always falls back to `foodNameSnapshot`.
   */
  foodId: string | null;
  foodNameSnapshot: string;
  amountG: number;
  unit: FoodBaseUnit;
  kcalSnapshot: number;
  proteinGSnapshot: number;
  carbsGSnapshot: number;
  fatGSnapshot: number;
  fiberGSnapshot: number | null;
  createdAt: string;
}

/** A single favorite entry. */
export interface FoodFavorite {
  foodId: string;
  createdAt: string;
}

/** A user-defined reusable meal template. */
export interface SavedMeal {
  id: number;
  name: string;
  locale: SupportedLocale;
  createdAt: string;
  updatedAt: string;
}

/** Item template belonging to a saved meal. Same snapshot semantics as MealItem. */
export interface SavedMealItem {
  id: number;
  savedMealId: number;
  position: number;
  foodId: string | null;
  foodNameSnapshot: string;
  amountG: number;
  unit: FoodBaseUnit;
  kcalSnapshot: number;
  proteinGSnapshot: number;
  carbsGSnapshot: number;
  fatGSnapshot: number;
  fiberGSnapshot: number | null;
  createdAt: string;
}

/** Singleton macro targets. */
export interface NutritionTargets {
  id: 1;
  kcalTarget: number;
  proteinGTarget: number;
  carbsGTarget: number;
  fatGTarget: number;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Sprint 3 — Exercises & Workouts
// ---------------------------------------------------------------------------

/** Provenance of an exercise. Official = bundled catalog, custom = user-created. */
export type ExerciseOrigin = 'official' | 'custom';

/** Whether the exercise is primarily cardio (aerobic) or resistance (strength). */
export type ExerciseKind = 'aerobic' | 'strength';

/** Canonical muscle group for strength exercises. Nullable for aerobic. */
export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'legs'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'lower_back'
  | 'full_body'
  | 'other';

/**
 * What kind of weight, if any, an exercise uses.
 * - `kg` / `lb`: external load, always required when sets are recorded
 * - `bodyweight`: load is allowed but optional (e.g. weighted pull-up)
 * - `none`: load not applicable (e.g. push-up, plank, ab crunch)
 */
export type ExerciseDefaultUnit = 'kg' | 'lb' | 'bodyweight' | 'none';

/**
 * A reusable exercise (aerobic or strength). IDs are stable, semantic slugs:
 *   - official: 'exercise:walking', 'exercise:barbell_bench_press', …
 *   - custom:   'exercise:user:<uuid>'
 */
export interface Exercise {
  id: string;
  origin: ExerciseOrigin;
  kind: ExerciseKind;
  muscleGroup: MuscleGroup | null;
  defaultUnit: ExerciseDefaultUnit;
  /** Whether the exercise is recorded by repetitions (most strength). */
  hasRepetitions: boolean;
  /** Whether the exercise is recorded by duration (most aerobic). */
  hasDuration: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Per-locale display name + diacritic-insensitive search blob. */
export interface ExerciseTranslation {
  exerciseId: string;
  locale: SupportedLocale;
  name: string;
  search: string;
}

/** Per-aerobic-exercise kcal-per-hour estimate. */
export interface ExerciseAerobicMeta {
  exerciseId: string;
  kcalPerHour: number;
}

/**
 * A logged aerobic session. Snapshot fields preserve history even if the
 * parent exercise's kcal/h changes or the exercise is deleted.
 */
export interface AerobicActivity {
  id: number;
  refDate: string; // local YYYY-MM-DD
  exerciseId: string | null;
  exerciseNameSnapshot: string;
  kcalPerHourSnapshot: number;
  durationMinutes: number;
  kcalEstimated: number;
  notes: string | null;
  createdAt: string;
}

/** A favorite aerobic exercise. Reuses food_favorite pattern. */
export interface AerobicFavorite {
  exerciseId: string;
  createdAt: string;
}

/** A workout routine (a "plan"). */
export interface WorkoutSheet {
  id: number;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * A division/session of a sheet. Free-form name — no A/B/C enforcement.
 * (e.g. "Peito + tríceps", "Costas + bíceps", "Pernas").
 */
export interface WorkoutSession {
  id: number;
  sheetId: number;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * A planned exercise inside a session. Snapshot fields preserve history
 * even if the parent exercise is renamed or deleted.
 */
export interface WorkoutPlannedExercise {
  id: number;
  sessionId: number;
  exerciseId: string | null;
  exerciseNameSnapshot: string;
  muscleGroupSnapshot: MuscleGroup | null;
  position: number;
  plannedSets: number;
  plannedReps: number;
  /** Canonical kg; null if the exercise doesn't use external load. */
  plannedWeightKg: number | null;
  notes: string | null;
  createdAt: string;
}

/** Status of a performed workout (lifecycle state). */
export type PerformedWorkoutStatus = 'in_progress' | 'completed' | 'abandoned';

/**
 * An actual workout execution, independent of the sheet (snapshots preserve
 * history if the sheet/session/exercise is renamed or deleted).
 */
export interface PerformedWorkout {
  id: number;
  refDate: string;
  sheetId: number | null;
  sessionId: number | null;
  sheetNameSnapshot: string;
  sessionNameSnapshot: string;
  status: PerformedWorkoutStatus;
  startedAt: string;
  finishedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Exercise within a performed workout. Snapshot the name + muscle group. */
export interface PerformedWorkoutExercise {
  id: number;
  performedWorkoutId: number;
  exerciseId: string | null;
  exerciseNameSnapshot: string;
  muscleGroupSnapshot: MuscleGroup | null;
  position: number;
  createdAt: string;
}

/**
 * A single performed set (series). Weight stored in canonical kg; null when
 * the exercise uses no load. `reps` is REAL so partial reps (e.g. paused reps)
 * can be expressed; UI defaults to integer steps.
 */
export interface PerformedWorkoutSet {
  id: number;
  performedExerciseId: number;
  position: number;
  reps: number;
  weightKg: number | null;
  completed: boolean;
  createdAt: string;
}
