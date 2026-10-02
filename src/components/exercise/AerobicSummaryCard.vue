<template>
  <q-card flat class="aerobic-summary-card">
    <q-card-section class="aerobic-summary-card__section">
      <header class="aerobic-summary-card__head">
        <div class="aerobic-summary-card__title">{{ t('exercise.page.todayAerobic') }}</div>
        <q-btn
          unelevated
          round
          color="primary"
          text-color="black"
          size="sm"
          icon="add"
          class="aerobic-summary-card__fab"
          :aria-label="t('exercise.page.recordAerobicCta')"
          @click="$emit('record')"
        />
      </header>

      <ul v-if="activities.length" class="aerobic-summary-card__list">
        <li
          v-for="entry in activities"
          :key="entry.activity.id"
          class="aerobic-summary-card__item"
          @click="$emit('edit', entry)"
        >
          <div class="aerobic-summary-card__item-main">
            <span class="aerobic-summary-card__item-name">{{ entry.exerciseName }}</span>
            <span
              v-if="entry.exerciseOrigin === 'deleted'"
              class="aerobic-summary-card__item-tag aerobic-summary-card__item-tag--deleted"
            >
              {{ t('workout.manage.exerciseNameFallback') }}
            </span>
            <span
              v-else-if="entry.exerciseOrigin === 'custom'"
              class="aerobic-summary-card__item-tag aerobic-summary-card__item-tag--custom"
            >
              {{ t('exercise.origin.custom') }}
            </span>
          </div>
          <div class="aerobic-summary-card__item-meta amilio-numeric">
            <span class="aerobic-summary-card__item-duration">
              {{ formatDurationMinutes(entry.activity.durationMinutes) }}
            </span>
            <span class="aerobic-summary-card__item-kcal">
              {{ formatKcalCompact(entry.activity.kcalEstimated, locale) }}
              <span class="aerobic-summary-card__item-kcal-unit">kcal</span>
            </span>
          </div>
          <q-btn
            flat
            round
            dense
            icon="delete_outline"
            size="sm"
            class="aerobic-summary-card__item-remove"
            :aria-label="t('exercise.aerobic.delete')"
            @click.stop="$emit('delete', entry)"
          />
        </li>
      </ul>

      <div v-else class="aerobic-summary-card__empty">
        {{ t('exercise.page.noAerobicToday') }}
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { MeasurementSystem, SupportedLocale } from 'src/domain/types';
import { formatKcalCompact } from 'src/domain/aerobic';

interface AerobicEntry {
  activity: {
    id: number;
    exerciseId: string | null;
    exerciseNameSnapshot: string;
    durationMinutes: number;
    kcalEstimated: number;
    kcalPerHourSnapshot: number;
  };
  exerciseName: string;
  exerciseOrigin: 'official' | 'custom' | 'deleted';
}

defineProps<{
  activities: ReadonlyArray<AerobicEntry>;
  measurementSystem: MeasurementSystem;
  locale: SupportedLocale;
}>();

defineEmits<{
  (e: 'record'): void;
  (e: 'edit', entry: AerobicEntry): void;
  (e: 'delete', entry: AerobicEntry): void;
}>();

const { t } = useI18n();

/**
 * Render a duration as a compact user-facing string.
 *
 *  - Whole minutes render as `"30 min"`.
 *  - Sub-minute durations (when the caller really wants them) render as
 *    `"0.5 min"`.
 *
 * The measurement-system parameter is reserved for future imperial-time
 * support — Amilo currently always renders aerobic durations in minutes.
 */
function formatDurationMinutes(minutes: number): string {
  const safe = Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
  const rounded = Math.round(safe * 10) / 10;
  const isWhole = Math.abs(rounded - Math.round(rounded)) < 0.001;
  const text = isWhole ? String(Math.round(rounded)) : String(rounded);
  return `${text} ${t('units.min')}`;
}
</script>

<style lang="scss" scoped>
.aerobic-summary-card {
  background: var(--amilio-white);
  border: 1px solid var(--amilio-border);
  border-radius: 18px;

  &__section {
    padding: 16px;
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  &__title {
    flex: 1;
    font-weight: 700;
    font-size: 1.05rem;
  }

  &__fab {
    box-shadow: 0 2px 8px rgba(20, 184, 166, 0.25);
  }

  &__list {
    list-style: none;
    margin: 12px 0 0;
    padding: 0;
  }

  &__item {
    display: grid;
    grid-template-columns: 1fr auto 28px;
    gap: 10px;
    align-items: center;
    padding: 10px 0;
    border-top: 1px solid var(--amilio-border);
    cursor: pointer;
    transition: background 100ms;
  }

  &__item:hover {
    background: rgba(20, 184, 166, 0.04);
  }

  &__item-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__item-name {
    font-weight: 600;
  }

  &__item-tag {
    align-self: flex-start;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--amilio-bg-light);
    color: var(--amilio-text-secondary);
    border: 1px solid var(--amilio-border);
  }

  &__item-tag--custom {
    background: rgba(168, 85, 247, 0.08);
    color: var(--amilio-violet-strong);
    border-color: transparent;
  }

  &__item-tag--deleted {
    background: rgba(239, 68, 68, 0.08);
    color: var(--negative);
    border-color: transparent;
  }

  &__item-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    font-size: 0.85rem;
    color: var(--amilio-text-secondary);
  }

  &__item-duration {
    font-weight: 600;
  }

  &__item-kcal {
    font-weight: 700;
    color: var(--amilio-orange-strong);
  }

  &__item-kcal-unit {
    margin-left: 2px;
    font-size: 0.7rem;
    font-weight: 600;
  }

  &__item-remove {
    color: var(--amilio-text-secondary);
    opacity: 0;
    transition: opacity 100ms;
  }

  &__item:hover &__item-remove {
    opacity: 1;
  }

  &__empty {
    text-align: center;
    color: var(--amilio-text-secondary);
    padding: 24px 8px;
    font-size: 0.9rem;
    border-top: 1px solid var(--amilio-border);
    margin-top: 12px;
  }
}

.body--dark .aerobic-summary-card {
  background: var(--amilio-graphite);
  border: 1px solid var(--amilio-surface-dark);

  &__item {
    border-top: 1px solid var(--amilio-surface-dark);
  }

  &__item:hover {
    background: rgba(20, 184, 166, 0.08);
  }

  &__item-tag {
    background: var(--amilio-surface-dark);
    color: var(--amilio-text-light);
    border-color: var(--amilio-border);
  }

  &__item-tag--custom {
    background: rgba(168, 85, 247, 0.18);
    color: var(--amilio-violet);
  }

  &__item-tag--deleted {
    background: rgba(239, 68, 68, 0.18);
    color: var(--negative);
  }

  &__item-kcal {
    color: var(--amilio-orange);
  }
}
</style>
