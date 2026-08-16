<template>
  <q-item
    clickable
    v-ripple
    class="saved-meal-row"
    @click="$emit('apply', savedMeal)"
  >
    <q-item-section>
      <q-item-label class="saved-meal-row__name">{{ savedMeal.name }}</q-item-label>
      <q-item-label caption class="amilio-numeric saved-meal-row__count">
        {{ t('nutrition.savedMeal.itemsCount', { count: savedMeal.itemCount }) }}
      </q-item-label>
    </q-item-section>
    <q-item-section side>
      <q-btn
        flat
        round
        dense
        icon="more_vert"
        :aria-label="t('common.save')"
        @click.stop
      >
        <q-menu>
          <q-list dense>
            <q-item clickable v-close-popup @click.stop="$emit('apply', savedMeal)">
              <q-item-section>{{ t('nutrition.savedMeal.addToMeal') }}</q-item-section>
            </q-item>
            <q-item
              clickable
              v-close-popup
              class="text-negative"
              @click.stop="$emit('delete', savedMeal)"
            >
              <q-item-section>{{ t('nutrition.savedMeal.delete') }}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </q-item-section>
  </q-item>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { SavedMeal, SupportedLocale } from 'src/domain/types';

defineProps<{
  savedMeal: SavedMeal & { itemCount: number };
  locale: SupportedLocale;
}>();

defineEmits<{
  (e: 'apply', savedMeal: SavedMeal): void;
  (e: 'delete', savedMeal: SavedMeal): void;
}>();

const { t } = useI18n();
</script>

<style lang="scss" scoped>
.saved-meal-row {
  border-bottom: 1px solid var(--amilio-border);

  &__name {
    font-weight: 600;
  }

  &__count {
    color: var(--amilio-text-secondary);
    font-size: 0.85rem;
  }
}

.body--dark .saved-meal-row {
  border-bottom: 1px solid var(--amilio-surface-dark);
}
</style>