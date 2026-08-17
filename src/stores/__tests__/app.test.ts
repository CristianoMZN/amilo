import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAppStore, useOnboardingStore } from 'src/stores/app';

/**
 * The app store + onboarding store live in memory; SQLite persistence is the
 * repositories' job, which these tests do not exercise. We only test the
 * reactive contract the UI relies on.
 */
describe('app store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with sensible defaults', () => {
    const store = useAppStore();
    expect(store.locale).toBe('en');
    expect(store.theme).toBe('system');
    expect(store.measurementSystem).toBe('metric');
    expect(store.databaseReady).toBe(false);
    expect(store.databaseError).toBeNull();
  });

  it('updates locale and persists it', () => {
    const store = useAppStore();
    store.setLocale('pt-BR');
    expect(store.locale).toBe('pt-BR');
    expect(store.persistedLocale).toBe('pt-BR');
  });

  it('tracks database readiness transitions', () => {
    const store = useAppStore();
    store.markDatabaseReady();
    expect(store.databaseReady).toBe(true);
    store.markDatabaseError(new Error('boom'));
    expect(store.databaseReady).toBe(false);
    expect(store.databaseError).toBeInstanceOf(Error);
  });
});

describe('onboarding store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('starts with an empty draft and step 0', () => {
    const store = useOnboardingStore();
    expect(store.step).toBe(0);
    expect(store.persistedStep).toBe(0);
    expect(store.isComplete).toBe(false);
  });

  it('moves forward only up to the persisted step', () => {
    const store = useOnboardingStore();
    store.next();
    expect(store.step).toBe(1);
    expect(store.persistedStep).toBe(1);
    store.goTo(0);
    expect(store.step).toBe(0);
    store.goTo(5); // not yet persisted
    expect(store.step).toBe(0);
  });

  it('isComplete is true only when every field is present', () => {
    const store = useOnboardingStore();
    store.setName('Ana');
    store.setBirthDate('1990-06-15');
    store.setSex('female');
    store.setHeightCm(165);
    store.setWeightKg(60);
    store.setActivity('moderately_active');
    expect(store.isComplete).toBe(false);
    store.setGoal('maintain');
    expect(store.isComplete).toBe(true);
  });

  it('reset wipes the draft and step', () => {
    const store = useOnboardingStore();
    store.setName('Ana');
    store.next();
    store.reset();
    expect(store.step).toBe(0);
    expect(store.draft.name).toBe('');
    expect(store.isComplete).toBe(false);
  });
});
