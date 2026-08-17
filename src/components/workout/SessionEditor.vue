<template>
  <q-expansion-item
    :model-value="expanded"
    class="session-editor"
    @update:model-value="(v: boolean) => $emit('update:expanded', v)"
  >
    <template #header>
      <q-item-section>
        <q-item-label class="session-editor__name">{{ session.name }}</q-item-label>
        <q-item-label caption class="session-editor__count">
          {{ t('workout.manage.exercisesHeader') }} · {{ plannedExercises.length }}
        </q-item-label>
      </q-item-section>
      <q-item-section side>
        <q-btn
          flat
          dense
          round
          icon="more_vert"
          size="sm"
          :aria-label="t('common.save')"
          @click.stop
        >
          <q-menu>
            <q-list dense>
              <q-item clickable v-close-popup @click.stop="$emit('renameSession')">
                <q-item-section>{{ t('workout.manage.renameSession') }}</q-item-section>
              </q-item>
              <q-item
                clickable
                v-close-popup
                class="text-negative"
                @click.stop="$emit('deleteSession')"
              >
                <q-item-section>{{ t('workout.manage.deleteSession') }}</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-item-section>
    </template>

    <ul v-if="plannedExercises.length" class="session-editor__list">
      <li v-for="(p, idx) in plannedExercises" :key="p.planned.id" class="session-editor__row">
        <div class="session-editor__row-main">
          <span class="session-editor__row-name">
            {{ p.exercise?.name ?? p.planned.exerciseNameSnapshot }}
          </span>
          <span class="session-editor__row-detail amilio-numeric">
            {{ p.planned.plannedSets }} × {{ p.planned.plannedReps }}
            <template v-if="p.planned.plannedWeightKg !== null">
              · {{ formatPlannedWeight(p.planned.plannedWeightKg) }}
            </template>
          </span>
          <span v-if="p.planned.notes" class="session-editor__row-notes">
            {{ p.planned.notes }}
          </span>
        </div>

        <div class="session-editor__row-actions">
          <q-btn
            flat
            dense
            round
            icon="arrow_upward"
            size="sm"
            :disable="idx === 0"
            :aria-label="t('workout.manage.moveUp')"
            @click="$emit('reorder', { plannedId: p.planned.id, direction: 'up' })"
          />
          <q-btn
            flat
            dense
            round
            icon="arrow_downward"
            size="sm"
            :disable="idx === plannedExercises.length - 1"
            :aria-label="t('workout.manage.moveDown')"
            @click="$emit('reorder', { plannedId: p.planned.id, direction: 'down' })"
          />
          <q-btn
            flat
            dense
            round
            icon="edit"
            size="sm"
            :aria-label="t('common.save')"
            @click="$emit('edit', p.planned.id)"
          />
          <q-btn
            flat
            dense
            round
            icon="delete_outline"
            size="sm"
            color="negative"
            :aria-label="t('exercise.aerobic.delete')"
            @click="$emit('delete', p.planned.id)"
          />
        </div>
      </li>
    </ul>

    <div v-else class="session-editor__empty">
      {{ t('workout.manage.emptyExercises') }}
    </div>

    <div class="session-editor__add">
      <q-btn
        flat
        no-caps
        color="primary"
        :label="t('workout.manage.addExerciseCta')"
        icon-right="add"
        @click="$emit('addExercise')"
      />
    </div>
  </q-expansion-item>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { MeasurementSystem, MuscleGroup } from 'src/domain/types';
import { formatLoad } from 'src/domain/measurements';

interface PlannedRow {
  planned: {
    id: number;
    plannedSets: number;
    plannedReps: number;
    plannedWeightKg: number | null;
    notes: string | null;
    exerciseNameSnapshot: string;
    muscleGroupSnapshot: MuscleGroup | null;
    position: number;
  };
  exercise: { id: string; name: string } | null;
  exerciseOrigin: 'official' | 'custom' | 'deleted';
}

const props = defineProps<{
  session: { id: number; name: string; position: number };
  plannedExercises: ReadonlyArray<PlannedRow>;
  measurementSystem: MeasurementSystem;
  expanded: boolean;
}>();

defineEmits<{
  (e: 'update:expanded', value: boolean): void;
  (e: 'reorder', payload: { plannedId: number; direction: 'up' | 'down' }): void;
  (e: 'edit', plannedId: number): void;
  (e: 'delete', plannedId: number): void;
  (e: 'addExercise'): void;
  (e: 'renameSession'): void;
  (e: 'deleteSession'): void;
}>();

const { t } = useI18n();

function formatPlannedWeight(kg: number): string {
  return formatLoad(kg, props.measurementSystem);
}
</script>

<style lang="scss" scoped>
.session-editor {
  background: var(--amilio-white);
  border: 1px solid var(--amilio-border);
  border-radius: 14px;
  overflow: hidden;

  :deep(.q-expansion-item__container) {
    border-radius: 14px;
  }

  &__name {
    font-weight: 700;
  }

  &__count {
    font-size: 0.78rem;
    color: var(--amilio-text-secondary);
  }

  &__list {
    list-style: none;
    margin: 0;
    padding: 0 12px 12px;
    border-top: 1px solid var(--amilio-border);
  }

  &__row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid var(--amilio-border);
  }

  &__row:last-child {
    border-bottom: none;
  }

  &__row-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__row-name {
    font-weight: 600;
  }

  &__row-detail {
    font-size: 0.82rem;
    color: var(--amilio-text-secondary);
  }

  &__row-notes {
    font-size: 0.78rem;
    color: var(--amilio-text-secondary);
    font-style: italic;
  }

  &__row-actions {
    display: flex;
    gap: 2px;
  }

  &__empty {
    color: var(--amilio-text-secondary);
    text-align: center;
    padding: 16px 8px;
    font-size: 0.85rem;
    border-top: 1px solid var(--amilio-border);
  }

  &__add {
    padding: 4px 12px 12px;
  }
}

.body--dark .session-editor {
  background: var(--amilio-graphite);
  border-color: var(--amilio-surface-dark);

  &__list,
  &__row,
  &__empty {
    border-color: var(--amilio-surface-dark);
  }
}
</style>
