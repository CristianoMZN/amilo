<template>
  <q-page class="nutrition-manage-page">
    <q-tabs
      v-model="tab"
      dense
      align="justify"
      active-color="primary"
      indicator-color="primary"
      class="nutrition-manage-page__tabs"
    >
      <q-tab name="custom" :label="t('nutrition.food.custom')" />
      <q-tab name="favorites" :label="t('nutrition.food.favorites')" />
      <q-tab name="saved" :label="t('nutrition.savedMeal.titleManager')" />
    </q-tabs>

    <q-tab-panels v-model="tab" animated class="nutrition-manage-page__panels">
      <!-- Custom foods -->
      <q-tab-panel name="custom" class="nutrition-manage-page__panel">
        <div class="nutrition-manage-page__head">
          <div class="nutrition-manage-page__head-title">
            {{ t('nutrition.food.custom') }}
          </div>
          <q-btn
            unelevated
            color="primary"
            text-color="black"
            no-caps
            size="sm"
            icon="add"
            :label="t('common.continue')"
            class="amilio-touch"
            @click="openNewCustomFood"
          />
        </div>

        <div v-if="loading" class="nutrition-manage-page__loading">
          <q-spinner color="primary" size="28px" />
        </div>
        <q-list v-else-if="customFoods.length" separator>
          <q-item
            v-for="food in customFoods"
            :key="food.id"
            class="nutrition-manage-page__row"
          >
            <q-item-section>
              <q-item-label class="nutrition-manage-page__row-name">{{ food.name }}</q-item-label>
              <q-item-label caption class="amilio-numeric">
                {{ formatKcal(food.kcal, locale) }} / {{ food.baseAmountG }} {{ unitLabel(food.baseUnit) }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn flat dense round icon="edit" :aria-label="t('common.save')" @click="openEditCustomFood(food.id)" />
            </q-item-section>
            <q-item-section side>
              <q-btn
                flat
                dense
                round
                color="negative"
                icon="delete"
                :aria-label="t('nutrition.customFood.delete')"
                @click="confirmDeleteCustomFood(food.id)"
              />
            </q-item-section>
          </q-item>
        </q-list>
        <div v-else class="nutrition-manage-page__empty">
          {{ t('nutrition.recents.empty') }}
        </div>
      </q-tab-panel>

      <!-- Favorites -->
      <q-tab-panel name="favorites" class="nutrition-manage-page__panel">
        <div class="nutrition-manage-page__head">
          <div class="nutrition-manage-page__head-title">
            {{ t('nutrition.favorites.title') }}
          </div>
        </div>

        <div v-if="loading" class="nutrition-manage-page__loading">
          <q-spinner color="primary" size="28px" />
        </div>
        <q-list v-else-if="favoriteFoods.length" separator>
          <q-item
            v-for="food in favoriteFoods"
            :key="food.id"
            class="nutrition-manage-page__row"
          >
            <q-item-section>
              <q-item-label class="nutrition-manage-page__row-name">{{ food.name }}</q-item-label>
              <q-item-label caption class="amilio-numeric">
                {{ formatKcal(food.kcal, locale) }} / {{ food.baseAmountG }} {{ unitLabel(food.baseUnit) }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn
                flat
                dense
                round
                icon="star"
                color="primary"
                :aria-label="t('nutrition.favorites.untoggle')"
                @click="toggleFavorite(food.id)"
              />
            </q-item-section>
          </q-item>
        </q-list>
        <div v-else class="nutrition-manage-page__empty">
          {{ t('nutrition.favorites.empty') }}
        </div>
      </q-tab-panel>

      <!-- Saved meals -->
      <q-tab-panel name="saved" class="nutrition-manage-page__panel">
        <div class="nutrition-manage-page__head">
          <div class="nutrition-manage-page__head-title">
            {{ t('nutrition.savedMeal.titleManager') }}
          </div>
        </div>

        <div v-if="loading" class="nutrition-manage-page__loading">
          <q-spinner color="primary" size="28px" />
        </div>
        <q-list v-else-if="savedMeals.length" separator>
          <SavedMealRow
            v-for="row in savedMeals"
            :key="row.id"
            :saved-meal="row"
            :locale="locale"
            @apply="(s) => $emit('apply-saved', s)"
            @delete="confirmDeleteSavedMeal"
          />
        </q-list>
        <div v-else class="nutrition-manage-page__empty">
          {{ t('nutrition.savedMeal.empty') }}
        </div>
      </q-tab-panel>
    </q-tab-panels>

    <CustomFoodFormSheet
      v-model="customSheetOpen"
      :editing-id="customSheetEditingId"
      :locale="locale"
      @saved="onCustomFoodSaved"
      @deleted="onCustomFoodDeleted"
    />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Dialog, Notify } from 'quasar';
import { useI18n } from 'vue-i18n';
import type { Food, FoodBaseUnit, SavedMeal, SupportedLocale } from 'src/domain/types';
import { formatKcal } from 'src/util/format';
import { useAppStore } from 'src/stores/app';
import { getDatabase } from 'src/database/database';
import { nutritionService } from 'src/services/nutrition';

import SavedMealRow from 'components/nutrition/SavedMealRow.vue';
import CustomFoodFormSheet from 'components/nutrition/CustomFoodFormSheet.vue';

const { t } = useI18n();
const appStore = useAppStore();
const locale = computed<SupportedLocale>(() => appStore.locale);

const tab = ref<'custom' | 'favorites' | 'saved'>('custom');
const loading = ref<boolean>(true);

const customFoods = ref<Array<Food & { name: string }>>([]);
const favoriteFoods = ref<Array<Food & { name: string }>>([]);
const savedMeals = ref<Array<SavedMeal & { itemCount: number }>>([]);

const customSheetOpen = ref<boolean>(false);
const customSheetEditingId = ref<string | null>(null);

defineEmits<{
  (e: 'apply-saved', savedMeal: SavedMeal): void;
}>();

async function refresh(): Promise<void> {
  loading.value = true;
  try {
    const conn = await getDatabase();
    const [custom, favorites, saved] = await Promise.all([
      nutritionService.listCustomFoods(conn, { locale: locale.value }),
      nutritionService.listFavoriteFoods(conn, { locale: locale.value }),
      nutritionService.listSavedMealTemplates(conn, { locale: locale.value }),
    ]);
    customFoods.value = custom;
    favoriteFoods.value = favorites;
    savedMeals.value = saved;
  } catch (err) {
    Notify.create({
      message: err instanceof Error ? err.message : t('common.error'),
      color: 'negative',
      position: 'bottom',
    });
  } finally {
    loading.value = false;
  }
}

onMounted(refresh);
watch(locale, refresh);

function unitLabel(u: FoodBaseUnit): string {
  return u === 'ml' ? t('units.ml') : t('units.g');
}

function openNewCustomFood(): void {
  customSheetEditingId.value = null;
  customSheetOpen.value = true;
}

function openEditCustomFood(id: string): void {
  customSheetEditingId.value = id;
  customSheetOpen.value = true;
}

function confirmDeleteCustomFood(id: string): void {
  Dialog.create({
    title: t('nutrition.customFood.delete'),
    message: t('nutrition.customFood.deleteConfirm'),
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void doDeleteCustomFood(id);
  });
}

async function doDeleteCustomFood(id: string): Promise<void> {
  try {
    const conn = await getDatabase();
    await nutritionService.deleteCustomFood(conn, { id });
    customFoods.value = customFoods.value.filter((f) => f.id !== id);
    Notify.create({
      message: t('common.save'),
      color: 'positive',
      position: 'bottom',
      timeout: 1500,
    });
  } catch (err) {
    Notify.create({
      message: err instanceof Error ? err.message : t('common.error'),
      color: 'negative',
      position: 'bottom',
    });
  }
}

function confirmDeleteSavedMeal(savedMeal: SavedMeal): void {
  Dialog.create({
    title: t('nutrition.savedMeal.delete'),
    message: t('nutrition.savedMeal.deleteConfirm'),
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void doDeleteSavedMeal(savedMeal);
  });
}

async function doDeleteSavedMeal(savedMeal: SavedMeal): Promise<void> {
  try {
    const conn = await getDatabase();
    await nutritionService.deleteSavedMeal(conn, { id: savedMeal.id });
    savedMeals.value = savedMeals.value.filter((s) => s.id !== savedMeal.id);
    Notify.create({
      message: t('common.save'),
      color: 'positive',
      position: 'bottom',
      timeout: 1500,
    });
  } catch (err) {
    Notify.create({
      message: err instanceof Error ? err.message : t('common.error'),
      color: 'negative',
      position: 'bottom',
    });
  }
}

async function toggleFavorite(id: string): Promise<void> {
  try {
    const conn = await getDatabase();
    const stillFavorite = await nutritionService.toggleFavorite(conn, { foodId: id });
    if (!stillFavorite) {
      favoriteFoods.value = favoriteFoods.value.filter((f) => f.id !== id);
    }
  } catch (err) {
    Notify.create({
      message: err instanceof Error ? err.message : t('common.error'),
      color: 'negative',
      position: 'bottom',
    });
  }
}

function onCustomFoodSaved(food: Food): void {
  void refresh();
  void food;
}

function onCustomFoodDeleted(id: string): void {
  customFoods.value = customFoods.value.filter((f) => f.id !== id);
}
</script>

<style lang="scss" scoped>
.nutrition-manage-page {
  padding: 16px 16px 32px;
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--amilio-bg-light);
  color: var(--amilio-text-dark);

  &__tabs {
    border-bottom: 1px solid var(--amilio-border);
  }

  &__panels {
    background: transparent;
  }

  &__panel {
    padding: 12px 0;
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 0 8px;
  }

  &__head-title {
    font-weight: 700;
    font-size: 1.05rem;
  }

  &__row {
    padding: 12px 4px;
    border-bottom: 1px solid var(--amilio-border);
  }

  &__row-name {
    font-weight: 600;
  }

  &__loading {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 120px;
  }

  &__empty {
    text-align: center;
    color: var(--amilio-text-secondary);
    padding: 24px 0;
  }
}

.body--dark .nutrition-manage-page {
  background: var(--amilio-black);
  color: var(--amilio-text-light);

  &__tabs {
    border-color: var(--amilio-surface-dark);
  }

  &__row {
    border-color: var(--amilio-surface-dark);
  }
}
</style>