<template>
  <q-dialog
    v-model="open"
    position="bottom"
    seamless
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
  >
    <q-card class="aerobic-form-sheet">
      <q-card-section class="aerobic-form-sheet__head">
        <div class="aerobic-form-sheet__title">
          <template v-if="editingActivity">{{ t('exercise.aerobic.edit') }}</template>
          <template v-else>{{ t('exercise.aerobic.addSheetTitle') }}</template>
        </div>
        <q-btn flat round dense icon="close" v-close-popup @click="reset" />
      </q-card-section>

      <q-card-section class="aerobic-form-sheet__body">
        <q-btn
          unelevated
          color="primary"
          text-color="black"
          no-caps
          class="amilio-touch aerobic-form-sheet__exercise-btn"
          :label="exerciseName ?? t('exercise.aerobic.exerciseLabel')"
          icon-right="search"
          @click="$emit('selectExercise')"
        />

        <q-input
          v-model.number="durationMinutes"
          type="number"
          step="any"
          min="0"
          outlined
          dense
          :label="t('exercise.aerobic.durationLabel')"
          :hint="t('exercise.aerobic.durationHint')"
          class="amilio-numeric aerobic-form-sheet__duration"
          :error="!!errors.duration"
          :error-message="errors.duration"
          @update:model-value="onDurationInput"
        />

        <div v-if="kcalPreview !== null" class="aerobic-form-sheet__preview amilio-numeric">
          <span class="aerobic-form-sheet__preview-label">
            {{ t('exercise.aerobic.kcalEstimatedLabel') }}
          </span>
          <span class="aerobic-form-sheet__preview-value">
            {{ kcalPreviewText }}
          </span>
        </div>

        <q-input
          v-model="notes"
          type="textarea"
          outlined
          dense
          autogrow
          :label="t('exercise.aerobic.notesLabel')"
          class="aerobic-form-sheet__notes"
        />
      </q-card-section>

      <q-card-section class="aerobic-form-sheet__actions">
        <q-space />
        <q-btn flat no-caps :label="t('common.cancel')" v-close-popup @click="reset" />
        <q-btn
          unelevated
          color="primary"
          text-color="black"
          no-caps
          class="amilio-touch"
          :label="t('exercise.aerobic.save')"
          :disable="!canSave"
          @click="commit"
        />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { SupportedLocale } from 'src/domain/types';
import { computeKcalFromDuration } from 'src/domain/aerobic';
import { formatKcalCompact } from 'src/domain/aerobic';

interface EditingActivity {
  id: number;
  exerciseId: string | null;
  exerciseNameSnapshot: string;
  kcalPerHourSnapshot: number;
  durationMinutes: number;
  notes: string | null;
}

const props = defineProps<{
  modelValue: boolean;
  editingActivity: EditingActivity | null;
  locale: SupportedLocale;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', open: boolean): void;
  (e: 'selectExercise'): void;
  (
    e: 'save',
    payload: {
      exerciseId: string;
      exerciseName: string;
      kcalPerHour: number;
      durationMinutes: number;
      notes: string | null;
      refDate: string;
    },
  ): void;
}>();

const { t } = useI18n();

const open = defineModel<boolean>({ required: true });

const exerciseId = ref<string | null>(null);
const exerciseName = ref<string | null>(null);
const kcalPerHour = ref<number>(0);
const durationMinutes = ref<number>(0);
const notes = ref<string>('');

function reset(): void {
  exerciseId.value = null;
  exerciseName.value = null;
  kcalPerHour.value = 0;
  durationMinutes.value = 0;
  notes.value = '';
}

watch(open, (val) => {
  if (val && props.editingActivity) {
    exerciseId.value = props.editingActivity.exerciseId;
    exerciseName.value = props.editingActivity.exerciseNameSnapshot;
    kcalPerHour.value = props.editingActivity.kcalPerHourSnapshot;
    durationMinutes.value = props.editingActivity.durationMinutes;
    notes.value = props.editingActivity.notes ?? '';
  } else if (val) {
    reset();
  }
});

const errors = computed<Record<string, string>>(() => {
  const out: Record<string, string> = {};
  const dur = durationMinutes.value;
  if (!Number.isFinite(dur) || dur <= 0) {
    out['duration'] = t('exercise.aerobic.invalidDuration');
  }
  if (!Number.isFinite(kcalPerHour.value) || kcalPerHour.value < 0) {
    out['kcalPerHour'] = t('exercise.aerobic.invalidKcalPerHour');
  }
  return out;
});

const kcalPreview = computed<number | null>(() => {
  const dur = durationMinutes.value;
  if (!Number.isFinite(dur) || dur <= 0) return null;
  if (!Number.isFinite(kcalPerHour.value) || kcalPerHour.value < 0) return null;
  return computeKcalFromDuration(kcalPerHour.value, dur);
});

const kcalPreviewText = computed<string>(() =>
  kcalPreview.value === null ? '—' : formatKcalCompact(kcalPreview.value, props.locale),
);

const canSave = computed<boolean>(
  () => exerciseId.value !== null && Object.keys(errors.value).length === 0,
);

function onDurationInput(): void {
  // Pure reactive updates — kcalPreview recomputes off the ref.
}

function commit(): void {
  if (!canSave.value || exerciseId.value === null || exerciseName.value === null) return;
  emit('save', {
    exerciseId: exerciseId.value,
    exerciseName: exerciseName.value,
    kcalPerHour: kcalPerHour.value,
    durationMinutes: durationMinutes.value,
    notes: notes.value.trim().length === 0 ? null : notes.value.trim(),
    refDate: todayLocalDate(),
  });
  open.value = false;
  reset();
}

function todayLocalDate(): string {
  // Keep this in sync with the page layer's selected date. The page always
  // supplies the live `refDate` for new activities; the sheet uses today as
  // a placeholder so the parent can override via a follow-up event if it
  // needs to. Today is correct for the common case (the page opens the
  // sheet from the active date).
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
</script>

<style lang="scss" scoped>
.aerobic-form-sheet {
  min-height: 60vh;
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--amilio-border);
    padding-block: 4px;
  }

  &__title {
    font-weight: 700;
    font-size: 1.05rem;
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__exercise-btn {
    width: 100%;
    justify-content: space-between;
  }

  &__duration {
    width: 100%;
  }

  &__notes {
    width: 100%;
  }

  &__preview {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(249, 115, 22, 0.08);
    border: 1px solid rgba(249, 115, 22, 0.18);
  }

  &__preview-label {
    font-size: 0.85rem;
    color: var(--amilio-text-secondary);
    font-weight: 600;
  }

  &__preview-value {
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--amilio-orange-strong);
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    border-top: 1px solid var(--amilio-border);
  }
}

.body--dark .aerobic-form-sheet {
  &__head,
  &__actions {
    border-color: var(--amilio-surface-dark);
  }

  &__preview {
    background: rgba(249, 115, 22, 0.18);
    border-color: rgba(249, 115, 22, 0.35);
  }

  &__preview-value {
    color: var(--amilio-orange);
  }
}
</style>
