<template>
  <q-dialog
    v-model="open"
    position="bottom"
    seamless
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
  >
    <q-card class="add-food add-food--full">
      <q-card-section class="add-food__head">
        <div class="add-food__title">
          <template v-if="editingItem">{{ t('nutrition.item.edit') }}</template>
          <template v-else>{{ t('nutrition.addFood.sheetTitle') }}</template>
        </div>
        <q-btn flat round dense icon="close" v-close-popup @click="reset" />
      </q-card-section>

      <q-card-section class="add-food__body">
        <!-- Tabs -->
        <q-tabs
          v-model="tab"
          dense
          align="justify"
          active-color="primary"
          indicator-color="primary"
          class="add-food__tabs"
        >
          <q-tab name="recents" :label="t('nutrition.food.recent')" />
          <q-tab name="favorites" :label="t('nutrition.food.favorites')" />
          <q-tab name="all" :label="t('nutrition.food.all')" />
        </q-tabs>

        <q-input
          v-model="query"
          outlined
          dense
          autofocus
          :placeholder="t('nutrition.food.searchPlaceholder')"
          :hint="t('nutrition.food.searchHint')"
          class="add-food__search"
        >
          <template #prepend>
            <q-icon name="search" />
          </template>
        </q-input>

        <div class="add-food__results">
          <q-list v-if="results.length" separator>
            <q-item v-for="food in results" :key="food.id" clickable v-ripple @click="pick(food)">
              <q-item-section>
                <q-item-label>{{ food.name }}</q-item-label>
                <q-item-label caption class="amilio-numeric">
                  {{ formatKcal(food.kcal, locale) }} / {{ food.baseAmountG }}
                  {{ unitLabel(food.baseUnit) }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-icon
                  v-if="food.origin === 'custom'"
                  name="person"
                  size="18px"
                  :title="t('nutrition.food.originCustom')"
                />
              </q-item-section>
            </q-item>
          </q-list>
          <div v-else class="add-food__empty">{{ t('nutrition.food.noResults') }}</div>
        </div>
      </q-card-section>

      <q-card-section v-if="selected" class="add-food__detail">
        <div class="add-food__selected">{{ selected.name }}</div>
        <div class="add-food__amount">
          <QuantityInput
            v-model="amount"
            :unit="selected.baseUnit"
            :locale="locale"
            :placeholder="t('nutrition.addFood.quantity')"
            class="add-food__amount-input"
          />
        </div>
        <div v-if="preview" class="add-food__preview amilio-numeric">
          <span>{{ formatKcal(preview.kcal, locale) }}</span>
          <span class="add-food__chip"
            >{{ formatMacroGrams(preview.proteinG, locale) }}
            {{ t('nutrition.macros.proteinShort') }}</span
          >
          <span class="add-food__chip"
            >{{ formatMacroGrams(preview.carbsG, locale) }}
            {{ t('nutrition.macros.carbsShort') }}</span
          >
          <span class="add-food__chip"
            >{{ formatMacroGrams(preview.fatG, locale) }} {{ t('nutrition.macros.fatShort') }}</span
          >
          <span v-if="preview.fiberG !== null" class="add-food__chip">
            {{ formatMacroGrams(preview.fiberG, locale) }} {{ t('nutrition.macros.fiberShort') }}
          </span>
        </div>

        <div class="add-food__actions">
          <q-btn flat :label="t('common.cancel')" v-close-popup @click="reset" />
          <q-btn
            unelevated
            color="primary"
            text-color="black"
            no-caps
            class="amilio-touch"
            :label="editingItem ? t('common.save') : t('nutrition.addFood.addButton')"
            :disable="!selected || amount <= 0"
            @click="commit"
          />
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Notify } from 'quasar';
import type { Food, FoodBaseUnit, MealItem, MealTypeId, SupportedLocale } from 'src/domain/types';
import { scaleFromBase } from 'src/domain/nutrition';
import { formatKcal, formatMacroGrams } from 'src/util/format';
import { getDatabase } from 'src/database/database';
import { nutritionService } from 'src/services/nutrition';
import { useNutritionStore } from 'src/stores/nutrition';

import QuantityInput from './QuantityInput.vue';

interface FoodWithName extends Food {
  name: string;
}

const props = defineProps<{
  locale: SupportedLocale;
  mealTypeOptions: ReadonlyArray<{ id: MealTypeId; name: string }>;
  initialMealTypeId: MealTypeId;
  editingItem: MealItem | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', open: boolean): void;
  (e: 'saved'): void;
}>();

const { t } = useI18n();
const nutritionStore = useNutritionStore();

const open = defineModel<boolean>({ required: true });

const tab = ref<'recents' | 'favorites' | 'all'>('recents');
const query = ref<string>('');
const allFoods = ref<FoodWithName[]>([]);
const recents = ref<FoodWithName[]>([]);
const favorites = ref<FoodWithName[]>([]);
const selected = ref<FoodWithName | null>(null);
const amount = ref<number>(100);
const units = ref<{ id: MealTypeId; name: string }[]>([]);

watch(open, (val) => {
  if (val) {
    void loadAll();
    if (props.editingItem) {
      selected.value = {
        id: props.editingItem.foodId ?? '',
        name: props.editingItem.foodNameSnapshot,
        origin: 'custom',
        baseAmountG: 100,
        baseUnit: props.editingItem.unit,
        kcal: props.editingItem.kcalSnapshot,
        proteinG: props.editingItem.proteinGSnapshot,
        carbsG: props.editingItem.carbsGSnapshot,
        fatG: props.editingItem.fatGSnapshot,
        fiberG: props.editingItem.fiberGSnapshot,
        createdAt: props.editingItem.createdAt,
        updatedAt: props.editingItem.createdAt,
      };
      amount.value = props.editingItem.amountG;
    }
  } else {
    reset();
  }
});

watch(tab, () => {
  // Trigger results refresh when tabs change.
});

watch(query, async (q) => {
  if (q.length > 0) {
    const conn = await getDatabase();
    const out = await nutritionService.searchFoods(conn, {
      locale: props.locale,
      query: q,
      limit: 30,
    });
    allFoods.value = out;
  } else {
    await loadAll();
  }
});

async function loadAll(): Promise<void> {
  const conn = await getDatabase();
  const [r, f, o] = await Promise.all([
    nutritionService.listRecentFoods(conn, { locale: props.locale, limit: 10 }),
    nutritionService.listFavoriteFoods(conn, { locale: props.locale }),
    nutritionService.searchFoods(conn, { locale: props.locale, query: '' }),
  ]);
  recents.value = r;
  favorites.value = f;
  allFoods.value = o;
  units.value = props.mealTypeOptions.slice();
}

const results = computed<FoodWithName[]>(() => {
  if (query.value.length > 0) return allFoods.value;
  if (tab.value === 'favorites') return favorites.value;
  if (tab.value === 'all') return allFoods.value.slice(0, 50);
  return recents.value;
});

const preview = computed(() => {
  if (!selected.value || amount.value <= 0) return null;
  return scaleFromBase(selected.value, amount.value);
});

function unitLabel(u: FoodBaseUnit): string {
  return u === 'ml' ? t('units.ml') : t('units.g');
}

function pick(food: FoodWithName): void {
  selected.value = food;
  amount.value = 100;
}

async function commit(): Promise<void> {
  if (!selected.value) return;
  const conn = await getDatabase();
  try {
    if (props.editingItem) {
      await nutritionService.updateMealItemAmount(conn, {
        mealId: props.editingItem.mealId,
        itemId: props.editingItem.id,
        amount: amount.value,
      });
      Notify.create({
        message: t('common.save'),
        color: 'positive',
        position: 'bottom',
        timeout: 1500,
      });
    } else {
      await nutritionService.ensureMealAndAddItem(conn, {
        refDate: nutritionStore.selectedDate,
        mealTypeId: props.initialMealTypeId,
        customName: null,
        item: {
          foodId: selected.value.id,
          foodName: selected.value.name,
          amount: amount.value,
          unit: selected.value.baseUnit,
        },
      });
      Notify.create({
        message: t('nutrition.addFood.addButton'),
        color: 'positive',
        position: 'bottom',
        timeout: 1500,
      });
    }
    emit('saved');
    open.value = false;
    reset();
  } catch (err) {
    Notify.create({
      message: err instanceof Error ? err.message : t('common.error'),
      color: 'negative',
      position: 'bottom',
    });
  }
}

function reset(): void {
  selected.value = null;
  amount.value = 100;
  query.value = '';
  tab.value = 'recents';
}
</script>

<style lang="scss" scoped>
.add-food--full {
  min-height: 80vh;
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
}

.add-food__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--amilio-border);
  padding-block: 4px;
}

.add-food__title {
  font-weight: 700;
  font-size: 1.05rem;
}

.add-food__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.add-food__tabs {
  border-bottom: 1px solid var(--amilio-border);
}

.add-food__results {
  min-height: 200px;
  max-height: 40vh;
  overflow-y: auto;
}

.add-food__empty {
  text-align: center;
  color: var(--amilio-text-secondary);
  padding: 24px 0;
}

.add-food__detail {
  border-top: 1px solid var(--amilio-border);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.add-food__selected {
  font-weight: 700;
  font-size: 1.1rem;
}

.add-food__amount {
  display: flex;
  align-items: center;
  gap: 12px;
}

.add-food__unit {
  font-weight: 600;
}

.add-food__preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-weight: 600;
}

.add-food__chip {
  background: var(--amilio-bg-light);
  border: 1px solid var(--amilio-border);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 0.85rem;
}

.add-food__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.body--dark .add-food__chip {
  background: var(--amilio-surface-dark);
  border: 1px solid var(--amilio-border);
}
</style>
