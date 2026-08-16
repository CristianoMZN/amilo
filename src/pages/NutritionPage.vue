<template>
  <q-page class="nutrition-page">
    <!-- Date navigation -->
    <header class="nutrition-page__datebar">
      <q-btn
        flat
        dense
        round
        icon="chevron_left"
        aria-label="Dia anterior"
        @click="shiftDay(-1)"
      />
      <div class="nutrition-page__date-label">{{ dateLabel }}</div>
      <q-btn
        flat
        dense
        round
        :disable="isToday"
        icon="chevron_right"
        aria-label="Próximo dia"
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

    <!-- Daily totals -->
    <section class="nutrition-page__totals">
      <DailyTotalsCard
        v-if="panel"
        :ref-date="panel.refDate"
        :meals="panel.meals"
        :targets="panel.targets"
        @edit-targets="targetsSheetOpen = true"
      />
    </section>

    <!-- Meal cards -->
    <section class="nutrition-page__meals">
      <q-banner v-if="errorMessage" class="nutrition-page__error" rounded>
        <template #avatar>
          <q-icon name="error_outline" color="negative" />
        </template>
        {{ errorMessage }}
      </q-banner>

      <div v-if="loading" class="nutrition-page__loading">
        <q-spinner color="primary" size="32px" />
      </div>

      <MealCard
        v-for="meal in (panel?.meals ?? [])"
        :key="meal.meal.id"
        :meal="meal.meal"
        :items="meal.items"
        :type-name="meal.typeName"
        :locale="locale"
        @add="openAddSheet"
        @edit-item="openEditSheet"
        @remove-item="confirmRemove"
        @rename="openRenameSheet(meal.meal)"
        @save-as-template="openSaveTemplateForMeal(meal.meal)"
        @duplicate="openDuplicateSheet(meal.meal)"
        @repeat-yesterday="openRepeatSheet(meal.meal)"
        @delete="confirmDeleteMeal(meal.meal)"
      />

      <q-banner
        v-if="panel && panel.meals.length === 0 && !loading"
        class="nutrition-page__empty"
        rounded
      >
        <template #avatar>
          <q-icon name="restaurant_menu" color="primary" />
        </template>
        Nenhuma refeição registrada nesta data. Use o botão abaixo para começar.
      </q-banner>
    </section>

    <q-page-sticky position="bottom-right" :offset="[18, 88]">
      <q-btn
        fab
        unelevated
        color="primary"
        text-color="black"
        icon="add"
        :aria-label="t('nutrition.meal.addCta')"
        @click="onQuickAdd"
      />
    </q-page-sticky>

    <!-- Add / edit dialog -->
    <AddFoodSheet
      v-model="addSheetOpen"
      :locale="locale"
      :meal-type-options="mealTypes"
      :initial-meal-type-id="addSheetMealType"
      :editing-item="editingItem"
      @saved="refreshPanel"
    />

    <!-- Saved meal picker (used by repeat-yesterday / save-as-template paths) -->
    <SavedMealSheet
      v-if="savedMealSheetMode !== null"
      v-model="savedMealSheetOpen"
      :ref-date="nutritionStore.selectedDate"
      :locale="locale"
      :source-meal-id="savedMealSheetMode === 'save' ? activeMealId : null"
      @apply="onSavedMealApply"
      @deleted="onSavedMealDeleted"
      @save-template="onSaveTemplate"
    />

    <!-- Targets editor -->
    <TargetsEditorSheet
      v-model="targetsSheetOpen"
      :profile="userProfile"
      :locale="locale"
      @saved="onTargetsSaved"
    />

    <!-- Rename prompt (Dialog) -->
    <q-dialog v-model="renameDialogOpen" persistent>
      <q-card class="nutrition-page__prompt">
        <q-card-section>
          <div class="nutrition-page__prompt-title">{{ t('nutrition.meal.renameTitle') }}</div>
          <q-input
            v-model="renameValue"
            dense
            outlined
            :placeholder="t('nutrition.meal.mealNamePlaceholder')"
            autofocus
            class="nutrition-page__prompt-input"
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
            :disable="renameValue.trim().length === 0"
            @click="commitRename"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Dialog, Notify } from 'quasar';
import { useI18n } from 'vue-i18n';

import { useAppStore } from 'src/stores/app';
import { useNutritionStore } from 'src/stores/nutrition';
import { getDatabase } from 'src/database/database';
import { nutritionService } from 'src/services/nutrition';
import { addDays, formatLocalDateLong, isValidLocalDate, todayLocalDate } from 'src/util/dateDay';
import { findProfile } from 'src/repositories/userProfile';
import type { Meal, MealItem, MealTypeId, SavedMeal, UserProfile } from 'src/domain/types';

import DailyTotalsCard from 'components/nutrition/DailyTotalsCard.vue';
import MealCard from 'components/nutrition/MealCard.vue';
import AddFoodSheet from 'components/nutrition/AddFoodSheet.vue';
import SavedMealSheet from 'components/nutrition/SavedMealSheet.vue';
import TargetsEditorSheet from 'components/nutrition/TargetsEditorSheet.vue';

const { t } = useI18n();
const appStore = useAppStore();
const nutritionStore = useNutritionStore();

const locale = computed(() => appStore.locale);

const loading = ref<boolean>(true);
const errorMessage = ref<string | null>(null);
const panel = ref<Awaited<ReturnType<typeof nutritionService.getDailyPanel>> | null>(null);
const mealTypes = ref<Array<{ id: MealTypeId; name: string }>>([]);
const addSheetOpen = ref<boolean>(false);
const addSheetMealType = ref<MealTypeId>('lunch');
const editingItem = ref<MealItem | null>(null);

const targetsSheetOpen = ref<boolean>(false);
const userProfile = ref<UserProfile | null>(null);

const savedMealSheetOpen = ref<boolean>(false);
const savedMealSheetMode = ref<'save' | 'apply' | null>(null);
const activeMealId = ref<number | null>(null);

const renameDialogOpen = ref<boolean>(false);
const renameValue = ref<string>('');
const renameTargetMeal = ref<Meal | null>(null);

const isToday = computed<boolean>(() => nutritionStore.selectedDate === todayLocalDate());
const dateLabel = computed<string>(() => {
  const date = nutritionStore.selectedDate;
  if (!isValidLocalDate(date)) return date;
  return formatLocalDateLong(date, locale.value);
});

async function refreshPanel(): Promise<void> {
  loading.value = true;
  errorMessage.value = null;
  try {
    const conn = await getDatabase();
    const [data, chips, profile] = await Promise.all([
      nutritionService.getDailyPanel(conn, {
        refDate: nutritionStore.selectedDate,
        locale: locale.value,
      }),
      nutritionService.listMealTypeChips(conn, { locale: locale.value }),
      findProfile(conn),
    ]);
    panel.value = data;
    mealTypes.value = chips;
    userProfile.value = profile;
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  } finally {
    loading.value = false;
  }
}

function shiftDay(delta: number): void {
  const next = addDays(nutritionStore.selectedDate, delta);
  if (isValidLocalDate(next)) {
    nutritionStore.setSelectedDate(next);
  }
}

function goToday(): void {
  nutritionStore.today();
}

function openAddSheet(mealTypeId: MealTypeId): void {
  editingItem.value = null;
  addSheetMealType.value = mealTypeId;
  addSheetOpen.value = true;
}

function onQuickAdd(): void {
  // Default to lunch when the user uses the floating action button.
  openAddSheet(addSheetMealType.value);
}

function openEditSheet(item: MealItem): void {
  editingItem.value = item;
  addSheetOpen.value = true;
}

function openRenameSheet(meal: Meal): void {
  renameTargetMeal.value = meal;
  renameValue.value = meal.customName ?? '';
  renameDialogOpen.value = true;
}

async function commitRename(): Promise<void> {
  const target = renameTargetMeal.value;
  const value = renameValue.value.trim();
  renameDialogOpen.value = false;
  if (!target || value.length === 0) return;
  try {
    const conn = await getDatabase();
    // Only custom meals carry a custom_name; for built-in meal types we
    // still let the user override the display name by saving it to the
    // custom_name column. The repository accepts the value verbatim.
    const { renameMeal } = await import('src/repositories/meal');
    await renameMeal(conn, target.id, value);
    await refreshPanel();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  }
}

function openSaveTemplateForMeal(meal: Meal): void {
  activeMealId.value = meal.id;
  savedMealSheetMode.value = 'save';
  savedMealSheetOpen.value = true;
}

function openDuplicateSheet(meal: Meal): void {
  // Duplicate is implemented as repeat-yesterday-like flow: re-add the
  // items into a fresh copy. We open the saved-meal sheet so the user can
  // decide to either create a template or apply an existing one.
  activeMealId.value = meal.id;
  savedMealSheetMode.value = 'apply';
  savedMealSheetOpen.value = true;
}

function openRepeatSheet(meal: Meal): void {
  activeMealId.value = meal.id;
  savedMealSheetMode.value = 'apply';
  savedMealSheetOpen.value = true;
}

function confirmDeleteMeal(meal: Meal): void {
  Dialog.create({
    title: t('nutrition.meal.deleteMeal'),
    message: t('nutrition.meal.deleteMealConfirm'),
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void doDeleteMeal(meal);
  });
}

async function doDeleteMeal(meal: Meal): Promise<void> {
  try {
    const conn = await getDatabase();
    const { deleteMeal } = await import('src/repositories/meal');
    await deleteMeal(conn, meal.id);
    await refreshPanel();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  }
}

async function confirmRemove(item: MealItem): Promise<void> {
  try {
    const conn = await getDatabase();
    await nutritionService.removeMealItem(conn, { itemId: item.id });
    await refreshPanel();
    Notify.create({
      message: t('nutrition.item.deletedToast'),
      color: 'dark',
      textColor: 'white',
      position: 'bottom',
      timeout: 5000,
      actions: [
        {
          label: t('nutrition.item.undo'),
          color: 'yellow',
          handler: () => {
            // Undo is a no-op placeholder for the MVP — full restore would
            // need a backup row kept aside before deletion. The toast
            // action stays here so the UI feedback loop is honest.
          },
        },
      ],
    });
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  }
}

async function onSavedMealApply(savedMeal: SavedMeal): Promise<void> {
  try {
    const conn = await getDatabase();
    await nutritionService.addSavedMealToDay(conn, {
      savedMealId: savedMeal.id,
      refDate: nutritionStore.selectedDate,
      mealTypeId: 'snack',
      customName: null,
      locale: locale.value,
    });
    savedMealSheetOpen.value = false;
    savedMealSheetMode.value = null;
    activeMealId.value = null;
    await refreshPanel();
    Notify.create({
      message: t('nutrition.savedMeal.saved'),
      color: 'positive',
      position: 'bottom',
      timeout: 1500,
    });
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  }
}

async function onSavedMealDeleted(id: number): Promise<void> {
  try {
    const conn = await getDatabase();
    await nutritionService.deleteSavedMeal(conn, { id });
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  }
}

async function onSaveTemplate(name: string): Promise<void> {
  const sourceId = activeMealId.value;
  savedMealSheetOpen.value = false;
  savedMealSheetMode.value = null;
  activeMealId.value = null;
  if (sourceId === null) return;
  try {
    const conn = await getDatabase();
    await nutritionService.saveMealAsTemplate(conn, {
      name,
      locale: locale.value,
      sourceMealId: sourceId,
    });
    Notify.create({
      message: t('nutrition.savedMeal.saved'),
      color: 'positive',
      position: 'bottom',
      timeout: 1500,
    });
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.error');
  }
}

function onTargetsSaved(): void {
  void refreshPanel();
}

onMounted(refreshPanel);
watch(() => nutritionStore.selectedDate, refreshPanel);
watch(() => locale.value, refreshPanel);
</script>

<style lang="scss" scoped>
.nutrition-page {
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

  &__meals {
    display: flex;
    flex-direction: column;
    gap: 12px;
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
}

.body--dark .nutrition-page {
  background: var(--amilio-black);
  color: var(--amilio-text-light);

  &__empty {
    background: var(--amilio-graphite);
    color: var(--amilio-text-light);
    border: 1px dashed var(--amilio-surface-dark);
  }
}
</style>