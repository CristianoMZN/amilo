<template>
  <div
    class="set-input-row"
    :class="{
      'set-input-row--completed': completed,
      'set-input-row--none': defaultUnit === 'none',
    }"
  >
    <div class="set-input-row__position">{{ position }}</div>

    <div class="set-input-row__fields amilio-numeric">
      <q-input
        v-model="repsText"
        type="text"
        inputmode="decimal"
        outlined
        dense
        :placeholder="repsPlaceholder"
        :aria-label="t('workout.session.setRepsLabel')"
        class="set-input-row__reps"
        @blur="onRepsBlur"
      />
      <q-input
        v-model="weightText"
        type="text"
        inputmode="decimal"
        outlined
        dense
        :placeholder="weightPlaceholder"
        :disable="defaultUnit === 'none'"
        :aria-label="t('workout.session.setWeightLabel')"
        class="set-input-row__weight"
        @blur="onWeightBlur"
      >
        <template #append>
          <span class="set-input-row__unit">{{ unitLabel }}</span>
        </template>
      </q-input>
    </div>

    <q-btn
      :flat="!completed"
      :unelevated="completed"
      round
      dense
      :icon="completed ? 'check_circle' : 'radio_button_unchecked'"
      :color="completed ? 'positive' : 'grey-7'"
      :aria-label="completed ? t('workout.session.markUndone') : t('workout.session.markDone')"
      class="set-input-row__check"
      @click="toggle"
    />

    <q-btn
      flat
      round
      dense
      icon="delete_outline"
      color="grey-7"
      :aria-label="t('workout.session.deleteSetCta')"
      class="set-input-row__remove"
      @click="$emit('remove')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ExerciseDefaultUnit, MeasurementSystem } from 'src/domain/types';
import { formatLoad, parseLoadInputToKg } from 'src/domain/measurements';

const props = defineProps<{
  position: number;
  reps: number | null;
  weightKg: number | null;
  measurementSystem: MeasurementSystem;
  defaultUnit: ExerciseDefaultUnit;
  completed: boolean;
  previousReps?: number | undefined;
  previousWeightKg?: number | null | undefined;
}>();

const emit = defineEmits<{
  (e: 'update', payload: { reps: number; weightKg: number | null; completed: boolean }): void;
  (e: 'remove'): void;
}>();

const { t } = useI18n();

const repsText = ref<string>('');
const weightText = ref<string>('');

// Seed the input text from the canonical value or the previous row when
// nothing has been typed yet. We never overwrite user input mid-edit — only
// when the prop changes from outside.
function seed(): void {
  repsText.value = props.reps !== null ? String(props.reps) : '';
  if (props.weightKg !== null) {
    weightText.value = formatLoad(props.weightKg, props.measurementSystem).replace(
      /\s?(kg|lb)$/,
      '',
    );
  } else if (
    props.defaultUnit === 'bodyweight' &&
    props.previousWeightKg !== undefined &&
    props.previousWeightKg !== null
  ) {
    weightText.value = formatLoad(props.previousWeightKg, props.measurementSystem).replace(
      /\s?(kg|lb)$/,
      '',
    );
  } else {
    weightText.value = '';
  }
}

watch(
  () => [props.reps, props.weightKg] as const,
  () => seed(),
  { immediate: true },
);

const unitLabel = computed<string>(() => {
  if (props.defaultUnit === 'none') return '—';
  return props.measurementSystem === 'imperial' ? 'lb' : 'kg';
});

const repsPlaceholder = computed<string>(() => {
  return props.previousReps !== undefined ? String(props.previousReps) : '0';
});

const weightPlaceholder = computed<string>(() => {
  if (props.defaultUnit === 'none') return '—';
  if (props.previousWeightKg !== undefined && props.previousWeightKg !== null) {
    return formatLoad(props.previousWeightKg, props.measurementSystem).replace(/\s?(kg|lb)$/, '');
  }
  return '0';
});

function parseReps(): number | null {
  const trimmed = repsText.value.replace(',', '.').trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function parseWeight(): number | null {
  if (props.defaultUnit === 'none') return null;
  const kg = parseLoadInputToKg(weightText.value, props.measurementSystem);
  if (kg === null) return null;
  return kg < 0 ? null : kg;
}

function commit(): void {
  const reps = parseReps();
  const weightKg = parseWeight();
  emit('update', { reps: reps ?? 0, weightKg, completed: props.completed });
}

function onRepsBlur(): void {
  commit();
}

function onWeightBlur(): void {
  commit();
}

function toggle(): void {
  const reps = parseReps() ?? props.previousReps ?? 0;
  const weightKg = parseWeight() ?? props.weightKg;
  emit('update', { reps, weightKg, completed: !props.completed });
}
</script>

<style lang="scss" scoped>
.set-input-row {
  display: grid;
  grid-template-columns: 28px 1fr 36px 36px;
  gap: 8px;
  align-items: center;
  padding: 8px 4px;
  border-bottom: 1px solid var(--amilio-border);

  &__position {
    font-weight: 700;
    color: var(--amilio-text-secondary);
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  &__fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  &__reps,
  &__weight {
    width: 100%;
  }

  &__unit {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--amilio-text-secondary);
    padding-left: 6px;
  }

  &__check,
  &__remove {
    justify-self: end;
  }

  &--completed {
    background: rgba(34, 197, 94, 0.05);
  }

  &--completed &__position {
    color: var(--positive);
  }

  &--none &__weight {
    opacity: 0.4;
  }
}

.body--dark .set-input-row {
  border-bottom-color: var(--amilio-surface-dark);

  &--completed {
    background: rgba(34, 197, 94, 0.1);
  }
}
</style>
