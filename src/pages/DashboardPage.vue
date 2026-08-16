<template>
  <q-page class="dashboard-page">
    <header class="dashboard-page__header">
      <h1 class="dashboard-page__greeting">
        {{ greetingText }}
        <span v-if="profile?.name" class="dashboard-page__name">, {{ profile.name }}</span>
      </h1>
      <p class="dashboard-page__summary">{{ t('dashboard.summary') }}</p>
    </header>

    <div v-if="loading" class="dashboard-page__loading">
      <q-spinner color="primary" size="32px" />
    </div>

    <template v-else-if="profile">
      <q-banner
        v-if="isDevMode"
        class="dashboard-page__dev"
        rounded
        dense
      >
        <template #avatar>
          <q-icon name="science" color="primary" />
        </template>
        {{ devBanner }}
      </q-banner>

      <section class="dashboard-page__grid">
        <StatCard
          :label="t('dashboard.currentWeight')"
          :value="currentWeightDisplay"
          accent="yellow"
        />
        <StatCard
          :label="t('dashboard.basalMetabolism')"
          :value="basalMetabolismDisplay"
          accent="graphite"
        />
        <StatCard
          :label="t('dashboard.dailyExpenditure')"
          :value="dailyExpenditureDisplay"
          accent="graphite"
        />
        <StatCard
          :label="t('dashboard.goal')"
          :value="goalDisplay"
          accent="graphite"
        />
        <StatCard
          :label="t('dashboard.activity')"
          :value="activityDisplay"
          accent="graphite"
        />
      </section>

      <q-banner class="dashboard-page__notice" rounded>
        <template #avatar>
          <q-icon name="auto_awesome" color="primary" />
        </template>
        {{ t('dashboard.placeholderNotice') }}
      </q-banner>
    </template>

    <q-card v-else flat class="dashboard-page__empty">
      <q-card-section class="dashboard-page__empty-section">
        <q-icon name="person_add" size="40px" color="primary" />
        <div class="dashboard-page__empty-title">{{ emptyTitle }}</div>
        <div class="dashboard-page__empty-subtitle">{{ emptySubtitle }}</div>
        <q-btn
          unelevated
          color="primary"
          text-color="black"
          no-caps
          size="lg"
          class="amilio-touch dashboard-page__empty-cta"
          :label="t('common.continue')"
          to="/onboarding"
        />
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAppStore } from 'src/stores/app';
import { findProfile } from 'src/repositories/userProfile';
import { findPreferences } from 'src/repositories/userPreferences';
import { getDatabase } from 'src/database/database';
import { estimateTdee } from 'src/domain/age';
import { roundKcal } from 'src/domain/metabolism';
import { formatWeight } from 'src/domain/measurements';
import type { UserProfile, UserPreferences, ActivityLevel, UserGoal } from 'src/domain/types';

/**
 * The dashboard reads everything from SQLite inside `onMounted`. The dev
 * stub is signal-gated by `import.meta.env.DEV` — the spec deliberately
 * avoids importing `databaseIsNative` so the dashboard is decoupled from
 * the database module's surface (it's also available in unit tests).
 */
const DEV_BADGE = 'Dev mode — in-memory data';

const { t } = useI18n();
const appStore = useAppStore();

const loading = ref<boolean>(true);
const profile = ref<UserProfile | null>(null);
const prefs = ref<UserPreferences | null>(null);
const errorMessage = ref<string | null>(null);

const isDevMode = computed<boolean>(() => import.meta.env.DEV);

async function refresh(): Promise<void> {
  loading.value = true;
  errorMessage.value = null;
  try {
    const conn = await getDatabase();
    const [loadedProfile, loadedPrefs] = await Promise.all([
      findProfile(conn),
      findPreferences(conn),
    ]);
    profile.value = loadedProfile;
    prefs.value = loadedPrefs;
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  } finally {
    loading.value = false;
  }
}

onMounted(refresh);

/**
 * Pick a greeting based on the user's local time. `Intl.DateTimeFormat` is
 * only used to pick the hour in the user's resolved timezone; the strings
 * themselves come from the locale file.
 */
const greetingText = computed<string>(() => {
  if (typeof Date !== 'function') return t('dashboard.greetingMorning');
  const hour = new Date().getHours();
  if (hour < 5) return t('dashboard.greetingNight');
  if (hour < 12) return t('dashboard.greetingMorning');
  if (hour < 18) return t('dashboard.greetingAfternoon');
  if (hour < 22) return t('dashboard.greetingEvening');
  return t('dashboard.greetingNight');
});

const currentWeightDisplay = computed<string>(() => {
  if (!profile.value) return '';
  return formatWeight(profile.value.weightKg, appStore.measurementSystem, 1);
});

const estimate = computed(() => {
  if (!profile.value) return null;
  const p = profile.value;
  return estimateTdee({
    sex: p.sex,
    weightKg: p.weightKg,
    heightCm: p.heightCm,
    birthDateIso: p.birthDate,
    activity: p.activity,
  });
});

const basalMetabolismDisplay = computed<string>(() => {
  if (!estimate.value) return '—';
  return `${roundKcal(estimate.value.bmrKcal)} kcal`;
});

const dailyExpenditureDisplay = computed<string>(() => {
  if (!estimate.value) return '—';
  return `${roundKcal(estimate.value.tdeeKcal)} kcal`;
});

const goalDisplay = computed<string>(() => {
  const goal: UserGoal | null = profile.value?.goal ?? null;
  if (!goal) return '';
  return t(`goals.${goal}`);
});

const activityDisplay = computed<string>(() => {
  const level: ActivityLevel | null = profile.value?.activity ?? null;
  if (!level) return '';
  return t(`activityShort.${level}`);
});

const devBanner = DEV_BADGE;

const emptyTitle = computed<string>(() => {
  const name = profile.value?.name ?? '';
  void name;
  return t('app.tagline');
});

const emptySubtitle = computed<string>(() => {
  // Reuse the placeholder notice copy for the empty state — it already
  // frames the dashboard as a place where things *will* land in upcoming
  // sprints, which doubles nicely as an invite to finish onboarding.
  void prefs.value;
  return t('onboarding.welcome.title');
});
</script>

<style lang="scss" scoped>
.dashboard-page {
  // Bottom padding: the layout container already accounts for the 56px
  // tab bar and the safe-area-inset-bottom; only a small breathing gap
  // is left here so the last card does not feel cramped.
  padding: 20px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: var(--amilio-bg-light);
  color: var(--amilio-text-dark);

  &__header {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__greeting {
    font-size: 1.6rem;
    font-weight: 800;
    margin: 0;
    letter-spacing: -0.02em;
  }

  &__name {
    color: var(--amilio-text-dark);
  }

  &__summary {
    margin: 0;
    font-size: 0.9rem;
    color: var(--amilio-text-secondary);
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  &__loading {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 240px;
  }

  &__dev {
    background: rgba(234, 179, 8, 0.08);
    color: var(--amilio-text-dark);
  }

  &__notice {
    background: var(--amilio-graphite);
    color: var(--amilio-text-light);
    border-radius: 16px;
  }

  &__empty {
    border-radius: 20px;
    background: var(--amilio-graphite);
    color: var(--amilio-text-light);
    border: 1px solid var(--amilio-surface-dark);
    margin-top: 8px;
  }

  &__empty-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 32px 24px;
  }

  &__empty-title {
    font-weight: 700;
    font-size: 1.1rem;
    text-align: center;
    color: var(--amilio-text-light);
  }

  &__empty-subtitle {
    font-size: 0.9rem;
    color: var(--amilio-text-secondary);
    text-align: center;
    max-width: 32ch;
  }

  &__empty-cta {
    margin-top: 4px;
    width: 100%;
  }
}

.body--dark .dashboard-page {
  background: var(--amilio-black);
  color: var(--amilio-text-light);

  &__name {
    color: var(--amilio-yellow-primary);
  }

  &__dev {
    background: rgba(234, 179, 8, 0.12);
    color: var(--amilio-text-light);
  }
}
</style>
