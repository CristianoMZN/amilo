<template>
  <q-dialog
    v-model="open"
    position="bottom"
    seamless
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
  >
    <q-card class="targets-editor">
      <q-card-section class="targets-editor__head">
        <div class="targets-editor__title">{{ t('nutrition.targets.title') }}</div>
        <q-btn flat round dense icon="close" v-close-popup @click="reset" />
      </q-card-section>

      <q-card-section class="targets-editor__body">
        <div class="targets-editor__grid">
          <q-input
            v-model.number="kcalTarget"
            type="number"
            outlined
            dense
            :label="t('nutrition.targets.kcalLabel')"
            class="amilio-numeric"
            :error="!!errors.kcalTarget"
            :error-message="errors.kcalTarget"
          />
          <q-input
            v-model.number="proteinGTarget"
            type="number"
            outlined
            dense
            :label="t('nutrition.targets.proteinLabel')"
            class="amilio-numeric"
            :error="!!errors.proteinGTarget"
            :error-message="errors.proteinGTarget"
          />
          <q-input
            v-model.number="carbsGTarget"
            type="number"
            outlined
            dense
            :label="t('nutrition.targets.carbsLabel')"
            class="amilio-numeric"
            :error="!!errors.carbsGTarget"
            :error-message="errors.carbsGTarget"
          />
          <q-input
            v-model.number="fatGTarget"
            type="number"
            outlined
            dense
            :label="t('nutrition.targets.fatLabel')"
            class="amilio-numeric"
            :error="!!errors.fatGTarget"
            :error-message="errors.fatGTarget"
          />
        </div>

        <q-btn
          flat
          color="primary"
          no-caps
          class="targets-editor__suggest"
          :disable="profile === null"
          :label="t('nutrition.targets.suggestFromProfile')"
          @click="applySuggestion"
        />
      </q-card-section>

      <q-card-section class="targets-editor__actions">
        <q-space />
        <q-btn flat no-caps :label="t('common.cancel')" v-close-popup @click="reset" />
        <q-btn
          unelevated
          color="primary"
          text-color="black"
          no-caps
          class="amilio-touch"
          :label="t('nutrition.targets.save')"
          :loading="saving"
          :disable="saving || Object.keys(errors).length > 0"
          @click="save"
        />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Notify } from 'quasar';
import { useI18n } from 'vue-i18n';
import type { NutritionTargets, SupportedLocale, UserProfile } from 'src/domain/types';
import { getDatabase } from 'src/database/database';
import { nutritionService } from 'src/services/nutrition';

const props = defineProps<{
  modelValue: boolean;
  profile: UserProfile | null;
  locale: SupportedLocale;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', open: boolean): void;
  (e: 'saved', targets: NutritionTargets): void;
}>();

const { t } = useI18n();

const open = defineModel<boolean>({ required: true });

const saving = ref<boolean>(false);
const kcalTarget = ref<number>(2000);
const proteinGTarget = ref<number>(0);
const carbsGTarget = ref<number>(0);
const fatGTarget = ref<number>(0);

const errors = computed<Record<string, string>>(() => {
  const out: Record<string, string> = {};
  if (!Number.isFinite(kcalTarget.value) || kcalTarget.value <= 0) {
    out['kcalTarget'] = t('nutrition.targets.requiredKcal');
  }
  const macros: Array<[string, number]> = [
    ['proteinGTarget', proteinGTarget.value],
    ['carbsGTarget', carbsGTarget.value],
    ['fatGTarget', fatGTarget.value],
  ];
  for (const [key, value] of macros) {
    if (!Number.isFinite(value) || value < 0) {
      out[key] = t('nutrition.targets.requiredNonNegative');
    }
  }
  return out;
});

watch(open, async (val) => {
  if (val) {
    await load();
  }
});

async function load(): Promise<void> {
  try {
    const conn = await getDatabase();
    const existing = await nutritionService.getTargets(conn);
    if (existing) {
      kcalTarget.value = existing.kcalTarget;
      proteinGTarget.value = existing.proteinGTarget;
      carbsGTarget.value = existing.carbsGTarget;
      fatGTarget.value = existing.fatGTarget;
    } else {
      // Sensible defaults when no targets row exists yet.
      kcalTarget.value = 2000;
      proteinGTarget.value = 0;
      carbsGTarget.value = 0;
      fatGTarget.value = 0;
    }
  } catch (err) {
    Notify.create({
      message: err instanceof Error ? err.message : t('common.error'),
      color: 'negative',
      position: 'bottom',
    });
  }
}

async function applySuggestion(): Promise<void> {
  if (props.profile === null) return;
  try {
    const conn = await getDatabase();
    const suggested = await nutritionService.suggestTargets(conn, { profile: props.profile });
    kcalTarget.value = suggested.kcalTarget;
    proteinGTarget.value = suggested.proteinGTarget;
    carbsGTarget.value = suggested.carbsGTarget;
    fatGTarget.value = suggested.fatGTarget;
    Notify.create({
      message: t('nutrition.targets.appliedSuggestion'),
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

async function save(): Promise<void> {
  if (Object.keys(errors.value).length > 0) return;
  saving.value = true;
  try {
    const conn = await getDatabase();
    const result = await nutritionService.setTargets(conn, {
      kcalTarget: kcalTarget.value,
      proteinGTarget: proteinGTarget.value,
      carbsGTarget: carbsGTarget.value,
      fatGTarget: fatGTarget.value,
    });
    emit('saved', result);
    Notify.create({
      message: t('common.save'),
      color: 'positive',
      position: 'bottom',
      timeout: 1500,
    });
    open.value = false;
    reset();
  } catch (err) {
    Notify.create({
      message: err instanceof Error ? err.message : t('common.error'),
      color: 'negative',
      position: 'bottom',
    });
  } finally {
    saving.value = false;
  }
}

function reset(): void {
  kcalTarget.value = 2000;
  proteinGTarget.value = 0;
  carbsGTarget.value = 0;
  fatGTarget.value = 0;
}
</script>

<style lang="scss" scoped>
.targets-editor {
  min-height: 50vh;
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

  &__body {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  &__suggest {
    align-self: flex-start;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    border-top: 1px solid var(--amilio-border);
  }
}

.body--dark .targets-editor {
  &__head,
  &__actions {
    border-color: var(--amilio-surface-dark);
  }
}
</style>
