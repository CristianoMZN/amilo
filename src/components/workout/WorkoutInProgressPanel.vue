<template>
  <section class="workout-in-progress-panel">
    <header class="workout-in-progress-panel__head">
      <div class="workout-in-progress-panel__status">
        {{ t('workout.session.inProgressBanner') }}
      </div>
      <h2 class="workout-in-progress-panel__title">
        {{ performed.performedWorkout.sheetNameSnapshot }}
        <span class="workout-in-progress-panel__divider">·</span>
        <span class="workout-in-progress-panel__session">
          {{ performed.performedWorkout.sessionNameSnapshot }}
        </span>
      </h2>
      <div class="workout-in-progress-panel__meta">
        {{ formatStartedAt(performed.performedWorkout.startedAt) }}
      </div>
    </header>

    <div v-if="!performed.exercises.length" class="workout-in-progress-panel__hint">
      {{ t('workout.session.noExercisesHint') }}
    </div>

    <q-expansion-item
      v-for="entry in performed.exercises"
      :key="entry.performedExercise.id"
      :model-value="isExpanded(entry.performedExercise.id)"
      class="workout-in-progress-panel__exercise"
      :default-opened="true"
      @update:model-value="(v: boolean) => toggleExpanded(entry.performedExercise.id, v)"
    >
      <template #header>
        <q-item-section>
          <q-item-label class="workout-in-progress-panel__exercise-name">
            {{ entry.exercise?.name ?? entry.performedExercise.exerciseNameSnapshot }}
          </q-item-label>
          <q-item-label caption class="workout-in-progress-panel__exercise-sets">
            {{ entry.sets.length }}
            {{ entry.sets.length === 1 ? t('units.set') : t('units.sets') }}
          </q-item-label>
        </q-item-section>
      </template>

      <div class="workout-in-progress-panel__exercise-body">
        <ExerciseHistoryCard
          v-if="
            entry.performedExercise.exerciseId !== null &&
            comparisonByExercise[entry.performedExercise.exerciseId]
          "
          :exercise-id="entry.performedExercise.exerciseId"
          :comparison="comparisonByExercise[entry.performedExercise.exerciseId]!"
          :measurement-system="measurementSystem"
          :locale="locale"
          :exercise-name="entry.exercise?.name ?? entry.performedExercise.exerciseNameSnapshot"
          class="workout-in-progress-panel__history"
        />

        <div class="workout-in-progress-panel__sets">
          <SetInputRow
            v-for="(set, idx) in entry.sets"
            :key="set.id"
            :position="idx + 1"
            :reps="set.reps"
            :weight-kg="set.weightKg"
            :measurement-system="measurementSystem"
            :default-unit="entry.exercise?.defaultUnit ?? 'none'"
            :completed="set.completed"
            :previous-reps="previousRepsFor(entry, idx)"
            :previous-weight-kg="previousWeightFor(entry, idx)"
            @update="(payload) => $emit('updateSet', set.id, payload)"
            @remove="$emit('deleteSet', set.id)"
          />
        </div>

        <q-btn
          flat
          no-caps
          color="primary"
          :label="t('workout.session.addSetCta')"
          icon-right="add"
          class="workout-in-progress-panel__add-set"
          @click="onAddSet(entry.performedExercise.id)"
        />
      </div>
    </q-expansion-item>

    <div class="workout-in-progress-panel__actions">
      <q-btn
        flat
        no-caps
        color="primary"
        :label="t('workout.manage.addExerciseCta')"
        icon-right="add"
        class="workout-in-progress-panel__add-exercise"
        @click="$emit('addExercise')"
      />
      <q-space />
      <q-btn
        flat
        no-caps
        color="negative"
        :label="t('workout.session.abandonCta')"
        class="workout-in-progress-panel__abandon"
        @click="$emit('abandon')"
      />
      <q-btn
        unelevated
        color="primary"
        text-color="black"
        no-caps
        class="amilio-touch workout-in-progress-panel__finish"
        :label="t('workout.session.finishCta')"
        @click="$emit('finish')"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import type {
  ExerciseDefaultUnit,
  MeasurementSystem,
  MuscleGroup,
  SupportedLocale,
} from 'src/domain/types';
import { formatLocalDateLong } from 'src/util/dateDay';

import ExerciseHistoryCard from '../exercise/ExerciseHistoryCard.vue';
import SetInputRow from '../exercise/SetInputRow.vue';

interface SetRow {
  id: number;
  position: number;
  reps: number;
  weightKg: number | null;
  completed: boolean;
}

interface ExerciseRow {
  performedExercise: {
    id: number;
    exerciseId: string | null;
    exerciseNameSnapshot: string;
    muscleGroupSnapshot: MuscleGroup | null;
    position: number;
  };
  exercise: { id: string; defaultUnit: ExerciseDefaultUnit; name: string } | null;
  sets: SetRow[];
}

interface PerformedLite {
  performedWorkout: {
    id: number;
    sheetNameSnapshot: string;
    sessionNameSnapshot: string;
    status: 'in_progress' | 'completed' | 'abandoned';
    startedAt: string;
    finishedAt: string | null;
  };
  exercises: ExerciseRow[];
}

interface ComparisonLite {
  previousSets: Array<{ reps: number; weightKg: number | null }> | null;
  recordWeightKg: number | null;
  recordWeightReps: number | null;
  progression: {
    weightDeltaKg: number | null;
    repsDelta: number | null;
    volumeDeltaKg: number | null;
  };
}

const props = defineProps<{
  performed: PerformedLite;
  measurementSystem: MeasurementSystem;
  locale: SupportedLocale;
  comparisonByExercise: Record<string, ComparisonLite>;
}>();

const emit = defineEmits<{
  (
    e: 'recordSet',
    performedExerciseId: number,
    payload: { reps: number; weightKg: number | null },
  ): void;
  (
    e: 'updateSet',
    setId: number,
    payload: { reps: number; weightKg: number | null; completed: boolean },
  ): void;
  (e: 'deleteSet', setId: number): void;
  (e: 'addExercise'): void;
  (e: 'finish'): void;
  (e: 'abandon'): void;
}>();

const { t } = useI18n();

// `expandedIds` is a reactive Set keyed by `performedExercise.id`. The
// template re-reads `.has(...)` on every render; Vue 3 keeps Set mutations
// reactive, so toggling via `update:model-value` flows through the wrapper
// below without manual bookkeeping.
const expandedIds = reactive<Set<number>>(new Set<number>());

function toggleExpanded(id: number, value: boolean): void {
  if (value) {
    expandedIds.add(id);
  } else {
    expandedIds.delete(id);
  }
}

function isExpanded(id: number): boolean {
  return expandedIds.has(id);
}

function previousRepsFor(entry: ExerciseRow, idx: number): number | undefined {
  if (entry.performedExercise.exerciseId === null) return undefined;
  const cmp = props.comparisonByExercise[entry.performedExercise.exerciseId];
  if (!cmp || !cmp.previousSets) return undefined;
  const prev = cmp.previousSets[idx];
  return prev ? prev.reps : undefined;
}

function previousWeightFor(entry: ExerciseRow, idx: number): number | null | undefined {
  if (entry.performedExercise.exerciseId === null) return undefined;
  const cmp = props.comparisonByExercise[entry.performedExercise.exerciseId];
  if (!cmp || !cmp.previousSets) return undefined;
  const prev = cmp.previousSets[idx];
  return prev ? prev.weightKg : undefined;
}

function onAddSet(performedExerciseId: number): void {
  const entry = props.performed.exercises.find(
    (e) => e.performedExercise.id === performedExerciseId,
  );
  const lastSet = entry?.sets[entry.sets.length - 1];
  emit('recordSet', performedExerciseId, {
    reps: lastSet?.reps ?? 0,
    weightKg: lastSet?.weightKg ?? null,
  });
}

function formatStartedAt(iso: string): string {
  // `startedAt` is a full ISO timestamp, but we only render the date part
  // here — the time is implicit ("started today"). Pull the `YYYY-MM-DD`
  // prefix and route through the shared long-form formatter.
  const dateOnly = iso.slice(0, 10);
  return formatLocalDateLong(dateOnly, props.locale);
}
</script>

<style lang="scss" scoped>
.workout-in-progress-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &__head {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px 4px 0;
  }

  &__status {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--amilio-violet-strong);
  }

  &__title {
    font-size: 1.15rem;
    font-weight: 700;
    margin: 0;
    color: var(--amilio-text-dark);
  }

  &__divider {
    margin: 0 6px;
    color: var(--amilio-text-secondary);
    font-weight: 400;
  }

  &__session {
    font-weight: 500;
    color: var(--amilio-text-secondary);
  }

  &__meta {
    font-size: 0.78rem;
    color: var(--amilio-text-secondary);
  }

  &__hint {
    text-align: center;
    color: var(--amilio-text-secondary);
    padding: 24px 8px;
    font-size: 0.9rem;
    border: 1px dashed var(--amilio-border);
    border-radius: 14px;
  }

  &__exercise {
    background: var(--amilio-white);
    border: 1px solid var(--amilio-border);
    border-radius: 14px;
    overflow: hidden;
  }

  &__exercise-name {
    font-weight: 700;
  }

  &__exercise-sets {
    font-size: 0.78rem;
    color: var(--amilio-text-secondary);
  }

  &__exercise-body {
    padding: 8px 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-top: 1px solid var(--amilio-border);
  }

  &__history {
    margin-top: 4px;
  }

  &__sets {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__add-set {
    align-self: flex-start;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 4px 12px;
    border-top: 1px solid var(--amilio-border);
  }

  &__abandon {
    margin-right: 4px;
  }
}

.body--dark .workout-in-progress-panel {
  &__title {
    color: var(--amilio-text-light);
  }

  &__status {
    color: var(--amilio-violet);
  }

  &__hint {
    border-color: var(--amilio-surface-dark);
  }

  &__exercise {
    background: var(--amilio-graphite);
    border-color: var(--amilio-surface-dark);
  }

  &__exercise-body {
    border-top-color: var(--amilio-surface-dark);
  }

  &__actions {
    border-top-color: var(--amilio-surface-dark);
  }
}
</style>
