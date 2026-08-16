import { defineStore } from 'pinia';
import type {
  BiologicalSex,
  MeasurementSystem,
  OnboardingDraft,
  SupportedLocale,
  ThemePreference,
  UserGoal,
  ActivityLevel,
} from 'src/domain/types';

/**
 * Cross-cutting application state.
 *
 * Owns: locale, theme, onboarding completion flag, measurement-system
 * suggestion, database readiness. Persists nothing itself — Pinia state lives
 * in memory; persistence is handled by the boot/database layer.
 */
export interface AppState {
  locale: SupportedLocale;
  persistedLocale: SupportedLocale | null;
  theme: ThemePreference;
  measurementSystem: MeasurementSystem;
  suggestedMeasurementSystem: MeasurementSystem;
  databaseReady: boolean;
  databaseError: unknown;
}

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    locale: 'en',
    persistedLocale: null,
    theme: 'system',
    measurementSystem: 'metric',
    suggestedMeasurementSystem: 'metric',
    databaseReady: false,
    databaseError: null,
  }),
  getters: {
    onboardingCompleted(): boolean {
      return this.databaseReady && this.persistedLocale !== null;
    },
  },
  actions: {
    setLocaleFromDevice(locale: SupportedLocale) {
      this.locale = locale;
      this.persistedLocale = locale;
    },
    setLocale(locale: SupportedLocale) {
      this.locale = locale;
      this.persistedLocale = locale;
    },
    setTheme(theme: ThemePreference) {
      this.theme = theme;
    },
    setMeasurementSystem(system: MeasurementSystem) {
      this.measurementSystem = system;
    },
    setSuggestedMeasurementSystem(system: MeasurementSystem) {
      this.suggestedMeasurementSystem = system;
    },
    markDatabaseReady() {
      this.databaseReady = true;
      this.databaseError = null;
    },
    markDatabaseError(err: unknown) {
      this.databaseReady = false;
      this.databaseError = err;
    },
  },
});

/**
 * Onboarding working state. Holds the in-progress draft so the user can leave
 * and come back. Final values are written to SQLite via repositories when the
 * summary step is confirmed.
 */
export interface OnboardingState {
  step: number;
  draft: OnboardingDraft;
  /**
   * Persisted fields that survived a process kill. We update this eagerly as
   * the user advances steps so the SQLite state never lags behind the UI by
   * more than one step.
   */
  persistedStep: number;
}

const EMPTY_DRAFT: OnboardingDraft = {
  name: '',
  birthDate: null,
  sex: null,
  heightCm: null,
  weightKg: null,
  activity: null,
  goal: null,
};

export const useOnboardingStore = defineStore('onboarding', {
  state: (): OnboardingState => ({
    step: 0,
    draft: { ...EMPTY_DRAFT },
    persistedStep: 0,
  }),
  getters: {
    isComplete: (state) =>
      state.draft.name.length > 0 &&
      state.draft.birthDate !== null &&
      state.draft.sex !== null &&
      state.draft.heightCm !== null &&
      state.draft.weightKg !== null &&
      state.draft.activity !== null &&
      state.draft.goal !== null,
  },
  actions: {
    setName(name: string) {
      this.draft.name = name.trim();
    },
    setBirthDate(birthDate: string | null) {
      this.draft.birthDate = birthDate;
    },
    setSex(sex: BiologicalSex | null) {
      this.draft.sex = sex;
    },
    setHeightCm(heightCm: number | null) {
      this.draft.heightCm = heightCm;
    },
    setWeightKg(weightKg: number | null) {
      this.draft.weightKg = weightKg;
    },
    setActivity(activity: ActivityLevel | null) {
      this.draft.activity = activity;
    },
    setGoal(goal: UserGoal | null) {
      this.draft.goal = goal;
    },
    next() {
      this.step += 1;
      if (this.step > this.persistedStep) this.persistedStep = this.step;
    },
    back() {
      if (this.step > 0) this.step -= 1;
    },
    goTo(step: number) {
      if (step >= 0 && step <= this.persistedStep) this.step = step;
    },
    markPersistedTo(step: number) {
      if (step > this.persistedStep) this.persistedStep = step;
    },
    reset() {
      this.step = 0;
      this.draft = { ...EMPTY_DRAFT };
      this.persistedStep = 0;
    },
  },
});