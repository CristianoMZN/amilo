<template>
  <q-page class="workout-manage-page">
    <header class="workout-manage-page__head">
      <div class="workout-manage-page__title">
        {{ t('workout.manage.title') }}
      </div>
      <q-btn
        unelevated
        no-caps
        color="primary"
        text-color="black"
        class="amilio-touch"
        icon="add"
        :label="t('workout.manage.newSheetCta')"
        @click="openNewSheet"
      />
    </header>

    <div v-if="loading" class="workout-manage-page__loading">
      <q-spinner color="primary" size="32px" />
    </div>

    <div v-else-if="sheets.length === 0" class="workout-manage-page__empty">
      <q-icon name="fitness_center" size="40px" color="violet" />
      <div class="workout-manage-page__empty-text">
        {{ t('workout.manage.noSheetsHint') }}
      </div>
      <q-btn
        unelevated
        no-caps
        color="primary"
        text-color="black"
        class="amilio-touch"
        icon="add"
        :label="t('workout.manage.noSheetsCta')"
        @click="openNewSheet"
      />
    </div>

    <div v-else class="workout-manage-page__list">
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

      <div class="workout-manage-page__sessions">
        <div
          v-for="bundle in sessionLites"
          :key="`detail-${bundle.sheetId}`"
          class="workout-manage-page__sheet-detail"
        >
          <SessionEditor
            v-for="sess in bundle.sessions"
            :key="sess.session.id"
            :session="sess.session"
            :planned-exercises="sess.plannedExercises"
            :measurement-system="measurementSystem"
            :expanded="expandedSessionIds.has(sess.session.id)"
            @update:expanded="(v) => toggleExpanded(sess.session.id, v)"
            @rename-session="openRenameSession(fullSession(sess.session.id))"
            @delete-session="confirmDeleteSessionById(sess.session.id)"
            @reorder="(p) => reorderPlanned(sess.session.id, p)"
            @edit="onEditPlanned"
            @delete="confirmDeletePlannedById"
            @add-exercise="onAddExerciseForSession(sess.session.id)"
          />
        </div>
      </div>
    </div>

    <q-banner v-if="errorMessage" class="workout-manage-page__error" rounded>
      <template #avatar>
        <q-icon name="error_outline" color="negative" />
      </template>
      {{ errorMessage }}
    </q-banner>

    <!-- New / rename sheet dialog -->
    <q-dialog v-model="sheetPromptOpen" persistent>
      <q-card class="workout-manage-page__prompt">
        <q-card-section>
          <div class="workout-manage-page__prompt-title">
            {{
              sheetPromptMode === 'rename'
                ? t('workout.manage.renameSheet')
                : t('workout.manage.newSheetSheetTitle')
            }}
          </div>
          <q-input
            v-model="sheetPromptValue"
            dense
            outlined
            :placeholder="t('workout.manage.newSheetNamePlaceholder')"
            autofocus
            class="workout-manage-page__prompt-input"
            @keyup.enter="commitSheetPrompt"
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
            :label="t('workout.manage.newSheetSave')"
            :disable="sheetPromptValue.trim().length === 0"
            @click="commitSheetPrompt"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- New / rename session dialog -->
    <q-dialog v-model="sessionPromptOpen" persistent>
      <q-card class="workout-manage-page__prompt">
        <q-card-section>
          <div class="workout-manage-page__prompt-title">
            {{
              sessionPromptMode === 'rename'
                ? t('workout.manage.renameSession')
                : t('workout.manage.newSessionTitle')
            }}
          </div>
          <q-input
            v-model="sessionPromptValue"
            dense
            outlined
            :placeholder="t('workout.manage.newSessionNamePlaceholder')"
            autofocus
            class="workout-manage-page__prompt-input"
            @keyup.enter="commitSessionPrompt"
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
            :label="t('workout.manage.newSessionSave')"
            :disable="sessionPromptValue.trim().length === 0"
            @click="commitSessionPrompt"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Strength exercise picker -->
    <ExerciseSearchSheet
      v-model="strengthSearchOpen"
      kind="strength"
      :locale="locale"
      @select="onStrengthPickExercise"
      @create-custom="onStrengthCreateCustom"
    />

    <!-- Planned exercise form (after picking exercise) -->
    <q-dialog v-model="plannedFormOpen">
      <q-card class="workout-manage-page__prompt workout-manage-page__planned-form">
        <q-card-section>
          <div class="workout-manage-page__prompt-title">{{ plannedExerciseName }}</div>
        </q-card-section>
        <q-card-section class="workout-manage-page__planned-body">
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
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { Dialog, Notify } from 'quasar';
import { useI18n } from 'vue-i18n';

import { useAppStore } from 'src/stores/app';
import { getDatabase } from 'src/database/database';
import { exerciseService } from 'src/services/exercise';
import { workoutService } from 'src/services/workout';
import type { SheetWithSessions } from 'src/services/workout';
import type {
  ExerciseDefaultUnit,
  MuscleGroup,
  SupportedLocale,
  WorkoutSession,
  WorkoutSheet,
} from 'src/domain/types';

import WorkoutSheetCard from 'components/workout/WorkoutSheetCard.vue';
import SessionEditor from 'components/workout/SessionEditor.vue';
import ExerciseSearchSheet from 'components/exercise/ExerciseSearchSheet.vue';

const { t } = useI18n();
const appStore = useAppStore();
const locale = computed<SupportedLocale>(() => appStore.locale);
const measurementSystem = computed(() => appStore.measurementSystem);

const loading = ref<boolean>(true);
const errorMessage = ref<string | null>(null);
const sheets = ref<SheetWithSessions[]>([]);
const expandedSessionIds = reactive<Set<number>>(new Set<number>());

/**
 * SheetLite is the slim shape `WorkoutSheetCard` declares internally —
 * its `plannedExercises[].exercise` is `{id, name} | null` rather than the
 * full `Exercise` row that the service returns. Project down so the
 * component's prop type matches without us touching Lane 11 components.
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
      // Keep going — fallback in the lite handles missing names.
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
 * Slim shape for `SessionEditor` — its `plannedExercises[].planned` carries
 * `muscleGroupSnapshot` and `position`, and `exercise` carries `{id, name}
 * | null` (not the full Exercise row from the service).
 */
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

interface SessionLite {
  session: { id: number; name: string; position: number };
  plannedExercises: PlannedRow[];
}

const sessionLites = computed<Array<{ sheetId: number; sessions: SessionLite[] }>>(() =>
  sheets.value.map((s) => ({
    sheetId: s.sheet.id,
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
          muscleGroupSnapshot: p.planned.muscleGroupSnapshot,
          position: p.planned.position,
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
  })),
);

function fullSheet(id: number): SheetWithSessions {
  const found = sheets.value.find((s) => s.sheet.id === id);
  if (found) return found;
  return {
    sheet: { id, name: '', position: 0, createdAt: '', updatedAt: '' },
    sessions: [],
  };
}

function fullSession(sessionId: number): WorkoutSession {
  for (const s of sheets.value) {
    const found = s.sessions.find((sess) => sess.session.id === sessionId);
    if (found) return found.session;
  }
  return {
    id: sessionId,
    sheetId: 0,
    name: '',
    position: 0,
    createdAt: '',
    updatedAt: '',
  };
}

const sheetPromptOpen = ref<boolean>(false);
const sheetPromptMode = ref<'new' | 'rename'>('new');
const sheetPromptValue = ref<string>('');
const sheetPromptTarget = ref<WorkoutSheet | null>(null);

const sessionPromptOpen = ref<boolean>(false);
const sessionPromptMode = ref<'new' | 'rename'>('new');
const sessionPromptValue = ref<string>('');
const sessionPromptTarget = ref<WorkoutSession | null>(null);

const strengthSearchOpen = ref<boolean>(false);
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

const canSavePlanned = computed<boolean>(
  () =>
    plannedExerciseId.value !== null &&
    Number.isFinite(plannedSets.value) &&
    plannedSets.value > 0 &&
    Number.isFinite(plannedReps.value) &&
    plannedReps.value > 0,
);

async function refresh(): Promise<void> {
  loading.value = true;
  errorMessage.value = null;
  try {
    const conn = await getDatabase();
    sheets.value = await workoutService.listSheetsWithSessions(conn);
    await hydrateExerciseNames(sheets.value);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  } finally {
    loading.value = false;
  }
}

function toggleExpanded(sessionId: number, value: boolean): void {
  if (value) {
    expandedSessionIds.add(sessionId);
  } else {
    expandedSessionIds.delete(sessionId);
  }
}

function openNewSheet(): void {
  sheetPromptMode.value = 'new';
  sheetPromptTarget.value = null;
  sheetPromptValue.value = '';
  sheetPromptOpen.value = true;
}

function openRenameSheet(sheet: SheetWithSessions): void {
  sheetPromptMode.value = 'rename';
  sheetPromptTarget.value = sheet.sheet;
  sheetPromptValue.value = sheet.sheet.name;
  sheetPromptOpen.value = true;
}

async function commitSheetPrompt(): Promise<void> {
  const value = sheetPromptValue.value.trim();
  if (value.length === 0) return;
  sheetPromptOpen.value = false;
  try {
    const conn = await getDatabase();
    if (sheetPromptMode.value === 'rename' && sheetPromptTarget.value) {
      await workoutService.renameSheet(conn, {
        id: sheetPromptTarget.value.id,
        name: value,
      });
    } else {
      await workoutService.createSheet(conn, { name: value });
    }
    await refresh();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  }
}

function openNewSession(sheetId: number): void {
  sessionPromptMode.value = 'new';
  sessionPromptTarget.value = null;
  sessionPromptValue.value = '';
  sessionPromptTarget.value = {
    id: -1,
    sheetId,
    name: '',
    position: 0,
    createdAt: '',
    updatedAt: '',
  };
  sessionPromptOpen.value = true;
}

function openRenameSession(session: WorkoutSession): void {
  sessionPromptMode.value = 'rename';
  sessionPromptTarget.value = session;
  sessionPromptValue.value = session.name;
  sessionPromptOpen.value = true;
}

async function commitSessionPrompt(): Promise<void> {
  const value = sessionPromptValue.value.trim();
  if (value.length === 0) return;
  sessionPromptOpen.value = false;
  try {
    const conn = await getDatabase();
    if (
      sessionPromptMode.value === 'rename' &&
      sessionPromptTarget.value &&
      sessionPromptTarget.value.id > 0
    ) {
      await workoutService.renameSession(conn, {
        id: sessionPromptTarget.value.id,
        name: value,
      });
    } else if (sessionPromptTarget.value) {
      await workoutService.createSession(conn, {
        sheetId: sessionPromptTarget.value.sheetId,
        name: value,
      });
    }
    await refresh();
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
    await refresh();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  }
}

function confirmDeleteSessionById(sessionId: number): void {
  Dialog.create({
    title: t('workout.manage.deleteSession'),
    message: t('workout.manage.deleteSessionConfirm'),
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void doDeleteSession(sessionId);
  });
}

function confirmDeleteSession(_sheet: SheetWithSessions, sessionId: number): void {
  confirmDeleteSessionById(sessionId);
}

async function doDeleteSession(sessionId: number): Promise<void> {
  try {
    const conn = await getDatabase();
    await workoutService.deleteSession(conn, sessionId);
    await refresh();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  }
}

function confirmDeletePlannedById(plannedId: number): void {
  Dialog.create({
    title: t('workout.manage.addExerciseCta'),
    message: t('workout.manage.deleteExerciseConfirm'),
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void doDeletePlanned(plannedId);
  });
}

function confirmDeletePlanned(_sheet: SheetWithSessions, plannedId: number): void {
  confirmDeletePlannedById(plannedId);
}

async function doDeletePlanned(id: number): Promise<void> {
  try {
    const conn = await getDatabase();
    await workoutService.deletePlannedExercise(conn, id);
    await refresh();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  }
}

function openAddPlanned(_sheet: SheetWithSessions, sessionId: number): void {
  void _sheet;
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

function onAddExerciseForSession(sessionId: number): void {
  // SessionEditor's `add-exercise` emit is parameter-less, so we capture
  // the session id from the surrounding v-for via this closure. Resolve
  // the parent sheet so `openAddPlanned` (which currently ignores it
  // anyway) receives a real `SheetWithSessions`.
  for (const s of sheets.value) {
    if (s.sessions.some((sess) => sess.session.id === sessionId)) {
      openAddPlanned(s, sessionId);
      return;
    }
  }
  // Should not happen — SessionEditor only fires for sessions in `sheets`.
  void sessionId;
}

function onStrengthPickExercise(picked: { id: string; name: string }): void {
  plannedExerciseId.value = picked.id;
  plannedExerciseName.value = picked.name;
  strengthSearchOpen.value = false;
  plannedFormOpen.value = true;
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
    // Non-fatal: the form falls back to defaults.
  }
}

function onStrengthCreateCustom(): void {
  strengthSearchOpen.value = false;
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
    await refresh();
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

function onEditPlanned(_id: number): void {
  // Inline edit is owned by Lane 11 components; surface-level re-edit
  // routes through the manage page dialog (sheet / session / exercise
  // CRUD). No-op here so the event stays satisfied.
  void _id;
}

function onOpenSheet(): void {
  // Sheet-level "open" is a no-op here — the sheet card already exposes
  // per-session actions. Keep the handler so the event stays satisfied.
}

function onOpenSession(_sheet: SheetWithSessions, _sessionId: number): void {
  void _sheet;
  void _sessionId;
}

function onOpenPlanned(_sheet: SheetWithSessions, _plannedId: number): void {
  void _sheet;
  void _plannedId;
}

async function reorderPlanned(
  sessionId: number,
  payload: { plannedId: number; direction: 'up' | 'down' },
): Promise<void> {
  try {
    const conn = await getDatabase();
    if (payload.direction === 'up') {
      await workoutService.movePlannedExerciseUp(conn, sessionId, payload.plannedId);
    } else {
      await workoutService.movePlannedExerciseDown(conn, sessionId, payload.plannedId);
    }
    await refresh();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  }
}

onMounted(refresh);
watch(locale, refresh);
</script>

<style lang="scss" scoped>
.workout-manage-page {
  padding: 16px 16px calc(env(safe-area-inset-bottom, 0px) + 32px);
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--amilio-bg-light);
  color: var(--amilio-text-dark);

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  &__title {
    font-weight: 700;
    font-size: 1.2rem;
  }

  &__loading {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 160px;
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 32px 16px;
    border: 1px dashed var(--amilio-border);
    border-radius: 16px;
    background: var(--amilio-white);
    color: var(--amilio-text-secondary);
  }

  &__empty-text {
    text-align: center;
    font-size: 0.95rem;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__sessions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
  }

  &__sheet-detail {
    display: flex;
    flex-direction: column;
    gap: 8px;
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

  &__planned-form {
    min-width: 320px;
  }

  &__planned-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
}

.body--dark .workout-manage-page {
  background: var(--amilio-black);
  color: var(--amilio-text-light);

  &__empty {
    background: var(--amilio-graphite);
    color: var(--amilio-text-light);
    border-color: var(--amilio-surface-dark);
  }
}
</style>
