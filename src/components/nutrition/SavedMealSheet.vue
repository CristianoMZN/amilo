<template>
  <q-dialog
    v-model="open"
    position="bottom"
    seamless
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
  >
    <q-card class="saved-meal-sheet">
      <q-card-section class="saved-meal-sheet__head">
        <div class="saved-meal-sheet__title">{{ t('nutrition.savedMeal.titleManager') }}</div>
        <q-btn flat round dense icon="close" v-close-popup />
      </q-card-section>

      <q-card-section v-if="sourceMealId !== null" class="saved-meal-sheet__cta">
        <q-btn
          unelevated
          color="primary"
          text-color="black"
          no-caps
          class="amilio-touch saved-meal-sheet__save-btn"
          :label="t('nutrition.savedMeal.saveCta')"
          @click="promptSaveTemplate"
        />
      </q-card-section>

      <q-card-section class="saved-meal-sheet__body">
        <div v-if="loading" class="saved-meal-sheet__loading">
          <q-spinner color="primary" size="28px" />
        </div>
        <q-list v-else-if="rows.length" separator>
          <SavedMealRow
            v-for="row in rows"
            :key="row.id"
            :saved-meal="row"
            :locale="locale"
            @apply="$emit('apply', $event)"
            @delete="confirmDelete"
          />
        </q-list>
        <div v-else class="saved-meal-sheet__empty">
          {{ t('nutrition.savedMeal.empty') }}
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { Dialog, Notify } from 'quasar';
import { useI18n } from 'vue-i18n';
import type { SavedMeal, SupportedLocale } from 'src/domain/types';
import { getDatabase } from 'src/database/database';
import { nutritionService } from 'src/services/nutrition';

import SavedMealRow from './SavedMealRow.vue';

const props = defineProps<{
  modelValue: boolean;
  refDate: string;
  locale: SupportedLocale;
  sourceMealId: number | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', open: boolean): void;
  (e: 'apply', savedMeal: SavedMeal): void;
  (e: 'deleted', id: number): void;
  (e: 'save-template', name: string): void;
}>();

const { t } = useI18n();

const open = defineModel<boolean>({ required: true });

const loading = ref<boolean>(false);
const rows = ref<Array<SavedMeal & { itemCount: number }>>([]);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const conn = await getDatabase();
    rows.value = await nutritionService.listSavedMealTemplates(conn, {
      locale: props.locale,
    });
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

onMounted(load);
watch(open, (val) => {
  if (val) void load();
});

function confirmDelete(savedMeal: SavedMeal): void {
  Dialog.create({
    title: t('nutrition.savedMeal.delete'),
    message: t('nutrition.savedMeal.deleteConfirm'),
    cancel: true,
    persistent: true,
  }).onOk(() => {
    emit('deleted', savedMeal.id);
    // Optimistic remove — the parent will refresh, but the row should
    // disappear immediately to feel responsive.
    rows.value = rows.value.filter((r) => r.id !== savedMeal.id);
  });
}

function promptSaveTemplate(): void {
  Dialog.create({
    title: t('nutrition.savedMeal.saveTitle'),
    message: t('nutrition.savedMeal.nameLabel'),
    prompt: {
      model: '',
      isValid: (val: string) => val.trim().length > 0,
      type: 'text',
    },
    cancel: true,
    persistent: true,
  }).onOk((payload: string) => {
    emit('save-template', payload.trim());
  });
}
</script>

<style lang="scss" scoped>
.saved-meal-sheet {
  min-height: 60vh;
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--amilio-border);
  }

  &__title {
    font-weight: 700;
    font-size: 1.05rem;
  }

  &__cta {
    border-bottom: 1px solid var(--amilio-border);
  }

  &__save-btn {
    width: 100%;
  }

  &__body {
    padding-block: 4px;
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

.body--dark .saved-meal-sheet {
  &__head,
  &__cta {
    border-color: var(--amilio-surface-dark);
  }
}
</style>