<template>
  <q-card flat class="meal-card">
    <q-card-section class="meal-card__section">
      <header class="meal-card__head">
        <div class="meal-card__title">{{ typeName }}</div>
        <div class="meal-card__kcal amilio-numeric">
          {{ formatKcal(totals.kcal, locale) }}
        </div>
        <q-btn flat dense round icon="more_vert" :aria-label="t('common.save')">
          <q-menu>
            <q-list dense>
              <q-item clickable v-close-popup @click="$emit('duplicate')">
                <q-item-section>{{ t('nutrition.meal.duplicate') }}</q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="$emit('repeat-yesterday')">
                <q-item-section>{{ t('nutrition.meal.repeatYesterday') }}</q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="$emit('rename')">
                <q-item-section>{{ t('nutrition.meal.rename') }}</q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="$emit('save-as-template')">
                <q-item-section>{{ t('nutrition.savedMeal.saveCta') }}</q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="$emit('delete')">
                <q-item-section class="text-negative">
                  {{ t('nutrition.meal.deleteMeal') }}
                </q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </header>

      <ul v-if="items.length" class="meal-card__list">
        <li
          v-for="it in items"
          :key="it.id"
          class="meal-card__item"
          @click="$emit('edit-item', it)"
        >
          <span class="meal-card__item-name">{{ it.foodNameSnapshot }}</span>
          <span class="meal-card__item-amount amilio-numeric">
            {{ Math.round(it.amountG) }} {{ displayUnit(it.unit) }}
          </span>
          <span class="meal-card__item-kcal amilio-numeric">
            {{ formatKcal(it.kcalSnapshot, locale) }}
          </span>
          <q-btn
            flat
            dense
            round
            icon="close"
            size="sm"
            class="meal-card__item-remove"
            @click.stop="$emit('remove-item', it)"
            :aria-label="t('nutrition.item.delete')"
          />
        </li>
      </ul>
      <div v-else class="meal-card__empty">{{ t('nutrition.meal.empty') }}</div>

      <div v-if="items.length" class="meal-card__chips amilio-numeric">
        <span class="meal-card__chip">
          {{ t('nutrition.macros.proteinShort') }} {{ formatMacroGrams(totals.proteinG, locale) }}
        </span>
        <span class="meal-card__chip">
          {{ t('nutrition.macros.carbsShort') }} {{ formatMacroGrams(totals.carbsG, locale) }}
        </span>
        <span class="meal-card__chip">
          {{ t('nutrition.macros.fatShort') }} {{ formatMacroGrams(totals.fatG, locale) }}
        </span>
      </div>

      <q-btn
        flat
        no-caps
        color="primary"
        text-color="primary"
        class="meal-card__add amilio-touch"
        :label="t('nutrition.meal.addCta')"
        :icon-right="'add'"
        @click="$emit('add', meal.mealTypeId)"
      />
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { FoodBaseUnit, Meal, MealItem, SupportedLocale } from 'src/domain/types';
import { aggregateItems } from 'src/domain/aggregate';
import { formatKcal, formatMacroGrams } from 'src/util/format';

const props = defineProps<{
  meal: Meal;
  items: ReadonlyArray<MealItem>;
  typeName: string;
  locale: SupportedLocale;
}>();

defineEmits<{
  (e: 'add', mealTypeId: Meal['mealTypeId']): void;
  (e: 'edit-item', item: MealItem): void;
  (e: 'remove-item', item: MealItem): void;
  (e: 'duplicate'): void;
  (e: 'repeat-yesterday'): void;
  (e: 'rename'): void;
  (e: 'save-as-template'): void;
  (e: 'delete'): void;
}>();

const { t } = useI18n();

const totals = computed(() =>
  props.items.length === 0
    ? { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: null }
    : aggregateItems(props.items),
);

function displayUnit(unit: FoodBaseUnit): string {
  return unit === 'ml' ? t('units.ml') : t('units.g');
}
</script>

<style lang="scss" scoped>
.meal-card {
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

  &__kcal {
    font-weight: 700;
    color: var(--amilio-text-dark);
  }

  &__list {
    list-style: none;
    margin: 12px 0 0;
    padding: 0;
  }

  &__item {
    display: grid;
    grid-template-columns: 1fr auto auto 28px;
    gap: 10px;
    align-items: center;
    padding: 10px 0;
    border-top: 1px solid var(--amilio-border);
    cursor: pointer;
    transition: background 100ms;

    &:hover {
      background: rgba(0, 0, 0, 0.03);
    }
  }

  &__item-name {
    font-weight: 600;
  }

  &__item-amount {
    color: var(--amilio-text-secondary);
    font-size: 0.85rem;
  }

  &__item-kcal {
    font-weight: 600;
  }

  &__item-remove {
    opacity: 0;
    transition: opacity 100ms;
  }

  &__item:hover &__item-remove {
    opacity: 1;
  }

  &__empty {
    text-align: center;
    color: var(--amilio-text-secondary);
    padding: 16px 8px;
    font-size: 0.9rem;
    border-top: 1px solid var(--amilio-border);
    margin-top: 12px;
  }

  &__chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 12px;
  }

  &__chip {
    background: var(--amilio-bg-light);
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--amilio-text-dark);
    border: 1px solid var(--amilio-border);
  }

  &__add {
    margin-top: 12px;
    align-self: flex-start;
  }
}

.body--dark .meal-card {
  background: var(--amilio-graphite);
  border: 1px solid var(--amilio-surface-dark);

  &__kcal {
    color: var(--amilio-text-light);
  }

  &__item {
    border-top: 1px solid var(--amilio-surface-dark);
  }

  &__item:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  &__chip {
    background: var(--amilio-surface-dark);
    color: var(--amilio-text-light);
    border: 1px solid var(--amilio-border);
  }
}
</style>
