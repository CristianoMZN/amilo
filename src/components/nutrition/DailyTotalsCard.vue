<template>
  <q-card flat class="daily-totals">
    <q-card-section class="daily-totals__section">
      <div class="daily-totals__head">
        <div class="daily-totals__title">HOJE</div>
        <q-btn
          v-if="targets"
          flat
          dense
          size="sm"
          no-caps
          color="primary"
          :label="t('nutrition.totals.setGoalCta')"
          @click="$emit('edit-targets')"
        />
        <q-btn
          v-else
          unelevated
          dense
          size="sm"
          color="primary"
          text-color="black"
          no-caps
          :label="t('nutrition.totals.setGoalCta')"
          @click="$emit('edit-targets')"
        />
      </div>

      <div class="daily-totals__kcal" :class="`amilio-numeric`">
        {{ formatKcal(totals.kcal, $i18n.locale as SupportedLocale) }}
      </div>
      <div class="daily-totals__goal">
        <template v-if="targets">
          {{ t('nutrition.totals.goalLabel') }}
          {{ formatKcal(targets.kcalTarget, $i18n.locale as SupportedLocale) }}
        </template>
        <template v-else>
          {{ t('nutrition.totals.noGoal') }}
        </template>
      </div>
      <div v-if="targets" class="daily-totals__remaining" :class="`amilio-numeric`">
        {{ remainingKcal >= 0 ? '↓' : '↑' }}
        {{ formatKcal(Math.abs(remainingKcal), $i18n.locale as SupportedLocale) }}
        {{ remainingKcal >= 0 ? t('nutrition.totals.remaining') : t('nutrition.copy.ofGoal') }}
      </div>

      <div class="daily-totals__macros">
        <MacroProgressBar
          :label="t('nutrition.macros.protein')"
          :short="t('nutrition.macros.proteinShort')"
          :current="totals.proteinG"
          :target="targets?.proteinGTarget ?? null"
          :locale="$i18n.locale as SupportedLocale"
          color="protein"
        />
        <MacroProgressBar
          :label="t('nutrition.macros.carbs')"
          :short="t('nutrition.macros.carbsShort')"
          :current="totals.carbsG"
          :target="targets?.carbsGTarget ?? null"
          :locale="$i18n.locale as SupportedLocale"
          color="carbs"
        />
        <MacroProgressBar
          :label="t('nutrition.macros.fat')"
          :short="t('nutrition.macros.fatShort')"
          :current="totals.fatG"
          :target="targets?.fatGTarget ?? null"
          :locale="$i18n.locale as SupportedLocale"
          color="fat"
        />
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { NutritionTargets, MealItem, SupportedLocale } from 'src/domain/types';
import { aggregateItems } from 'src/domain/aggregate';
import { formatKcal } from 'src/util/format';
import { useAppStore } from 'src/stores/app';
import MacroProgressBar from './MacroProgressBar.vue';

const props = defineProps<{
  refDate: string;
  meals: ReadonlyArray<{ items: ReadonlyArray<MealItem> }>;
  targets: NutritionTargets | null;
}>();

defineEmits<{
  (e: 'edit-targets'): void;
}>();

const { t } = useI18n();
const appStore = useAppStore();
void appStore;

const totals = computed(() => {
  const flat = props.meals.flatMap((m) => m.items);
  if (flat.length === 0) {
    return { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: null };
  }
  return aggregateItems(flat);
});

const remainingKcal = computed(() =>
  props.targets ? props.targets.kcalTarget - totals.value.kcal : 0,
);
</script>

<style lang="scss" scoped>
.daily-totals {
  background: var(--amilio-white);
  border: 1px solid var(--amilio-border);
  border-radius: 20px;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__title {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--amilio-text-secondary);
  }

  &__kcal {
    font-size: 2.2rem;
    font-weight: 800;
    line-height: 1.05;
    margin-top: 4px;
  }

  &__goal {
    font-size: 0.85rem;
    color: var(--amilio-text-secondary);
    margin-top: 4px;
  }

  &__remaining {
    font-size: 0.9rem;
    font-weight: 600;
    margin-top: 4px;
  }

  &__macros {
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  &__section {
    padding: 18px;
  }
}

.body--dark .daily-totals {
  background: var(--amilio-graphite);
  border: 1px solid var(--amilio-surface-dark);
}
</style>
