<template>
  <q-page class="exercise-page">
    <!-- Date navigation -->
    <header class="exercise-page__datebar">
      <q-btn
        flat
        dense
        round
        icon="chevron_left"
        :aria-label="t('common.back')"
        @click="shiftDay(-1)"
      />
      <div class="exercise-page__date-label">{{ dateLabel }}</div>
      <q-btn
        flat
        dense
        round
        :disable="isToday"
        icon="chevron_right"
        :aria-label="t('common.next')"
        @click="shiftDay(1)"
      />
      <q-space />
      <q-btn
        v-if="!isToday"
        unelevated
        size="sm"
        color="primary"
        text-color="black"
        no-caps
        :label="t('nutrition.page.todayShortcut')"
        class="amilio-touch"
        @click="goToday"
      />
    </header>

    <!-- Recovery banner (shown only when there's an in-progress workout) -->
    <q-banner v-if="recoveryOpen" class="exercise-page__recovery" rounded>
      <template #avatar>
        <q-icon name="fitness_center" color="violet" />
      </template>
      <div class="exercise-page__recovery-title">
        {{ t('workout.recovery.title') }}
      </div>
      <div class="exercise-page__recovery-message">
        {{ t('workout.recovery.message') }}
      </div>
      <template #action>
        <q-btn
          flat
          no-caps
          color="negative"
          :label="t('workout.recovery.discardCta')"
          @click="discardRecovery"
        />
        <q-btn
          unelevated
          no-caps
          color="primary"
          text-color="black"
          class="amilio-touch"
          :label="t('workout.recovery.continueCta')"
          @click="resumeRecovery"
        />
      </template>
    </q-banner>

    <!-- Tabs: Aerobic | Strength -->
    <q-tabs
      v-model="activeFilter"
      dense
      align="justify"
      active-color="primary"
      indicator-color="primary"
      class="exercise-page__tabs"
    >
      <q-tab name="aerobic" :label="t('exercise.tabs.aerobic')" />
      <q-tab name="strength" :label="t('exercise.tabs.strength')" />
    </q-tabs>

    <q-tab-panels v-model="activeFilter" animated class="exercise-page__panels">
      <!-- Aerobic tab -->
      <q-tab-panel name="aerobic" class="exercise-page__panel">
        <div v-if="loading" class="exercise-page__loading">
          <q-spinner color="primary" size="32px" />
        </div>
        <AerobicSummaryCard
          v-else
          :activities="aerobicEntries"
          :measurement-system="measurementSystem"
          :locale="locale"
          @record="openAddAerobic"
          @edit="openEditAerobic"
          @delete="confirmDeleteAerobic"
        />
      </q-tab-panel>

      <!-- Strength tab -->
      <q-tab-panel name="strength" class="exercise-page__panel">
        <div v-if="loading" class="exercise-page__loading">
          <q-spinner color="primary" size="32px" />
        </div>
        <template v-else>
          <div v-if="sheetLites.length" class="exercise-page__sheets">
            <WorkoutSheetCard
              v-for="s in sheetLites"
              :key="s.sheet.id"
              :sheet="s"
              :measurement-system="measurementSystem"
              @open="onOpenSheet"
              @rename-sheet="openRenameSheet(fullSheet(s.sheet.id))"
              @delete-sheet="confirmDeleteSheet(fullSheet(s.sheet.id))"
              @add-session="openNewSession(s.sheet.id)"
              @open-session="(id) => onOpenSession(fullSheet(s.sheet.id), id)"
              @delete-session="(id) => confirmDeleteSession(fullSheet(s.sheet.id), id)"
              @add-planned="(id) => openAddPlanned(fullSheet(s.sheet.id), id)"
              @open-planned="(id) => onOpenPlanned(fullSheet(s.sheet.id), id)"
              @delete-planned="(id) => confirmDeletePlanned(fullSheet(s.sheet.id), id)"
            />
          </div>
          <q-banner v-else class="exercise-page__empty" rounded>
            <template #avatar>
              <q-icon name="fitness_center" color="violet" />
            </template>
            {{ t('workout.page.noSheetsHint') }}
          </q-banner>
        </template>
      </q-tab-panel>
    </q-tab-panels>

    <q-page-sticky position="bottom-right" :offset="[18, 88]">
      <q-btn
        v-if="activeFilter === 'aerobic'"
        fab
        unelevated
        color="primary"
        text-color="black"
        icon="add"
        :aria-label="t('exercise.page.recordAerobicCta')"
        @click="openAddAerobic"
      />
      <q-btn
        v-else
        fab
        unelevated
        color="primary"
        text-color="black"
        icon="play_arrow"
        :aria-label="t('workout.page.startWorkoutCta')"
        @click="openSheetPicker"
      />
    </q-page-sticky>

    <!-- Aerobic add/edit form -->
    <AerobicFormSheet
      v-model="aerobicSheetOpen"
      :editing-activity="aerobicEditing"
      :locale="locale"
      @select-exercise="openSearchAerobic"
      @save="onAerobicSave"
    />

    <!-- Aerobic exercise picker -->
    <ExerciseSearchSheet
      v-model="aerobicSearchOpen"
      kind="aerobic"
      :locale="locale"
      @select="onAerobicPickExercise"
      @create-custom="onAerobicCreateCustom"
    />

    <!-- Strength exercise picker (for planned exercises) -->
    <ExerciseSearchSheet
      v-model="strengthSearchOpen"
      kind="strength"
      :locale="locale"
      @select="onStrengthPickExercise"
      @create-custom="onStrengthCreateCustom"
    />

    <!-- Sheet picker (when user taps FAB on strength tab) -->
    <q-dialog v-model="sheetPickerOpen">
      <q-card class="exercise-page__prompt">
        <q-card-section>
          <div class="exercise-page__prompt-title">
            {{ t('workout.page.startWorkoutCta') }}
          </div>
        </q-card-section>
        <q-card-section class="exercise-page__picker-list">
          <div v-if="sheets.length === 0" class="exercise-page__picker-empty">
            {{ t('workout.page.noSheetsHint') }}
          </div>
          <q-list v-else separator>
            <q-item
              v-for="s in sheets"
              :key="s.sheet.id"
              clickable
              v-ripple
              @click="onPickSheet(s)"
            >
              <q-item-section>
                <q-item-label>{{ s.sheet.name }}</q-item-label>
                <q-item-label caption>
                  {{ s.sessions.length }}
                  {{ s.sessions.length === 1 ? t('units.set') : t('units.sets') }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="t('common.cancel')" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Session picker (when starting a workout from a sheet) -->
    <q-dialog v-model="sessionPickerOpen">
      <q-card class="exercise-page__prompt">
        <q-card-section>
          <div class="exercise-page__prompt-title">{{ sheetPickerSheet?.sheet.name }}</div>
        </q-card-section>
        <q-card-section class="exercise-page__picker-list">
          <div
            v-if="(sheetPickerSheet?.sessions.length ?? 0) === 0"
            class="exercise-page__picker-empty"
          >
            {{ t('workout.manage.emptyExercises') }}
          </div>
          <q-list v-else separator>
            <q-item
              v-for="sess in sheetPickerSheet?.sessions ?? []"
              :key="sess.session.id"
              clickable
              v-ripple
              @click="onPickSession(sess.session.id)"
            >
              <q-item-section>
                <q-item-label>{{ sess.session.name }}</q-item-label>
                <q-item-label caption>
                  {{ sess.plannedExercises.length }}
                  {{ t('workout.manage.exercisesHeader') }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="t('common.cancel')" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Planned exercise form (after picking exercise) -->
    <q-dialog v-model="plannedFormOpen">
      <q-card class="exercise-page__prompt exercise-page__planned-form">
        <q-card-section>
          <div class="exercise-page__prompt-title">{{ plannedExerciseName }}</div>
        </q-card-section>
        <q-card-section class="exercise-page__planned-body">
          <q-input
            v-model.number="plannedSets"
            type="number"
            outlined
            dense
            min="1"
            :label="t('workout.manage.plannedSetsLabel')"
            class="amilio-numeric"
          />
          <q-input
            v-model.number="plannedReps"
            type="number"
            outlined
            dense
            min="1"
            :label="t('workout.manage.plannedRepsLabel')"
            class="amilio-numeric"
          />
          <q-input
            v-model.number="plannedWeightKg"
            type="number"
            outlined
            dense
            :label="t('workout.manage.plannedWeightLabel')"
            class="amilio-numeric"
            :disable="plannedDefaultUnit === 'none'"
            :placeholder="plannedDefaultUnit === 'none' ? '—' : '0'"
          />
          <q-input
            v-model="plannedNotes"
            type="textarea"
            outlined
            dense
            autogrow
            :label="t('workout.manage.notesLabel')"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="t('common.cancel')" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="primary"
            text-color="black"
            class="amilio-touch"
            :label="t('workout.manage.newSheetSave')"
            :disable="!canSavePlanned"
            @click="commitPlanned"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Rename sheet prompt -->
    <q-dialog v-model="renameSheetOpen" persistent>
      <q-card class="exercise-page__prompt">
        <q-card-section>
          <div class="exercise-page__prompt-title">{{ t('workout.manage.renameSheet') }}</div>
          <q-input
            v-model="renameSheetValue"
            dense
            outlined
            :placeholder="t('workout.manage.newSheetNamePlaceholder')"
            autofocus
            class="exercise-page__prompt-input"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="t('common.cancel')" v-close-popup />
          <q-btn
            unelevated
            color="primary"
            text-color="black"
            no-caps
            class="amilio-touch"
            :label="t('common.save')"
            :disable="renameSheetValue.trim().length === 0"
            @click="commitRenameSheet"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-banner v-if="errorMessage" class="exercise-page__error" rounded>
      <template #avatar>
        <q-icon name="error_outline" color="negative" />
      </template>
      {{ errorMessage }}
    </q-banner>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Dialog, Notify } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { useAppStore } from 'src/stores/app';
import { useExerciseStore } from 'src/stores/exercise';
import { useWorkoutStore } from 'src/stores/workout';
import { getDatabase } from 'src/database/database';
import { exerciseService } from 'src/services/exercise';
import { workoutService } from 'src/services/workout';
import type { AerobicActivityWithExercise } from 'src/services/exercise';
import type { SheetWithSessions } from 'src/services/workout';
import { addDays, formatLocalDateLong, isValidLocalDate, todayLocalDate } from 'src/util/dateDay';
import type {
  ExerciseDefaultUnit,
  MuscleGroup,
  SupportedLocale,
  WorkoutSheet,
} from 'src/domain/types';

import AerobicSummaryCard from 'components/exercise/AerobicSummaryCard.vue';
import AerobicFormSheet from 'components/exercise/AerobicFormSheet.vue';
import ExerciseSearchSheet from 'components/exercise/ExerciseSearchSheet.vue';
import WorkoutSheetCard from 'components/workout/WorkoutSheetCard.vue';

const { t } = useI18n();
const router = useRouter();
const appStore = useAppStore();
const exerciseStore = useExerciseStore();
const workoutStore = useWorkoutStore();

const locale = computed<SupportedLocale>(() => appStore.locale);
const measurementSystem = computed(() => appStore.measurementSystem);

const loading = ref<boolean>(true);
const errorMessage = ref<string | null>(null);
const activities = ref<AerobicActivityWithExercise[]>([]);
const sheets = ref<SheetWithSessions[]>([]);

/**
 * The `AerobicSummaryCard` declares its own slimmer `AerobicEntry` shape so
 * the card stays free of service-layer types. Project our
 * `AerobicActivityWithExercise` rows onto that shape before passing them in.
 */
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

const aerobicEntries = computed<AerobicEntry[]>(() =>
  activities.value.map((a) => ({
    activity: {
      id: a.activity.id,
      exerciseId: a.activity.exerciseId,
      exerciseNameSnapshot: a.activity.exerciseNameSnapshot,
      durationMinutes: a.activity.durationMinutes,
      kcalEstimated: a.activity.kcalEstimated,
      kcalPerHourSnapshot: a.activity.kcalPerHourSnapshot,
    },
    exerciseName: a.exerciseName,
    exerciseOrigin: a.exerciseOrigin,
  })),
);

/**
 * The `WorkoutSheetCard` declares its own slimmer sheet shape so the
 * component doesn't have to import service-layer types. Project our
 * `SheetWithSessions` rows onto that shape.
 */
interface SheetLite {
  sheet: { id: number; name: string; position: number };
  sessions: Array<{
    session: { id: number; name: string; position: number };
    plannedExercises: Array<{
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
    }>;
  }>;
}

/**
 * Cache the localized name per exercise id so we don't repeat the lookup
 * across multiple planned rows that reference the same canonical exercise.
 */
const exerciseNameById = ref<Record<string, string>>({});

async function hydrateExerciseNames(sheetsIn: SheetWithSessions[]): Promise<void> {
  const ids = new Set<string>();
  for (const s of sheetsIn) {
    for (const sess of s.sessions) {
      for (const p of sess.plannedExercises) {
        if (p.exercise) ids.add(p.exercise.id);
      }
    }
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
      // Keep going — the fallback in the lite handles missing names.
    }
  }
  exerciseNameById.value = map;
}

function projectSheet(s: SheetWithSessions): SheetLite {
  return {
    sheet: {
      id: s.sheet.id,
      name: s.sheet.name,
      position: s.sheet.position,
    },
    sessions: s.sessions.map((sess) => ({
      session: {
        id: sess.session.id,
        name: sess.session.name,
        position: sess.session.position,
      },
      plannedExercises: sess.plannedExercises.map((p) => ({
        planned: {
          id: p.planned.id,
          plannedSets: p.planned.plannedSets,
          plannedReps: p.planned.plannedReps,
          plannedWeightKg: p.planned.plannedWeightKg,
          notes: p.planned.notes,
          exerciseNameSnapshot: p.planned.exerciseNameSnapshot,
        },
        exercise: p.exercise
          ? {
              id: p.exercise.id,
              name: exerciseNameById.value[p.exercise.id] ?? p.planned.exerciseNameSnapshot,
            }
          : null,
        exerciseOrigin: p.exerciseOrigin,
      })),
    })),
  };
}

const sheetLites = computed<SheetLite[]>(() => sheets.value.map(projectSheet));

/**
 * Look up the full `SheetWithSessions` row for a projected lite id. The
 * template passes the lite's `sheet.id` into event handlers; we resolve
 * the canonical row here so handlers receive the rich shape.
 */
function fullSheet(id: number): SheetWithSessions {
  const found = sheets.value.find((s) => s.sheet.id === id);
  if (found) return found;
  // Fallback — should not happen in practice; the lite is always derived
  // from a `SheetWithSessions` already in `sheets.value`.
  return {
    sheet: { id, name: '', position: 0, createdAt: '', updatedAt: '' },
    sessions: [],
  };
}

const activeFilter = computed<'aerobic' | 'strength'>({
  get(): 'aerobic' | 'strength' {
    return exerciseStore.activeFilter;
  },
  set(v: 'aerobic' | 'strength'): void {
    exerciseStore.setActiveFilter(v);
  },
});

const aerobicSheetOpen = ref<boolean>(false);
interface AerobicEditing {
  id: number;
  exerciseId: string | null;
  exerciseNameSnapshot: string;
  kcalPerHourSnapshot: number;
  durationMinutes: number;
  notes: string | null;
}
const aerobicEditing = ref<AerobicEditing | null>(null);
const aerobicSearchOpen = ref<boolean>(false);
const strengthSearchOpen = ref<boolean>(false);

const sheetPickerOpen = ref<boolean>(false);
const sheetPickerSheet = ref<SheetWithSessions | null>(null);
const sessionPickerOpen = ref<boolean>(false);

const plannedFormOpen = ref<boolean>(false);
const plannedSessionId = ref<number | null>(null);
const plannedExerciseId = ref<string | null>(null);
const plannedExerciseName = ref<string>('');
const plannedMuscleGroup = ref<MuscleGroup | null>(null);
const plannedDefaultUnit = ref<ExerciseDefaultUnit>('kg');
const plannedSets = ref<number>(3);
const plannedReps = ref<number>(10);
const plannedWeightKg = ref<number | null>(null);
const plannedNotes = ref<string>('');

const renameSheetOpen = ref<boolean>(false);
const renameSheetValue = ref<string>('');
const renameSheetTarget = ref<WorkoutSheet | null>(null);

const recoveryOpen = ref<boolean>(false);
const recoveryWorkoutId = ref<number | null>(null);

const isToday = computed<boolean>(() => exerciseStore.selectedDate === todayLocalDate());
const dateLabel = computed<string>(() => {
  const date = exerciseStore.selectedDate;
  if (!isValidLocalDate(date)) return date;
  return formatLocalDateLong(date, locale.value);
});

const canSavePlanned = computed<boolean>(
  () =>
    plannedExerciseId.value !== null &&
    Number.isFinite(plannedSets.value) &&
    plannedSets.value > 0 &&
    Number.isFinite(plannedReps.value) &&
    plannedReps.value > 0,
);

async function refreshAerobic(): Promise<void> {
  try {
    const conn = await getDatabase();
    activities.value = await exerciseService.listAerobicActivitiesByDate(conn, {
      refDate: exerciseStore.selectedDate,
      locale: locale.value,
    });
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  }
}

async function refreshSheets(): Promise<void> {
  try {
    const conn = await getDatabase();
    sheets.value = await workoutService.listSheetsWithSessions(conn);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  }
}

async function refreshAll(): Promise<void> {
  loading.value = true;
  errorMessage.value = null;
  try {
    await refreshSheets();
    await hydrateExerciseNames(sheets.value);
    await refreshAerobic();
  } finally {
    loading.value = false;
  }
}

function shiftDay(delta: number): void {
  const next = addDays(exerciseStore.selectedDate, delta);
  if (isValidLocalDate(next)) {
    exerciseStore.setSelectedDate(next);
  }
}

function goToday(): void {
  exerciseStore.today();
}

function openAddAerobic(): void {
  aerobicEditing.value = null;
  aerobicSheetOpen.value = true;
}

function openEditAerobic(entry: AerobicEntry): void {
  aerobicEditing.value = {
    id: entry.activity.id,
    exerciseId: entry.activity.exerciseId,
    exerciseNameSnapshot: entry.activity.exerciseNameSnapshot,
    kcalPerHourSnapshot: entry.activity.kcalPerHourSnapshot,
    durationMinutes: entry.activity.durationMinutes,
    notes: null,
  };
  aerobicSheetOpen.value = true;
}

function openSearchAerobic(): void {
  aerobicSearchOpen.value = true;
}

function onAerobicPickExercise(picked: { id: string; name: string }): void {
  // The AerobicFormSheet holds its own state for the picked exercise. The
  // parent does not need to track it explicitly; the form will emit a
  // `save` event with the id when the user confirms. We just close the
  // search sheet.
  aerobicSearchOpen.value = false;
  // The form sheet displays the chosen exercise via its own local refs; the
  // search sheet's `select` event closes itself. Nothing else to do.
  void picked;
}

function onAerobicCreateCustom(): void {
  aerobicSearchOpen.value = false;
  // Custom-exercise creation is owned by Lane 11 components; for the page
  // layer we close the search sheet and let the user retype via the form.
  // The AerobicFormSheet's `selectExercise` re-opens the picker if they
  // want to try again.
}

async function onAerobicSave(payload: {
  exerciseId: string;
  exerciseName: string;
  kcalPerHour: number;
  durationMinutes: number;
  notes: string | null;
  refDate: string;
}): Promise<void> {
  // The form sheet always emits `refDate: todayLocalDate()` — override with
  // the page's selected date so historical / future days are recorded
  // against the day the user is browsing.
  const targetRefDate = exerciseStore.selectedDate;
  try {
    const conn = await getDatabase();
    if (aerobicEditing.value) {
      await exerciseService.updateAerobicActivity(conn, {
        id: aerobicEditing.value.id,
        kcalPerHour: payload.kcalPerHour,
        durationMinutes: payload.durationMinutes,
        notes: payload.notes,
      });
    } else {
      await exerciseService.recordAerobicActivity(conn, {
        exerciseId: payload.exerciseId,
        exerciseName: payload.exerciseName,
        kcalPerHour: payload.kcalPerHour,
        durationMinutes: payload.durationMinutes,
        notes: payload.notes,
        refDate: targetRefDate,
      });
    }
    aerobicSheetOpen.value = false;
    await refreshAerobic();
    Notify.create({
      message: t('common.save'),
      color: 'positive',
      position: 'bottom',
      timeout: 1500,
    });
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  }
}

function confirmDeleteAerobic(entry: AerobicEntry): void {
  Dialog.create({
    title: t('exercise.aerobic.delete'),
    message: t('exercise.aerobic.deleteConfirm'),
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void doDeleteAerobic(entry.activity.id);
  });
}

async function doDeleteAerobic(id: number): Promise<void> {
  try {
    const conn = await getDatabase();
    await exerciseService.deleteAerobicActivity(conn, id);
    await refreshAerobic();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  }
}

function openSheetPicker(): void {
  sheetPickerSheet.value = null;
  sheetPickerOpen.value = true;
}

function onPickSheet(s: SheetWithSessions): void {
  if (s.sessions.length === 0) {
    Notify.create({
      message: t('workout.manage.emptyExercises'),
      color: 'warning',
      position: 'bottom',
      timeout: 2500,
    });
    return;
  }
  sheetPickerSheet.value = s;
  sheetPickerOpen.value = false;
  sessionPickerOpen.value = true;
}

async function onPickSession(sessionId: number): Promise<void> {
  const sheet = sheetPickerSheet.value;
  sessionPickerOpen.value = false;
  sheetPickerSheet.value = null;
  if (!sheet) return;
  await startWorkout(sheet.sheet.id, sessionId);
}

async function startWorkout(sheetId: number, sessionId: number): Promise<void> {
  try {
    const conn = await getDatabase();
    const result = await workoutService.startWorkoutFromSession(conn, {
      sheetId,
      sessionId,
      refDate: exerciseStore.selectedDate,
    });
    Notify.create({
      message: t('workout.page.startWorkoutCta'),
      color: 'positive',
      position: 'bottom',
      timeout: 1500,
    });
    void router.push({
      name: 'workout-in-progress',
      params: { id: String(result.performedWorkout.id) },
    });
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  }
}

function onOpenSheet(): void {
  // Sheet-level "open" is a no-op for the manage page entrypoint; the
  // session picker is reached via the FAB. Keep the handler so the card
  // event signature stays satisfied.
}

function onOpenSession(sheet: SheetWithSessions, sessionId: number): void {
  sheetPickerSheet.value = sheet;
  // Start immediately — the sheet card surfaces a single per-session start.
  void startWorkout(sheet.sheet.id, sessionId);
}

function onOpenPlanned(_sheet: SheetWithSessions, plannedId: number): void {
  // The manage surface keeps planned rows read-only here; deeper edit lives
  // in the dedicated manage page. Silence the unused param.
  void plannedId;
}

function openNewSession(_sheetId: number): void {
  // New-session creation is owned by the WorkoutManagePage. Forward by
  // pushing the route.
  void router.push({ name: 'workout' });
  void _sheetId;
}

function confirmDeleteSession(sheet: SheetWithSessions, sessionId: number): void {
  Dialog.create({
    title: t('workout.manage.deleteSession'),
    message: t('workout.manage.deleteSessionConfirm'),
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void doDeleteSession(sessionId);
  });
  void sheet;
}

async function doDeleteSession(sessionId: number): Promise<void> {
  try {
    const conn = await getDatabase();
    await workoutService.deleteSession(conn, sessionId);
    await refreshSheets();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  }
}

function confirmDeleteSheet(sheet: SheetWithSessions): void {
  Dialog.create({
    title: t('workout.manage.deleteSheet'),
    message: t('workout.manage.deleteSheetConfirm'),
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void doDeleteSheet(sheet.sheet.id);
  });
}

async function doDeleteSheet(id: number): Promise<void> {
  try {
    const conn = await getDatabase();
    await workoutService.deleteSheet(conn, id);
    await refreshSheets();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  }
}

function confirmDeletePlanned(_sheet: SheetWithSessions, plannedId: number): void {
  Dialog.create({
    title: t('workout.manage.addExerciseCta'),
    message: t('workout.manage.deleteExerciseConfirm'),
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void doDeletePlanned(plannedId);
  });
  void _sheet;
}

async function doDeletePlanned(id: number): Promise<void> {
  try {
    const conn = await getDatabase();
    await workoutService.deletePlannedExercise(conn, id);
    await refreshSheets();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  }
}

function openRenameSheet(sheet: SheetWithSessions): void {
  renameSheetTarget.value = sheet.sheet;
  renameSheetValue.value = sheet.sheet.name;
  renameSheetOpen.value = true;
}

async function commitRenameSheet(): Promise<void> {
  const target = renameSheetTarget.value;
  const value = renameSheetValue.value.trim();
  renameSheetOpen.value = false;
  if (!target || value.length === 0) return;
  try {
    const conn = await getDatabase();
    await workoutService.renameSheet(conn, { id: target.id, name: value });
    await refreshSheets();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  }
}

function openAddPlanned(sheet: SheetWithSessions, sessionId: number): void {
  const session = sheet.sessions.find((s) => s.session.id === sessionId);
  void session;
  plannedSessionId.value = sessionId;
  plannedExerciseId.value = null;
  plannedExerciseName.value = '';
  plannedMuscleGroup.value = null;
  plannedDefaultUnit.value = 'kg';
  plannedSets.value = 3;
  plannedReps.value = 10;
  plannedWeightKg.value = null;
  plannedNotes.value = '';
  strengthSearchOpen.value = true;
}

function onStrengthPickExercise(picked: { id: string; name: string }): void {
  // Look up the picked exercise to capture its default unit + muscle group
  // so the planned form opens with sensible defaults. The search sheet
  // closes via `open.value = false` in its own handler — we set up our
  // local state for the next dialog here.
  void picked;
  plannedExerciseId.value = picked.id;
  plannedExerciseName.value = picked.name;
  // Default unit is filled in by the sheet's own picker hint, but the page
  // doesn't have access to it without an extra fetch. Keep the default
  // ('kg') and let the user override.
  strengthSearchOpen.value = false;
  plannedFormOpen.value = true;
  // Try to load the canonical muscle group + default unit asynchronously
  // so the form's preview is accurate.
  void loadPlannedExerciseMeta(picked.id);
}

async function loadPlannedExerciseMeta(id: string): Promise<void> {
  try {
    const conn = await getDatabase();
    const list = await exerciseService.listExercises(conn, {
      locale: locale.value,
      filter: { kind: 'strength', query: '' },
    });
    const found = list.find((e) => e.exercise.id === id);
    if (found) {
      plannedMuscleGroup.value = found.exercise.muscleGroup;
      plannedDefaultUnit.value = found.exercise.defaultUnit;
      if (plannedDefaultUnit.value === 'none') {
        plannedWeightKg.value = null;
      }
    }
  } catch {
    // The form falls back to its default values; non-fatal.
  }
}

function onStrengthCreateCustom(): void {
  strengthSearchOpen.value = false;
  // Custom-exercise creation is owned by Lane 11; here we just close the
  // picker. The user can re-open it from a planned-form retry if needed.
}

async function commitPlanned(): Promise<void> {
  if (
    !canSavePlanned.value ||
    plannedExerciseId.value === null ||
    plannedSessionId.value === null
  ) {
    return;
  }
  try {
    const conn = await getDatabase();
    await workoutService.addPlannedExercise(conn, {
      sessionId: plannedSessionId.value,
      exerciseId: plannedExerciseId.value,
      name: plannedExerciseName.value,
      muscleGroup: plannedMuscleGroup.value,
      plannedSets: plannedSets.value,
      plannedReps: plannedReps.value,
      plannedWeightKg: plannedDefaultUnit.value === 'none' ? null : plannedWeightKg.value,
      notes: plannedNotes.value.trim().length === 0 ? null : plannedNotes.value.trim(),
    });
    plannedFormOpen.value = false;
    await refreshSheets();
    Notify.create({
      message: t('common.save'),
      color: 'positive',
      position: 'bottom',
      timeout: 1500,
    });
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  }
}

async function checkRecovery(): Promise<void> {
  try {
    const conn = await getDatabase();
    const inProgress = await workoutService.findInProgressWorkout(conn);
    if (inProgress) {
      recoveryWorkoutId.value = inProgress.performedWorkout.id;
      recoveryOpen.value = true;
      workoutStore.openRecoveryPrompt(inProgress.performedWorkout.id);
    }
  } catch {
    // Recovery is best-effort; ignore failures (e.g. dev-stub boot).
  }
}

function resumeRecovery(): void {
  const id = recoveryWorkoutId.value;
  recoveryOpen.value = false;
  recoveryWorkoutId.value = null;
  workoutStore.closeRecoveryPrompt();
  if (id === null) return;
  void router.push({ name: 'workout-in-progress', params: { id: String(id) } });
}

async function discardRecovery(): Promise<void> {
  const id = recoveryWorkoutId.value;
  recoveryOpen.value = false;
  recoveryWorkoutId.value = null;
  workoutStore.closeRecoveryPrompt();
  if (id === null) return;
  try {
    const conn = await getDatabase();
    await workoutService.abandonWorkout(conn, { id });
    Notify.create({
      message: t('workout.recovery.discardCta'),
      color: 'dark',
      position: 'bottom',
      timeout: 1500,
    });
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  }
}

onMounted(() => {
  void refreshAll();
  void checkRecovery();
});
watch(() => exerciseStore.selectedDate, refreshAerobic);
watch(
  () => locale.value,
  async () => {
    await refreshAerobic();
    await hydrateExerciseNames(sheets.value);
  },
);
watch(
  () => sheets.value,
  async (next) => {
    await hydrateExerciseNames(next);
  },
);
watch(
  () => activeFilter.value,
  () => {
    // No data reload on tab switch — the same store state backs both tabs.
    void activeFilter.value;
  },
);
</script>

<style lang="scss" scoped>
.exercise-page {
  padding: 16px 16px calc(env(safe-area-inset-bottom, 0px) + 96px);
  max-width: 720px;
  margin: 0 auto;
  background: var(--amilio-bg-light);
  color: var(--amilio-text-dark);
  display: flex;
  flex-direction: column;
  gap: 16px;

  &__datebar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 0;
  }

  &__date-label {
    font-weight: 700;
    font-size: 1rem;
    margin: 0 8px;
    text-transform: capitalize;
  }

  &__tabs {
    border-bottom: 1px solid var(--amilio-border);
  }

  &__panels {
    background: transparent;
  }

  &__panel {
    padding: 12px 0;
  }

  &__loading {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 160px;
  }

  &__empty {
    background: var(--amilio-white);
    color: var(--amilio-text-secondary);
    border: 1px dashed var(--amilio-border);
    border-radius: 16px;
  }

  &__sheets {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__recovery {
    background: rgba(168, 85, 247, 0.08);
    color: var(--amilio-text-dark);
    border: 1px solid rgba(168, 85, 247, 0.35);
  }

  &__recovery-title {
    font-weight: 700;
  }

  &__recovery-message {
    font-size: 0.85rem;
    color: var(--amilio-text-secondary);
    margin-top: 2px;
  }

  &__error {
    background: rgba(239, 68, 68, 0.12);
    color: var(--amilio-text-dark);
  }

  &__prompt {
    min-width: 280px;
    max-width: 90vw;
  }

  &__prompt-title {
    font-weight: 700;
    font-size: 1rem;
    margin-bottom: 8px;
  }

  &__prompt-input {
    width: 100%;
  }

  &__picker-list {
    max-height: 60vh;
    overflow-y: auto;
  }

  &__picker-empty {
    text-align: center;
    color: var(--amilio-text-secondary);
    padding: 24px 0;
  }

  &__planned-form {
    min-width: 320px;
  }

  &__planned-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
}

.body--dark .exercise-page {
  background: var(--amilio-black);
  color: var(--amilio-text-light);

  &__empty {
    background: var(--amilio-graphite);
    color: var(--amilio-text-light);
    border-color: var(--amilio-surface-dark);
  }

  &__recovery {
    background: rgba(168, 85, 247, 0.18);
    color: var(--amilio-text-light);
  }

  &__tabs {
    border-color: var(--amilio-surface-dark);
  }
}
</style>
