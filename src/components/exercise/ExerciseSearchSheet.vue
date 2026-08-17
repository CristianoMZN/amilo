<template>
  <q-dialog
    v-model="open"
    position="bottom"
    seamless
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
  >
    <q-card class="exercise-search-sheet">
      <q-card-section class="exercise-search-sheet__head">
        <div class="exercise-search-sheet__title">
          {{
            kind === 'strength'
              ? t('exercise.strength.addSheetTitle')
              : t('exercise.aerobic.addSheetTitle')
          }}
        </div>
        <q-btn flat round dense icon="close" v-close-popup @click="reset" />
      </q-card-section>

      <q-card-section class="exercise-search-sheet__body">
        <q-input
          v-model="rawQuery"
          outlined
          dense
          autofocus
          :placeholder="t('exercise.page.searchPlaceholder')"
          :hint="t('exercise.page.searchHint')"
          class="exercise-search-sheet__search"
        >
          <template #prepend>
            <q-icon name="search" />
          </template>
        </q-input>

        <!-- Strength-only muscle-group filter chips -->
        <div
          v-if="kind === 'strength' && muscleGroups && muscleGroups.length"
          class="exercise-search-sheet__chips"
        >
          <q-chip
            clickable
            :outline="activeMuscleGroup !== null"
            color="primary"
            text-color="black"
            :aria-label="t('exercise.strength.filterAll')"
            @click="activeMuscleGroup = null"
          >
            {{ t('exercise.strength.filterAll') }}
          </q-chip>
          <q-chip
            v-for="mg in muscleGroups"
            :key="mg"
            clickable
            :outline="activeMuscleGroup !== mg"
            color="primary"
            text-color="black"
            :aria-label="t(`exercise.strength.muscleGroups.${mg}`)"
            @click="activeMuscleGroup = mg"
          >
            {{ t(`exercise.strength.muscleGroups.${mg}`) }}
          </q-chip>
        </div>

        <div class="exercise-search-sheet__results">
          <q-spinner
            v-if="loading"
            color="primary"
            size="28px"
            class="exercise-search-sheet__spinner"
          />
          <q-list v-else-if="results.length" separator>
            <q-item
              v-for="ex in results"
              :key="ex.exercise.id"
              clickable
              v-ripple
              @click="pick(ex)"
            >
              <q-item-section>
                <q-item-label>{{ ex.name }}</q-item-label>
                <q-item-label caption class="exercise-search-sheet__origin">
                  {{ originLabel(ex.exercise.origin) }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
          <div v-else class="exercise-search-sheet__empty">
            {{ t('exercise.page.noResults') }}
          </div>
        </div>
      </q-card-section>

      <q-card-section class="exercise-search-sheet__actions">
        <q-btn
          flat
          no-caps
          color="primary"
          :label="t('exercise.strength.customCreateTitle')"
          @click="$emit('createCustom')"
        />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ExerciseOrigin, MuscleGroup, SupportedLocale } from 'src/domain/types';
import { getDatabase } from 'src/database/database';
import { exerciseService } from 'src/services/exercise';
import type { ExerciseWithName } from 'src/services/exercise';

const props = defineProps<{
  modelValue: boolean;
  kind: 'aerobic' | 'strength';
  locale: SupportedLocale;
  muscleGroups?: ReadonlyArray<MuscleGroup>;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', open: boolean): void;
  (e: 'select', exercise: { id: string; name: string }): void;
  (e: 'createCustom'): void;
}>();

const { t } = useI18n();

const open = defineModel<boolean>({ required: true });

const rawQuery = ref<string>('');
const debouncedQuery = ref<string>('');
const activeMuscleGroup = ref<MuscleGroup | null>(null);
const results = ref<ExerciseWithName[]>([]);
const loading = ref<boolean>(false);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function clearDebounce(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

onBeforeUnmount(clearDebounce);

function reset(): void {
  rawQuery.value = '';
  debouncedQuery.value = '';
  activeMuscleGroup.value = null;
  results.value = [];
}

watch(rawQuery, (val) => {
  clearDebounce();
  debounceTimer = setTimeout(() => {
    debouncedQuery.value = val;
    debounceTimer = null;
  }, 200);
});

watch(
  [open, debouncedQuery, activeMuscleGroup],
  async ([isOpen]) => {
    if (!isOpen) return;
    loading.value = true;
    try {
      const conn = await getDatabase();
      const trimmed = debouncedQuery.value.trim();
      const filter: { kind: 'aerobic' | 'strength'; query?: string; muscleGroup?: MuscleGroup } = {
        kind: props.kind,
      };
      if (trimmed.length > 0) {
        filter.query = trimmed;
      }
      if (props.kind === 'strength' && activeMuscleGroup.value !== null) {
        filter.muscleGroup = activeMuscleGroup.value;
      }
      results.value = await exerciseService.listExercises(conn, {
        locale: props.locale,
        filter,
      });
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

// Reserved for a future "show count" badge — read access keeps `results`
// in scope without triggering the no-unused-vars rule.
void 0;

function pick(ex: ExerciseWithName): void {
  emit('select', { id: ex.exercise.id, name: ex.name });
  open.value = false;
  reset();
}

function originLabel(origin: ExerciseOrigin): string {
  return origin === 'custom' ? t('exercise.origin.custom') : t('exercise.origin.official');
}
</script>

<style lang="scss" scoped>
.exercise-search-sheet {
  min-height: 70vh;
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

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  &__results {
    min-height: 200px;
    max-height: 45vh;
    overflow-y: auto;
  }

  &__spinner {
    display: flex;
    justify-content: center;
    padding: 24px 0;
  }

  &__origin {
    font-size: 0.78rem;
    color: var(--amilio-text-secondary);
  }

  &__empty {
    text-align: center;
    color: var(--amilio-text-secondary);
    padding: 24px 0;
  }

  &__actions {
    border-top: 1px solid var(--amilio-border);
  }
}

.body--dark .exercise-search-sheet {
  &__head,
  &__actions {
    border-color: var(--amilio-surface-dark);
  }
}
</style>
