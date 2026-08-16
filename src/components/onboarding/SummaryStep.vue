<template>
  <section class="step-summary">
    <header class="step-summary__header">
      <h2 class="step-summary__title">{{ t('onboarding.summary.title') }}</h2>
      <p class="step-summary__subtitle">{{ t('onboarding.summary.subtitle') }}</p>
    </header>

    <div v-if="isComplete" class="step-summary__stats">
      <div class="step-summary__stat">
        <div class="step-summary__stat-label">{{ t('onboarding.summary.weightLabel') }}</div>
        <div class="step-summary__stat-value">{{ weightDisplay }}</div>
      </div>

      <div class="step-summary__stat">
        <div class="step-summary__stat-label">{{ t('onboarding.summary.bmrLabel') }}</div>
        <div class="step-summary__stat-value">{{ bmrKcalDisplay }}</div>
      </div>

      <div class="step-summary__stat">
        <div class="step-summary__stat-label">{{ t('onboarding.summary.tdeeLabel') }}</div>
        <div class="step-summary__stat-value">{{ tdeeKcalDisplay }}</div>
      </div>

      <div class="step-summary__stat">
        <div class="step-summary__stat-label">{{ t('onboarding.summary.goalLabel') }}</div>
        <div class="step-summary__stat-value">{{ goalDisplay }}</div>
      </div>

      <div class="step-summary__stat">
        <div class="step-summary__stat-label">{{ t('onboarding.summary.activityLabel') }}</div>
        <div class="step-summary__stat-value">{{ activityDisplay }}</div>
      </div>
    </div>

    <q-banner
      v-if="persistError"
      class="step-summary__error"
      role="alert"
      rounded
    >
      <template #avatar>
        <q-icon name="error" color="negative" />
      </template>
      {{ persistError }}
    </q-banner>

    <q-btn
      unelevated
      color="primary"
      text-color="black"
      size="lg"
      no-caps
      class="amilio-touch step-summary__cta"
      :label="t('onboarding.summary.finish')"
      :loading="persisting"
      :disable="!isComplete || persisting"
      @click="finish"
    />

    <p class="step-summary__notice">{{ t('onboarding.summary.estimateNotice') }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAppStore, useOnboardingStore } from 'src/stores/app';
import { estimateTdee } from 'src/domain/age';
import { roundKcal } from 'src/domain/metabolism';
import { formatWeight } from 'src/domain/measurements';
import type { ActivityLevel, UserGoal } from 'src/domain/types';
import { findProfile, upsertProfile } from 'src/repositories/userProfile';
import { upsertPreferences } from 'src/repositories/userPreferences';
import { insertWeightEntry } from 'src/repositories/weightEntry';
import { getDatabase } from 'src/database/database';

const emit = defineEmits<{
  back: [];
}>();

const router = useRouter();
const { t } = useI18n();
const appStore = useAppStore();
const onboarding = useOnboardingStore();

const persisting = ref(false);
const persistError = ref<string | null>(null);

const isComplete = computed<boolean>(() => {
  const d = onboarding.draft;
  return (
    d.name.trim().length > 0 &&
    d.birthDate !== null &&
    d.sex !== null &&
    d.heightCm !== null &&
    d.weightKg !== null &&
    d.activity !== null &&
    d.goal !== null
  );
});

const estimate = computed(() => {
  const d = onboarding.draft;
  if (
    d.sex === null ||
    d.heightCm === null ||
    d.weightKg === null ||
    d.birthDate === null ||
    d.activity === null
  ) {
    return null;
  }
  return estimateTdee({
    sex: d.sex,
    weightKg: d.weightKg,
    heightCm: d.heightCm,
    birthDateIso: d.birthDate,
    activity: d.activity,
  });
});

const weightDisplay = computed(() => {
  const kg = onboarding.draft.weightKg;
  if (kg === null) return '';
  return formatWeight(kg, appStore.measurementSystem, 1);
});

const bmrKcalDisplay = computed(() =>
  estimate.value ? `${roundKcal(estimate.value.bmrKcal)} kcal` : '—',
);

const tdeeKcalDisplay = computed(() =>
  estimate.value ? `${roundKcal(estimate.value.tdeeKcal)} kcal` : '—',
);

const goalDisplay = computed<string>(() => {
  const goal: UserGoal | null = onboarding.draft.goal;
  if (!goal) return '';
  return t(`goals.${goal}`);
});

const activityDisplay = computed<string>(() => {
  const level: ActivityLevel | null = onboarding.draft.activity;
  if (!level) return '';
  // activityShort keys use the same names as the activityLevel enum values.
  return t(`activityShort.${level}`);
});

async function finish(): Promise<void> {
  if (!isComplete.value || persisting.value) return;

  const draft = onboarding.draft;
  if (
    draft.birthDate === null ||
    draft.sex === null ||
    draft.heightCm === null ||
    draft.weightKg === null ||
    draft.activity === null ||
    draft.goal === null
  ) {
    return;
  }

  persisting.value = true;
  persistError.value = null;

  try {
    const conn = await getDatabase();
    const now = new Date().toISOString();

    const profile = {
      id: 1 as const,
      name: draft.name.trim(),
      birthDate: draft.birthDate,
      sex: draft.sex,
      heightCm: draft.heightCm,
      weightKg: draft.weightKg,
      activity: draft.activity,
      goal: draft.goal,
      createdAt: now,
      updatedAt: now,
    };

    const prefs = {
      id: 1 as const,
      locale: appStore.locale,
      measurementSystem: appStore.measurementSystem,
      theme: appStore.theme,
      onboardingCompletedAt: now,
      updatedAt: now,
    };

    // Ensure the existing profile row (if any) is migrated before upsert —
    // the schema uses id=1 as a singleton.
    await findProfile(conn);

    await insertWeightEntry(conn, {
      weightKg: draft.weightKg,
      recordedAt: now,
      source: 'onboarding',
    });

    await upsertProfile(conn, profile);
    await upsertPreferences(conn, prefs);

    // Mark prefs as known so the router guard flips to the dashboard.
    appStore.markDatabaseReady();

    // The router guard reads from SQLite on the next navigation. We also
    // tell the store the locale is persisted so onboardingCompleted flips.
    appStore.setLocale(appStore.locale);

    onboarding.reset();
    void router.replace('/');
  } catch (err) {
    persistError.value =
      err instanceof Error ? err.message : t('common.error');
    persisting.value = false;
  }
}

void emit;
</script>

<style lang="scss" scoped>
.step-summary {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--amilio-text-light);
  flex: 1 1 auto;

  &__header {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__title {
    font-size: 1.4rem;
    font-weight: 700;
    margin: 0;
    letter-spacing: -0.01em;
  }

  &__subtitle {
    font-size: 0.9rem;
    color: var(--amilio-text-secondary);
    margin: 0;
  }

  &__stats {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--amilio-graphite);
    border: 1px solid var(--amilio-surface-dark);
    border-radius: 16px;
    padding: 6px 16px;
  }

  &__stat {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 12px 0;
    border-bottom: 1px solid var(--amilio-surface-dark);

    &:last-child {
      border-bottom: none;
    }
  }

  &__stat-label {
    color: var(--amilio-text-secondary);
    font-size: 0.85rem;
    letter-spacing: 0.01em;
  }

  &__stat-value {
    font-weight: 700;
    font-size: 1.05rem;
    font-variant-numeric: tabular-nums;
  }

  &__notice {
    color: var(--amilio-text-secondary);
    font-size: 0.78rem;
    margin: 0;
    line-height: 1.5;
  }

  &__cta {
    margin-top: 8px;
    width: 100%;
  }

  &__error {
    background: rgba(239, 68, 68, 0.1);
    color: var(--amilio-text-light);
  }
}
</style>
