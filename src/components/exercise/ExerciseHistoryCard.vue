<template>
  <q-card flat class="exercise-history-card">
    <q-card-section class="exercise-history-card__section">
      <header class="exercise-history-card__head">
        <div class="exercise-history-card__label">
          {{ t('workout.session.previousWorkoutLabel') }}
        </div>
        <div class="exercise-history-card__exercise">{{ exerciseName }}</div>
      </header>

      <div v-if="comparison.previousSets === null" class="exercise-history-card__empty">
        {{ t('workout.session.noPreviousWorkout') }}
      </div>

      <template v-else>
        <table
          v-if="comparison.previousSets.length"
          class="exercise-history-card__table amilio-numeric"
        >
          <thead>
            <tr>
              <th class="exercise-history-card__th">#</th>
              <th class="exercise-history-card__th">{{ t('workout.session.setWeightLabel') }}</th>
              <th class="exercise-history-card__th">{{ t('workout.session.setRepsLabel') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(set, idx) in comparison.previousSets"
              :key="idx"
              class="exercise-history-card__row"
            >
              <td>{{ idx + 1 }}</td>
              <td>{{ formatSetWeight(set.weightKg) }}</td>
              <td>{{ set.reps }}</td>
            </tr>
          </tbody>
        </table>

        <div v-if="recordLabel" class="exercise-history-card__record">
          <q-icon name="emoji_events" size="18px" class="exercise-history-card__record-icon" />
          <span class="exercise-history-card__record-label">{{
            t('workout.session.recordLabel')
          }}</span>
          <span class="exercise-history-card__record-value amilio-numeric">
            {{ recordLabel }}
          </span>
        </div>

        <div class="exercise-history-card__deltas">
          <q-chip
            v-if="comparison.progression.weightDeltaKg !== null"
            dense
            :color="deltaColor(comparison.progression.weightDeltaKg)"
            :text-color="deltaTextColor(comparison.progression.weightDeltaKg)"
            class="exercise-history-card__delta amilio-numeric"
            icon-right="fitness_center"
          >
            {{ formatDeltaWeight(comparison.progression.weightDeltaKg) }}
          </q-chip>
          <q-chip
            v-if="comparison.progression.repsDelta !== null"
            dense
            :color="deltaColor(comparison.progression.repsDelta)"
            :text-color="deltaTextColor(comparison.progression.repsDelta)"
            class="exercise-history-card__delta amilio-numeric"
          >
            {{ formatDeltaReps(comparison.progression.repsDelta) }}
          </q-chip>
          <q-chip
            v-if="comparison.progression.volumeDeltaKg !== null"
            dense
            :color="deltaColor(comparison.progression.volumeDeltaKg)"
            :text-color="deltaTextColor(comparison.progression.volumeDeltaKg)"
            class="exercise-history-card__delta amilio-numeric"
          >
            {{ formatDeltaVolume(comparison.progression.volumeDeltaKg) }}
          </q-chip>
        </div>
      </template>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { MeasurementSystem, SupportedLocale } from 'src/domain/types';
import { formatLoad } from 'src/domain/measurements';
import { formatNumber } from 'src/util/format';

interface PreviousSet {
  reps: number;
  weightKg: number | null;
}

interface Comparison {
  previousSets: ReadonlyArray<PreviousSet> | null;
  recordWeightKg: number | null;
  recordWeightReps: number | null;
  progression: {
    weightDeltaKg: number | null;
    repsDelta: number | null;
    volumeDeltaKg: number | null;
  };
}

const props = defineProps<{
  exerciseId: string;
  comparison: Comparison;
  measurementSystem: MeasurementSystem;
  locale: SupportedLocale;
  exerciseName: string;
}>();

void props.exerciseId; // available to the parent for context; rendered via exerciseName.

const { t } = useI18n();

const recordLabel = computed<string | null>(() => {
  if (props.comparison.recordWeightKg === null) return null;
  const reps = props.comparison.recordWeightReps;
  if (reps === null) return formatLoad(props.comparison.recordWeightKg, props.measurementSystem);
  return `${formatLoad(props.comparison.recordWeightKg, props.measurementSystem)} × ${reps}`;
});

function formatSetWeight(kg: number | null): string {
  return formatLoad(kg, props.measurementSystem);
}

function formatDeltaWeight(kg: number): string {
  if (kg === 0) return '±0 kg';
  const sign = kg > 0 ? '+' : '';
  // Convert the delta into the user's preferred unit so imperial users
  // see "lb" deltas, not "kg" deltas.
  if (props.measurementSystem === 'imperial') {
    const lb = kg / 0.45359237;
    const rounded = Math.round(lb * 10) / 10;
    return `${sign}${formatNumber(rounded, props.locale, 1)} lb`;
  }
  const rounded = Math.round(kg * 10) / 10;
  return `${sign}${formatNumber(rounded, props.locale, 1)} kg`;
}

function formatDeltaReps(reps: number): string {
  if (reps === 0) return '±0 reps';
  const sign = reps > 0 ? '+' : '';
  return `${sign}${reps} reps`;
}

function formatDeltaVolume(kg: number): string {
  if (kg === 0) return '±0 vol';
  const sign = kg > 0 ? '+' : '';
  if (props.measurementSystem === 'imperial') {
    const lb = kg / 0.45359237;
    const rounded = Math.round(lb);
    return `${sign}${rounded} lb vol`;
  }
  const rounded = Math.round(kg);
  return `${sign}${rounded} kg vol`;
}

function deltaColor(value: number): string {
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return 'grey-4';
}

function deltaTextColor(value: number): string {
  if (value === 0) return 'dark';
  return 'white';
}
</script>

<style lang="scss" scoped>
.exercise-history-card {
  background: var(--amilio-white);
  border: 1px solid var(--amilio-border);
  border-radius: 14px;

  &__section {
    padding: 14px 16px;
  }

  &__head {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 8px;
  }

  &__label {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--amilio-text-secondary);
  }

  &__exercise {
    font-weight: 700;
    font-size: 1rem;
  }

  &__empty {
    color: var(--amilio-text-secondary);
    font-size: 0.9rem;
    padding: 12px 0;
  }

  &__table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 4px;
  }

  &__th {
    text-align: left;
    font-weight: 600;
    font-size: 0.78rem;
    color: var(--amilio-text-secondary);
    padding: 6px 8px 6px 0;
    border-bottom: 1px solid var(--amilio-border);
  }

  &__row td {
    padding: 6px 8px 6px 0;
    font-size: 0.9rem;
    border-bottom: 1px solid var(--amilio-border);
  }

  &__row:last-child td {
    border-bottom: none;
  }

  &__record {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(168, 85, 247, 0.08);
    color: var(--amilio-violet-strong);
    align-self: flex-start;
    width: fit-content;
  }

  &__record-icon {
    color: var(--amilio-violet-strong);
  }

  &__record-label {
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  &__record-value {
    font-weight: 700;
    font-size: 0.9rem;
  }

  &__deltas {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
  }

  &__delta {
    font-weight: 700;
  }
}

.body--dark .exercise-history-card {
  background: var(--amilio-graphite);
  border: 1px solid var(--amilio-surface-dark);

  &__th,
  &__row td {
    border-bottom-color: var(--amilio-surface-dark);
  }

  &__record {
    background: rgba(168, 85, 247, 0.18);
    color: var(--amilio-violet);
  }

  &__record-icon {
    color: var(--amilio-violet);
  }
}
</style>
