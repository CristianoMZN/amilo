<template>
  <q-page class="workout-in-progress-page">
    <q-toolbar class="workout-in-progress-page__toolbar">
      <q-btn flat dense round icon="arrow_back" :aria-label="t('common.back')" @click="goBack" />
      <q-toolbar-title class="workout-in-progress-page__title">
        <template v-if="performedLite">
          {{ performedLite.performedWorkout.sheetNameSnapshot }}
          <span class="workout-in-progress-page__divider">·</span>
          {{ performedLite.performedWorkout.sessionNameSnapshot }}
        </template>
      </q-toolbar-title>
      <q-chip
        v-if="performedLite"
        dense
        color="violet"
        text-color="white"
        class="workout-in-progress-page__badge"
      >
        {{ t('workout.history.statusInProgress') }}
      </q-chip>
      <q-btn
        flat
        no-caps
        color="negative"
        :label="t('workout.session.abandonCta')"
        class="workout-in-progress-page__abandon"
        @click="confirmAbandon"
      />
      <q-btn
        unelevated
        no-caps
        color="primary"
        text-color="black"
        class="amilio-touch workout-in-progress-page__finish"
        :label="t('workout.session.finishCta')"
        @click="confirmFinish"
      />
    </q-toolbar>

    <div v-if="loading" class="workout-in-progress-page__loading">
      <q-spinner color="primary" size="32px" />
    </div>

    <q-banner v-else-if="errorMessage" class="workout-in-progress-page__error" rounded>
      <template #avatar>
        <q-icon name="error_outline" color="negative" />
      </template>
      {{ errorMessage }}
    </q-banner>

    <WorkoutInProgressPanel
      v-if="performedLite"
      :performed="performedLite"
      :measurement-system="measurementSystem"
      :locale="locale"
      :comparison-by-exercise="comparisonByExercise"
      @record-set="onRecordSet"
      @update-set="onUpdateSet"
      @delete-set="onDeleteSet"
      @add-exercise="openAddExercise"
      @finish="confirmFinish"
      @abandon="confirmAbandon"
    />

    <!-- Add-exercise picker -->
    <ExerciseSearchSheet
      v-model="strengthSearchOpen"
      kind="strength"
      :locale="locale"
      @select="onStrengthPickExercise"
      @create-custom="onStrengthCreateCustom"
    />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Dialog, Notify } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { useAppStore } from 'src/stores/app';
import { getDatabase } from 'src/database/database';
import { exerciseService } from 'src/services/exercise';
import { workoutService } from 'src/services/workout';
import type { PerformedWorkoutWithDetails, PerformedSetComparison } from 'src/services/workout';
import type { ExerciseDefaultUnit, MuscleGroup, SupportedLocale } from 'src/domain/types';

import WorkoutInProgressPanel from 'components/workout/WorkoutInProgressPanel.vue';
import ExerciseSearchSheet from 'components/exercise/ExerciseSearchSheet.vue';

const props = defineProps<{
  id: string;
}>();

const { t } = useI18n();
const router = useRouter();
const appStore = useAppStore();
const locale = computed<SupportedLocale>(() => appStore.locale);
const measurementSystem = computed(() => appStore.measurementSystem);

const loading = ref<boolean>(true);
const errorMessage = ref<string | null>(null);
const performed = ref<PerformedWorkoutWithDetails | null>(null);
const comparisonByExercise = ref<Record<string, PerformedSetComparison>>({});

/**
 * The `WorkoutInProgressPanel` declares its own slim shape for `performed`
 * — its `exercises[].exercise` is `{id, defaultUnit, name} | null` rather
 * than the full `Exercise` row returned by the service. Project down so the
 * component's prop type matches without us touching Lane 11 components.
 */
interface PerformedLite {
  performedWorkout: {
    id: number;
    sheetNameSnapshot: string;
    sessionNameSnapshot: string;
    status: 'in_progress' | 'completed' | 'abandoned';
    startedAt: string;
    finishedAt: string | null;
  };
  exercises: Array<{
    performedExercise: {
      id: number;
      exerciseId: string | null;
      exerciseNameSnapshot: string;
      muscleGroupSnapshot: MuscleGroup | null;
      position: number;
    };
    exercise: { id: string; defaultUnit: ExerciseDefaultUnit; name: string } | null;
    sets: Array<{
      id: number;
      position: number;
      reps: number;
      weightKg: number | null;
      completed: boolean;
    }>;
  }>;
}

/**
 * Localized name per exercise id, hydrated from the catalog so the panel's
 * `exercise.name` lookup never reads the canonical `Exercise` (which has
 * no `name` field — names live on `exercise_translation`).
 */
const exerciseNameById = ref<Record<string, string>>({});

async function hydrateExerciseNames(executed: PerformedWorkoutWithDetails): Promise<void> {
  const ids = new Set<string>();
  for (const e of executed.exercises) {
    if (e.performedExercise.exerciseId !== null) ids.add(e.performedExercise.exerciseId);
  }
  if (ids.size === 0) {
    exerciseNameById.value = {};
    return;
  }
  const conn = await getDatabase();
  const map: Record<string, string> = {};
  for (const id of ids) {
    try {
      const list = await exerciseService.listExercises(conn, {
        locale: locale.value,
        filter: { query: '' },
      });
      const found = list.find((e) => e.exercise.id === id);
      if (found) map[id] = found.name;
    } catch {
      // Fallback to the snapshot below.
    }
  }
  exerciseNameById.value = map;
}

function projectPerformed(p: PerformedWorkoutWithDetails): PerformedLite {
  return {
    performedWorkout: {
      id: p.performedWorkout.id,
      sheetNameSnapshot: p.performedWorkout.sheetNameSnapshot,
      sessionNameSnapshot: p.performedWorkout.sessionNameSnapshot,
      status: p.performedWorkout.status,
      startedAt: p.performedWorkout.startedAt,
      finishedAt: p.performedWorkout.finishedAt,
    },
    exercises: p.exercises.map((e) => ({
      performedExercise: {
        id: e.performedExercise.id,
        exerciseId: e.performedExercise.exerciseId,
        exerciseNameSnapshot: e.performedExercise.exerciseNameSnapshot,
        muscleGroupSnapshot: e.performedExercise.muscleGroupSnapshot,
        position: e.performedExercise.position,
      },
      exercise: e.exercise
        ? {
            id: e.exercise.id,
            defaultUnit: e.exercise.defaultUnit,
            name: exerciseNameById.value[e.exercise.id] ?? e.performedExercise.exerciseNameSnapshot,
          }
        : null,
      sets: e.sets.map((s) => ({
        id: s.id,
        position: s.position,
        reps: s.reps,
        weightKg: s.weightKg,
        completed: s.completed,
      })),
    })),
  };
}

const performedLite = computed<PerformedLite | null>(() =>
  performed.value ? projectPerformed(performed.value) : null,
);

const strengthSearchOpen = ref<boolean>(false);

const workoutId = computed<number | null>(() => {
  const parsed = Number(props.id);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
});

async function load(): Promise<void> {
  const id = workoutId.value;
  if (id === null) {
    errorMessage.value = t('common.error');
    loading.value = false;
    return;
  }
  loading.value = true;
  errorMessage.value = null;
  try {
    const conn = await getDatabase();
    const result = await workoutService.getPerformedWorkout(conn, id);
    if (!result) {
      // Missing — bounce back to the dashboard.
      Notify.create({
        message: t('common.error'),
        color: 'negative',
        position: 'bottom',
      });
      void router.replace({ name: 'exercise' });
      return;
    }
    if (result.performedWorkout.status !== 'in_progress') {
      // Already finished / abandoned — route to the manage page.
      void router.replace({ name: 'exercise' });
      return;
    }
    performed.value = result;
    await hydrateExerciseNames(result);
    await loadComparisons(result);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  } finally {
    loading.value = false;
  }
}

async function loadComparisons(result: PerformedWorkoutWithDetails): Promise<void> {
  const ids = result.exercises
    .map((e) => e.performedExercise.exerciseId)
    .filter((id): id is string => id !== null);
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) {
    comparisonByExercise.value = {};
    return;
  }
  const conn = await getDatabase();
  const map: Record<string, PerformedSetComparison> = {};
  for (const exId of unique) {
    try {
      map[exId] = await workoutService.getExerciseComparison(conn, {
        exerciseId: exId,
        locale: locale.value,
      });
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : t('common.error');
    }
  }
  comparisonByExercise.value = map;
}

function goBack(): void {
  void router.replace({ name: 'exercise' });
}

async function onRecordSet(
  performedExerciseId: number,
  payload: { reps: number; weightKg: number | null },
): Promise<void> {
  try {
    const conn = await getDatabase();
    await workoutService.recordSet(conn, {
      performedExerciseId,
      reps: payload.reps,
      weightKg: payload.weightKg,
    });
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  }
}

async function onUpdateSet(
  setId: number,
  payload: { reps: number; weightKg: number | null; completed: boolean },
): Promise<void> {
  try {
    const conn = await getDatabase();
    await workoutService.updateSet(conn, {
      id: setId,
      reps: payload.reps,
      weightKg: payload.weightKg,
      completed: payload.completed,
    });
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  }
}

async function onDeleteSet(setId: number): Promise<void> {
  try {
    const conn = await getDatabase();
    await workoutService.deleteSet(conn, setId);
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  }
}

function openAddExercise(): void {
  strengthSearchOpen.value = true;
}

function onStrengthPickExercise(picked: { id: string; name: string }): void {
  const pw = performed.value;
  strengthSearchOpen.value = false;
  if (!pw) return;
  void doAddPerformedExercise(pw.performedWorkout.id, picked);
}

function onStrengthCreateCustom(): void {
  strengthSearchOpen.value = false;
}

async function doAddPerformedExercise(
  performedWorkoutId: number,
  picked: { id: string; name: string },
): Promise<void> {
  try {
    const conn = await getDatabase();
    // Look up the muscle group so the snapshot is accurate; if not found,
    // we pass `null` and let the service / repo decide.
    let muscleGroup: MuscleGroup | null = null;
    try {
      const exercises = await exerciseService.listExercises(conn, {
        locale: locale.value,
        filter: { kind: 'strength', query: '' },
      });
      const found = exercises.find((e) => e.exercise.id === picked.id);
      if (found) {
        muscleGroup = found.exercise.muscleGroup;
      }
    } catch {
      // Ignore — we still add the exercise with a null muscle group.
    }
    await workoutService.addPerformedExercise(conn, {
      performedWorkoutId,
      exerciseId: picked.id,
      exerciseName: picked.name,
      muscleGroup,
    });
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  }
}

function confirmFinish(): void {
  Dialog.create({
    title: t('workout.session.finishCta'),
    message: t('workout.session.finishConfirm'),
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void doFinish();
  });
}

async function doFinish(): Promise<void> {
  const id = workoutId.value;
  if (id === null) return;
  try {
    const conn = await getDatabase();
    await workoutService.finishWorkout(conn, {
      id,
      finishedAt: new Date().toISOString(),
    });
    Notify.create({
      message: t('workout.session.finishCta'),
      color: 'positive',
      position: 'bottom',
      timeout: 1500,
    });
    void router.replace({ name: 'exercise' });
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  }
}

function confirmAbandon(): void {
  Dialog.create({
    title: t('workout.session.abandonCta'),
    message: t('workout.session.abandonConfirm'),
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void doAbandon();
  });
}

async function doAbandon(): Promise<void> {
  const id = workoutId.value;
  if (id === null) return;
  try {
    const conn = await getDatabase();
    await workoutService.abandonWorkout(conn, { id });
    Notify.create({
      message: t('workout.session.abandonCta'),
      color: 'dark',
      position: 'bottom',
      timeout: 1500,
    });
    void router.replace({ name: 'exercise' });
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  }
}

onMounted(load);
watch(() => props.id, load);
watch(locale, () => {
  if (performed.value) {
    void hydrateExerciseNames(performed.value);
    void loadComparisons(performed.value);
  }
});
</script>

<style lang="scss" scoped>
.workout-in-progress-page {
  padding: 0 0 calc(env(safe-area-inset-bottom, 0px) + 96px);
  max-width: 720px;
  margin: 0 auto;
  background: var(--amilio-bg-light);
  color: var(--amilio-text-dark);
  display: flex;
  flex-direction: column;
  gap: 16px;

  &__toolbar {
    background: var(--amilio-white);
    border-bottom: 1px solid var(--amilio-border);
    min-height: 56px;
    padding-inline: 8px;
  }

  &__title {
    font-size: 1.05rem;
    font-weight: 700;
  }

  &__divider {
    margin: 0 6px;
    color: var(--amilio-text-secondary);
    font-weight: 400;
  }

  &__badge {
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  &__abandon {
    margin-right: 4px;
  }

  &__loading {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 160px;
  }

  &__error {
    background: rgba(239, 68, 68, 0.12);
    color: var(--amilio-text-dark);
    margin: 16px;
  }
}

.body--dark .workout-in-progress-page {
  background: var(--amilio-black);
  color: var(--amilio-text-light);

  &__toolbar {
    background: var(--amilio-graphite);
    border-color: var(--amilio-surface-dark);
  }
}
</style>
