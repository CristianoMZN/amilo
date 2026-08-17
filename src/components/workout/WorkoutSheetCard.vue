<template>
  <q-card flat class="workout-sheet-card">
    <q-card-section class="workout-sheet-card__section">
      <header class="workout-sheet-card__head">
        <div class="workout-sheet-card__title">{{ sheet.sheet.name }}</div>
        <q-btn flat dense round icon="more_vert" :aria-label="t('common.save')">
          <q-menu>
            <q-list dense>
              <q-item clickable v-close-popup @click="$emit('open')">
                <q-item-section>{{ t('common.continue') }}</q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="$emit('renameSheet')">
                <q-item-section>{{ t('workout.manage.renameSheet') }}</q-item-section>
              </q-item>
              <q-item clickable v-close-popup class="text-negative" @click="$emit('deleteSheet')">
                <q-item-section>{{ t('workout.manage.deleteSheet') }}</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </header>

      <div v-if="sheet.sessions.length" class="workout-sheet-card__sessions">
        <div v-for="s in sheet.sessions" :key="s.session.id" class="workout-sheet-card__session">
          <header class="workout-sheet-card__session-head">
            <div class="workout-sheet-card__session-name">{{ s.session.name }}</div>
            <q-btn flat dense round icon="more_vert" size="sm" :aria-label="t('common.save')">
              <q-menu>
                <q-list dense>
                  <q-item clickable v-close-popup @click="$emit('openSession', s.session.id)">
                    <q-item-section>{{ t('common.continue') }}</q-item-section>
                  </q-item>
                  <q-item
                    clickable
                    v-close-popup
                    class="text-negative"
                    @click="$emit('deleteSession', s.session.id)"
                  >
                    <q-item-section>{{ t('workout.manage.deleteSession') }}</q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
          </header>

          <ul v-if="s.plannedExercises.length" class="workout-sheet-card__planned">
            <li
              v-for="p in s.plannedExercises"
              :key="p.planned.id"
              class="workout-sheet-card__planned-row"
            >
              <div class="workout-sheet-card__planned-main">
                <span class="workout-sheet-card__planned-name">
                  {{ p.exercise?.name ?? p.planned.exerciseNameSnapshot }}
                </span>
                <span class="workout-sheet-card__planned-detail amilio-numeric">
                  {{ p.planned.plannedSets }} × {{ p.planned.plannedReps }}
                  <template v-if="p.planned.plannedWeightKg !== null">
                    · {{ formatPlannedWeight(p.planned.plannedWeightKg) }}
                  </template>
                </span>
              </div>
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
                    <q-item clickable v-close-popup @click="$emit('openPlanned', p.planned.id)">
                      <q-item-section>{{ t('common.continue') }}</q-item-section>
                    </q-item>
                    <q-item
                      clickable
                      v-close-popup
                      class="text-negative"
                      @click="$emit('deletePlanned', p.planned.id)"
                    >
                      <q-item-section>{{
                        t('workout.manage.deleteExerciseConfirm')
                      }}</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-btn>
            </li>
          </ul>
          <div v-else class="workout-sheet-card__planned-empty">
            {{ t('workout.manage.emptyExercises') }}
          </div>

          <q-btn
            flat
            no-caps
            color="primary"
            :label="t('workout.manage.addExerciseCta')"
            icon-right="add"
            class="workout-sheet-card__add-exercise"
            @click="$emit('addPlanned', s.session.id)"
          />
        </div>
      </div>

      <div v-else class="workout-sheet-card__empty">
        {{ t('workout.manage.noSheetsHint') }}
      </div>

      <q-btn
        flat
        no-caps
        color="primary"
        :label="t('workout.manage.addSessionCta')"
        icon-right="add"
        class="workout-sheet-card__add-session"
        @click="$emit('addSession')"
      />
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { MeasurementSystem } from 'src/domain/types';
import { formatLoad } from 'src/domain/measurements';

interface PlannedExerciseLite {
  planned: {
    id: number;
    plannedSets: number;
    plannedReps: number;
    plannedWeightKg: number | null;
    notes: string | null;
    exerciseNameSnapshot: string;
  };
  exercise: { id: string; name: string } | null;
  exerciseOrigin: 'official' | 'custom' | 'deleted';
}

interface SessionLite {
  session: { id: number; name: string; position: number };
  plannedExercises: PlannedExerciseLite[];
}

interface SheetLite {
  sheet: { id: number; name: string; position: number };
  sessions: SessionLite[];
}

const props = defineProps<{
  sheet: SheetLite;
  measurementSystem: MeasurementSystem;
}>();

defineEmits<{
  (e: 'open'): void;
  (e: 'renameSheet'): void;
  (e: 'deleteSheet'): void;
  (e: 'addSession'): void;
  (e: 'openSession', sessionId: number): void;
  (e: 'deleteSession', sessionId: number): void;
  (e: 'addPlanned', sessionId: number): void;
  (e: 'openPlanned', plannedId: number): void;
  (e: 'deletePlanned', plannedId: number): void;
}>();

const { t } = useI18n();

function formatPlannedWeight(kg: number): string {
  return formatLoad(kg, props.measurementSystem);
}
</script>

<style lang="scss" scoped>
.workout-sheet-card {
  background: var(--amilio-white);
  border: 1px solid var(--amilio-border);
  border-radius: 18px;

  &__section {
    padding: 16px;
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__title {
    flex: 1;
    font-weight: 700;
    font-size: 1.05rem;
  }

  &__sessions {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 12px;
  }

  &__session {
    border-top: 1px solid var(--amilio-border);
    padding-top: 12px;
  }

  &__session-head {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__session-name {
    flex: 1;
    font-weight: 600;
    color: var(--amilio-text-dark);
  }

  &__planned {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
  }

  &__planned-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px dashed var(--amilio-border);
  }

  &__planned-row:last-child {
    border-bottom: none;
  }

  &__planned-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__planned-name {
    font-weight: 600;
  }

  &__planned-detail {
    font-size: 0.82rem;
    color: var(--amilio-text-secondary);
  }

  &__planned-empty {
    color: var(--amilio-text-secondary);
    font-size: 0.85rem;
    padding: 8px 0;
  }

  &__add-exercise {
    margin-top: 8px;
  }

  &__add-session {
    margin-top: 16px;
  }

  &__empty {
    color: var(--amilio-text-secondary);
    padding: 16px 0;
    font-size: 0.9rem;
  }
}

.body--dark .workout-sheet-card {
  background: var(--amilio-graphite);
  border: 1px solid var(--amilio-surface-dark);

  &__session {
    border-top-color: var(--amilio-surface-dark);
  }

  &__planned-row {
    border-bottom-color: var(--amilio-surface-dark);
  }

  &__session-name {
    color: var(--amilio-text-light);
  }
}
</style>
